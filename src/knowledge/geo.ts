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
  /** The area this serves (not where it was made): a radius around the
   *  point or a boundary. Absent means "a point only" — everything tagged
   *  before catchments existed reads exactly as it did. */
  catchment?: Catchment;
}

// ── Catchments ────────────────────────────────────────────────────────────

/**
 * Where a catchment's shape came from. `radius` and `drawn` are a person's
 * own call; the named sources resolve to a boundary from public data
 * (OpenStreetMap through Nominatim for zips, neighborhoods and towns; a
 * pasted GeoJSON file for a watershed or a bioregion from USGS, One Earth,
 * or anywhere else). Kept on the row so a reader can say "the 60647 zip"
 * instead of "a polygon".
 */
export type CatchmentSource =
  | 'radius' | 'drawn' | 'zip' | 'neighborhood' | 'city' | 'county'
  | 'watershed' | 'bioregion' | 'geojson' | 'block' | 'other';

/**
 * How firm a catchment's edge is. `rough` (the default when unset): the
 * area is who the tool is mostly for, and someone a street over is welcome.
 * `strict`: the tool is for this area and says so; what it shows and
 * collects stays inside it. Neither is enforced by location: a tool asks
 * people where they are in words, it never checks.
 */
export type CatchmentEdges = 'strict' | 'rough';

/** A block's catchment is a short radius around its midpoint: enough to
 *  cover both sides of the street and its two corners */
export const BLOCK_CATCHMENT_MILES = 0.08;

/** One ring of [lng, lat] pairs, GeoJSON order, outer rings only */
export type Ring = [number, number][];

export interface Catchment {
  kind: 'radius' | 'polygon';
  /** Radius catchments: how far from the point, in miles */
  miles?: number;
  /** Polygon catchments: one or more outer rings (a MultiPolygon flattens
   *  to several; holes are dropped — "serves here" is a suggestion shown
   *  to a person, never a gate, so that precision is enough) */
  rings?: Ring[];
  /** In words: "1.5 miles around Palmer Square", "ZIP 60647", "North Branch
   *  Chicago River watershed" */
  label: string;
  source: CatchmentSource;
  /** The identifier in the source's own terms: "60647", "relation/122604",
   *  "huc12:071200040203", or a block id from the place's own commons */
  ref?: string;
  /** Strict or rough borders. Absent reads as rough. */
  edges?: CatchmentEdges;
}

/** Radii the Place dialog offers, in miles — neighborhood scale up to a county */
export const CATCHMENT_RADII_MILES = [0.5, 1, 1.5, 2, 3, 5, 8, 12, 25] as const;
export const DEFAULT_CATCHMENT_MILES = 1.5;
/** A boundary ring keeps at most this many points — plenty for containment */
export const MAX_RING_POINTS = 400;

