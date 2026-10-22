/**
 * Places for the commons. Every gallery item can carry a location — the
 * neighborhood a story happened in, the town a program runs in, the city a
 * tool was built for — so the gallery's Nearby filter can show someone what
 * is rooted close to them without a studio having to exist for their place.
 *
 * The shape lives inside `metadata.location` on commons rows (the shared
 * commons schema stays column-stable) and in a `location` column on the
 * Builder's own tables (studio library items, event codes). One shape
 * everywhere, so the gallery reads them all the same way.
 *
 * Precision says how rooted the item is in the place. `origin` is the honest
 * tag for something universal — a book, a framework, a design pattern —
 * pinned only where it was made; Nearby shows those in a second band,
 * "made near you", never as if they were local.
 *
 * Coordinates come from OpenStreetMap (Nominatim for the batch tagging in
 * scripts/geotag, Photon for what people type into the gallery), credited
 * where a map would be. No coordinates are ever guessed.
 */

export type GeoPrecision = 'neighborhood' | 'city' | 'region' | 'country' | 'origin';

export interface GeoPoint {
  lat: number;
  lng: number;
  /** Human label for the point: "Logan Square, Chicago, Illinois" */
  label: string;
}

export interface GeoLocation extends GeoPoint {
  precision: GeoPrecision;
  /** Where the place came from: a named attribution, the item's own text,
   *  or research done while tagging */
  basis?: 'attribution' | 'text' | 'research' | 'manual';
  /** Other places the item is equally rooted in — a story told in two cities */
  also?: GeoPoint[];
}

/** Rooted somewhere real, as opposed to pinned where a universal thing was made */
export function isPlaceRooted(loc: GeoLocation): boolean {
  return loc.precision !== 'origin';
}

const EARTH_RADIUS_MILES = 3958.8;

/** Great-circle distance in miles (haversine) */
export function distanceMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The closest of an item's places to a point, in miles */
export function nearestMiles(loc: GeoLocation, from: { lat: number; lng: number }): number {
  let best = distanceMiles(loc, from);
  for (const p of loc.also ?? []) best = Math.min(best, distanceMiles(p, from));
  return best;
}

/** The label of whichever of an item's places is closest to a point */
export function nearestLabel(loc: GeoLocation, from: { lat: number; lng: number }): string {
  let best = loc.label;
  let bestD = distanceMiles(loc, from);
  for (const p of loc.also ?? []) {
    const d = distanceMiles(p, from);
    if (d < bestD) { bestD = d; best = p.label; }
  }
  return best;
}

/** "3 mi", "40 mi", "1,200 mi" — never false precision */
export function formatMiles(mi: number): string {
  if (mi < 1) return 'under a mile';
  const n = mi < 20 ? Math.round(mi) : mi < 200 ? Math.round(mi / 5) * 5 : Math.round(mi / 50) * 50;
  return `${n.toLocaleString()} mi`;
}

/** The radii the Nearby filter offers, in miles */
export const NEARBY_RADII_MILES = [25, 50, 150, 500] as const;
export const DEFAULT_NEARBY_RADIUS_MILES = 50;

/**
 * Read a location off a row's JSON, tolerating anything that isn't one. The
 * commons' metadata is free-form and other writers touch it; a malformed
 * location is simply no location.
 */
export function parseLocation(raw: unknown): GeoLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const lat = Number(r.lat);
  const lng = Number(r.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const precision = String(r.precision ?? 'city') as GeoPrecision;
  const also = Array.isArray(r.also)
    ? r.also
        .map(p => (p && typeof p === 'object' ? (p as Record<string, unknown>) : null))
        .filter((p): p is Record<string, unknown> => !!p && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .map(p => ({ lat: Number(p.lat), lng: Number(p.lng), label: String(p.label ?? '') }))
    : undefined;
  return {
    lat,
    lng,
    label: String(r.label ?? ''),
    precision: ['neighborhood', 'city', 'region', 'country', 'origin'].includes(precision) ? precision : 'city',
    basis: r.basis ? (String(r.basis) as GeoLocation['basis']) : undefined,
    ...(also && also.length > 0 ? { also } : {}),
  };
}

// --- Geocoding for what a person types (browser side) ---

const PHOTON_URL = 'https://photon.komoot.io';

interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: Record<string, string | undefined>;
}

/** "Outer Sunset, San Francisco, California" from Photon's parts */
function photonLabel(p: Record<string, string | undefined>): string {
  const parts = [p.name, p.district, p.city, p.state, p.country]
    .filter((v): v is string => !!v)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  // The name repeats the city for a city result; keep one
  return parts.slice(0, 4).join(', ');
}

/**
 * Turn a typed place into a point. Photon (komoot's OpenStreetMap geocoder)
 * answers from a browser without a key. Returns null when nothing matched
 * or the service is unreachable — the caller says so in words.
 */
export async function geocodePlace(query: string, signal?: AbortSignal): Promise<GeoPoint | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(`${PHOTON_URL}/api/?q=${encodeURIComponent(q)}&limit=1&lang=en`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const f = data.features?.[0];
    if (!f) return null;
    const [lng, lat] = f.geometry.coordinates;
    return { lat, lng, label: photonLabel(f.properties) || q };
  } catch {
    return null;
  }
}

/** A readable name for coordinates the browser handed us */
export async function reverseGeocode(point: { lat: number; lng: number }, signal?: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(`${PHOTON_URL}/reverse?lat=${point.lat}&lon=${point.lng}&lang=en`, { signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { features?: PhotonFeature[] };
    const f = data.features?.[0];
    if (!f) return null;
    const p = f.properties;
    // A street-level hit names the street; the neighborhood or city is the
    // honest resolution for "near you"
    const parts = [p.district ?? p.locality ?? p.suburb, p.city ?? p.town ?? p.village ?? p.county, p.state]
      .filter((v): v is string => !!v)
      .filter((v, i, arr) => arr.indexOf(v) === i);
    return parts.join(', ') || null;
  } catch {
    return null;
  }
}

/** Where the browser says the person is, named. Null when they decline or it fails. */
export async function locateMe(): Promise<GeoPoint | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  const pos = await new Promise<GeolocationPosition | null>(resolve => {
    navigator.geolocation.getCurrentPosition(
      p => resolve(p),
      () => resolve(null),
      { timeout: 10_000, maximumAge: 10 * 60_000 },
    );
  });
  if (!pos) return null;
  // Round to ~1 km: the gallery needs a neighborhood, not a doorstep
  const lat = Math.round(pos.coords.latitude * 100) / 100;
  const lng = Math.round(pos.coords.longitude * 100) / 100;
  const label = (await reverseGeocode({ lat, lng })) ?? 'Your location';
  return { lat, lng, label };
}

/**
 * Build a stored location for something a person placed by hand (a studio
 * admin's "Place" field, a steward's event): geocode the words, keep them as
 * the label, and call the precision what the words say.
 */
export async function locationFromPlace(place: string, precision: GeoPrecision = 'city'): Promise<GeoLocation | null> {
  const point = await geocodePlace(place);
  if (!point) return null;
  return { ...point, label: place.trim(), precision, basis: 'manual' };
}