/** Ray casting: is a point inside a ring (lng/lat plane, fine at this scale) */
function ringContains(ring: Ring, lng: number, lat: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const crosses = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Does this location's catchment cover a point? A point-only location covers nothing. */
export function catchmentContains(loc: GeoLocation, point: { lat: number; lng: number }): boolean {
  const c = loc.catchment;
  if (!c) return false;
  if (c.kind === 'radius') return typeof c.miles === 'number' && nearestMiles(loc, point) <= c.miles;
  return (c.rings ?? []).some(r => ringContains(r, point.lng, point.lat));
}

/** Where a catchment's rings sit — its centroid-ish anchor and a sample of vertices */
function ringPoints(c: Catchment): { lat: number; lng: number }[] {
  return (c.rings ?? []).flatMap(r => r.map(([lng, lat]) => ({ lat, lng })));
}

/**
 * Do two catchments share ground? Radius against radius is one distance
 * check; anything with a polygon is tested by vertices and centres, which
 * misses two polygons that cross only along edges — an acceptable miss for
 * a suggestion. Point-only locations never overlap.
 */
export function catchmentsOverlap(a: GeoLocation, b: GeoLocation): boolean {
  const ca = a.catchment;
  const cb = b.catchment;
  if (!ca || !cb) return false;
  if (ca.kind === 'radius' && cb.kind === 'radius') {
    return distanceMiles(a, b) <= (ca.miles ?? 0) + (cb.miles ?? 0);
  }
  if (catchmentContains(a, b) || catchmentContains(b, a)) return true;
  if (ringPoints(cb).some(p => catchmentContains(a, p))) return true;
  if (ringPoints(ca).some(p => catchmentContains(b, p))) return true;
  return false;
}

/** "serves 1.5 miles around Palmer Square" / "serves ZIP 60647" for a card */
export function describeCatchment(loc: GeoLocation): string | null {
  const c = loc.catchment;
  if (!c) return null;
  if (c.source === 'block') return c.label || loc.label;
  if (c.kind === 'radius' && typeof c.miles === 'number') {
    const mi = c.miles < 1 ? 'about half a mile' : `${c.miles} ${c.miles === 1 ? 'mile' : 'miles'}`;
    // The first two parts of a long label: "Outer Sunset, San Francisco", not the whole chain
    return `${mi} around ${loc.label.split(',').slice(0, 2).join(',').trim()}`;
  }
  return c.label || loc.label;
}

/** Keep a ring under MAX_RING_POINTS by even decimation, closing it */
export function simplifyRing(ring: Ring, max = MAX_RING_POINTS): Ring {
  if (ring.length <= max) return ring;
  const step = ring.length / max;
  const out: Ring = [];
  for (let i = 0; i < ring.length; i += step) out.push(ring[Math.floor(i)]);
  if (out[0] !== out[out.length - 1]) out.push(out[0]);
  return out;
}

/** The outer rings of a GeoJSON geometry, flattened; null for anything that is not an area */
export function ringsFromGeometry(geometry: unknown): Ring[] | null {
  if (!geometry || typeof geometry !== 'object') return null;
  const g = geometry as { type?: string; coordinates?: unknown; geometries?: unknown[] };
  const isRing = (r: unknown): r is Ring =>
    Array.isArray(r) && r.length >= 4 && r.every(p => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1])));
  const clean = (r: Ring): Ring => simplifyRing(r.map(([x, y]) => [Number(x), Number(y)] as [number, number]));
  if (g.type === 'Polygon' && Array.isArray(g.coordinates) && isRing(g.coordinates[0])) return [clean(g.coordinates[0])];
  if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates)) {
    const rings = (g.coordinates as unknown[]).map(poly => (Array.isArray(poly) && isRing(poly[0]) ? clean(poly[0]) : null)).filter((r): r is Ring => !!r);
    return rings.length > 0 ? rings : null;
  }
  if (g.type === 'GeometryCollection' && Array.isArray(g.geometries)) {
    const rings = g.geometries.flatMap(x => ringsFromGeometry(x) ?? []);
    return rings.length > 0 ? rings : null;
  }
  return null;
}

/**
 * A catchment from GeoJSON a person pasted or uploaded — a Feature, a
 * FeatureCollection, or a bare geometry. The first feature's `name`
 * property (or the given label) names it. Null when no area is in it.
 */
export function catchmentFromGeoJson(text: string, source: CatchmentSource = 'geojson', label?: string): Catchment | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  if (!data || typeof data !== 'object') return null;
  const d = data as { type?: string; features?: unknown[]; geometry?: unknown; properties?: Record<string, unknown> };
  let rings: Ring[] | null = null;
  let name: string | undefined;
  if (d.type === 'FeatureCollection' && Array.isArray(d.features)) {
    rings = d.features.flatMap(f => ringsFromGeometry((f as { geometry?: unknown })?.geometry) ?? []);
    const props = (d.features[0] as { properties?: Record<string, unknown> })?.properties;
    name = props ? String(props.name ?? props.NAME ?? props.title ?? '') : '';
    if (rings.length === 0) rings = null;
  } else if (d.type === 'Feature') {
    rings = ringsFromGeometry(d.geometry);
    name = d.properties ? String(d.properties.name ?? d.properties.NAME ?? d.properties.title ?? '') : '';
  } else {
    rings = ringsFromGeometry(d);
  }
  if (!rings) return null;
  return { kind: 'polygon', rings, label: (label ?? '').trim() || name || 'A drawn boundary', source };
}

/** The centre of a catchment's rings — the point to pin a boundary-only place at */
export function centroidOfRings(rings: Ring[]): { lat: number; lng: number } | null {
  const pts = rings.flat();
  if (pts.length === 0) return null;
  const lng = pts.reduce((s, p) => s + p[0], 0) / pts.length;
  const lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
  return { lat, lng };
}

/** Read a catchment off JSON, tolerating anything that isn't one */
export function parseCatchment(raw: unknown): Catchment | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const sources: CatchmentSource[] = ['radius', 'drawn', 'zip', 'neighborhood', 'city', 'county', 'watershed', 'bioregion', 'geojson', 'block', 'other'];
  const edges = r.edges === 'strict' || r.edges === 'rough' ? { edges: r.edges as CatchmentEdges } : {};
  const source = sources.includes(r.source as CatchmentSource) ? (r.source as CatchmentSource) : 'other';
  const label = String(r.label ?? '').slice(0, 160);
  const ref = r.ref ? String(r.ref).slice(0, 120) : undefined;
  if (r.kind === 'radius') {
    const miles = Number(r.miles);
    if (!Number.isFinite(miles) || miles <= 0 || miles > 500) return undefined;
    return { kind: 'radius', miles, label, source, ...(ref ? { ref } : {}), ...edges };
  }
  if (r.kind === 'polygon' && Array.isArray(r.rings)) {
    const rings = (r.rings as unknown[])
      .filter((ring): ring is Ring => Array.isArray(ring) && ring.length >= 4 && ring.every(p => Array.isArray(p) && Number.isFinite(Number(p[0])) && Number.isFinite(Number(p[1]))))
      .map(ring => simplifyRing(ring.map(([x, y]) => [Number(x), Number(y)] as [number, number])));
    if (rings.length === 0) return undefined;
    return { kind: 'polygon', rings, label, source, ...(ref ? { ref } : {}), ...edges };
  }
  return undefined;
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
  const catchment = parseCatchment(r.catchment);
  return {
    lat,
    lng,
    label: String(r.label ?? ''),
    precision: ['neighborhood', 'city', 'region', 'country', 'origin'].includes(precision) ? precision : 'city',
    basis: r.basis ? (String(r.basis) as GeoLocation['basis']) : undefined,
    ...(also && also.length > 0 ? { also } : {}),
    ...(catchment ? { catchment } : {}),
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

// --- Boundaries from OpenStreetMap (Nominatim) ---

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

interface NominatimHit {
  osm_type?: string;
  osm_id?: number;
  display_name?: string;
  name?: string;
  lat?: string;
  lon?: string;
  geojson?: unknown;
}

/**
 * A named boundary — a zip, a neighborhood, a town, a county — as a
 * catchment, from OpenStreetMap through Nominatim with the polygon
 * attached. Returns the point too, so a place can be set from the boundary
 * alone. Nominatim wants one request a second and a named client; the
 * Place dialog calls this once per Save.
 *
 * US ZIP codes mostly have no boundary in OpenStreetMap (ZCTAs are a Census
 * product); those come back as a point with no rings, and the caller falls
 * back to a radius it says is approximate.
 */
export async function resolveBoundary(
  query: string,
  source: Extract<CatchmentSource, 'zip' | 'neighborhood' | 'city' | 'county'>,
  signal?: AbortSignal,
): Promise<{ point: GeoPoint; catchment: Catchment | null } | null> {
  const q = query.trim();
  if (!q) return null;
  // A few hits, not one: the first result for a neighborhood is often its
  // centre node, with the boundary relation a line or two down
  const params = new URLSearchParams({ format: 'jsonv2', polygon_geojson: '1', limit: '5', 'accept-language': 'en' });
  if (source === 'zip') params.set('postalcode', q);
  else params.set('q', q);
  try {
    const res = await fetch(`${NOMINATIM_URL}/search?${params}`, { signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const hits = ((await res.json()) as NominatimHit[]).filter(h => h.lat && h.lon);
    const h = hits.find(x => ringsFromGeometry(x.geojson)) ?? hits[0];
    if (!h || !h.lat || !h.lon) return null;
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    const shortName = (h.display_name ?? '').split(',').slice(0, 3).map(s => s.trim()).join(', ');
    const point: GeoPoint = { lat, lng, label: shortName || h.name || q };
    const rings = ringsFromGeometry(h.geojson);
    const label = source === 'zip' ? `ZIP ${q}` : (h.name || shortName || q);
    const ref = h.osm_type && h.osm_id ? `${h.osm_type}/${h.osm_id}` : undefined;
    return {
      point,
      catchment: rings ? { kind: 'polygon', rings, label, source, ...(ref ? { ref } : {}) } : null,
    };
  } catch {
    return null;
  }
}

// --- Typeahead for the Place dialog ---

export interface PlaceSuggestion extends GeoPoint {
  /** "Chicago, Illinois" — the parts after the name, for the second line */
  context: string;
  osmType?: 'N' | 'W' | 'R';
  osmId?: number;
  osmKey?: string;
  osmValue?: string;
}

export type SuggestKind = 'place' | 'postcode' | 'boundary';

const SUGGEST_TAGS: Record<SuggestKind, string[]> = {
  // Neighborhoods, suburbs, towns, cities, villages — not stations or shops
  place: ['place'],
  postcode: ['place:postcode'],
  // Boundary relations where OpenStreetMap has them, place nodes otherwise
  boundary: ['boundary:administrative', 'place'],
};

/**
 * Suggestions as a person types — Photon is built for this (it is komoot's
 * autocomplete geocoder and allows it; Nominatim's policy does not). Each
 * kind narrows the OpenStreetMap tags so "Logan Square" offers the
 * neighborhood, not the Blue Line station. Picking one is the confirmation:
 * nothing is saved from unpicked text.
 */
export async function suggestPlaces(query: string, kind: SuggestKind, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ q, limit: '6', lang: 'en' });
  for (const t of SUGGEST_TAGS[kind]) params.append('osm_tag', t);
  try {
    const res = await fetch(`${PHOTON_URL}/api/?${params}`, { signal });
    if (!res.ok) return [];
    const data = (await res.json()) as { features?: (PhotonFeature & { properties: Record<string, string | number | undefined> })[] };
    const seen = new Set<string>();
    const out: PlaceSuggestion[] = [];
    for (const f of data.features ?? []) {
      const p = f.properties as Record<string, string | undefined>;
      const name = p.name ?? p.postcode ?? '';
      if (!name) continue;
      const contextParts = [p.district, p.city ?? p.town ?? p.village, p.county, p.state, p.country]
        .filter((v): v is string => !!v && v !== name)
        .filter((v, i, arr) => arr.indexOf(v) === i);
      const context = contextParts.slice(0, 3).join(', ');
      const key = `${name}|${context}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const [lng, lat] = f.geometry.coordinates;
      const osmType = p.osm_type as PlaceSuggestion['osmType'];
      out.push({
        lat, lng, label: context ? `${name}, ${context}` : name, context,
        ...(osmType ? { osmType } : {}),
        ...(p.osm_id ? { osmId: Number(p.osm_id) } : {}),
        ...(p.osm_key ? { osmKey: p.osm_key } : {}),
        ...(p.osm_value ? { osmValue: p.osm_value } : {}),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/**
 * The boundary for a picked suggestion. A relation can be looked up by its
 * id straight away; a place node (most neighborhoods) has its boundary, if
 * any, in a separate relation that a name search finds. One Nominatim call
 * either way, on Save, never while typing.
 */
export async function boundaryForSuggestion(
  s: PlaceSuggestion,
  source: Extract<CatchmentSource, 'zip' | 'neighborhood' | 'city' | 'county'>,
  signal?: AbortSignal,
): Promise<Catchment | null> {
  const name = s.label.split(',')[0].trim();
  if (s.osmType === 'R' && s.osmId) {
    try {
      const params = new URLSearchParams({ osm_ids: `R${s.osmId}`, format: 'jsonv2', polygon_geojson: '1' });
      const res = await fetch(`${NOMINATIM_URL}/lookup?${params}`, { signal, headers: { Accept: 'application/json' } });
      if (res.ok) {
        const hits = (await res.json()) as NominatimHit[];
        const rings = ringsFromGeometry(hits[0]?.geojson);
        if (rings) return { kind: 'polygon', rings, label: source === 'zip' ? `ZIP ${name}` : name, source, ref: `relation/${s.osmId}` };
      }
    } catch { /* fall through to the name search */ }
  }
  const hit = await resolveBoundary(source === 'zip' ? name : s.label, source, signal);
  return hit?.catchment ?? null;
}
