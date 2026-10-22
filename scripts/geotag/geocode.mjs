#!/usr/bin/env node
/**
 * Turn the place names in places.json into coordinates.
 *
 * Reads scripts/geotag/places.json (the curated "where is each item rooted"
 * file), geocodes every distinct place string with OpenStreetMap's Nominatim
 * (one request a second, as its usage policy asks, with a cache so re-runs
 * cost nothing), and writes scripts/geotag/locations.json: the same keys,
 * each with the full geo shape the app reads (lat, lng, label, precision,
 * basis, also[]). apply.mjs writes that into the databases.
 *
 *   node scripts/geotag/geocode.mjs            # geocode what the cache lacks
 *   node scripts/geotag/geocode.mjs --retry    # also retry places that failed before
 *
 * A place Nominatim can't resolve is reported at the end and left without
 * coordinates; fix the spelling in places.json and run again.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PLACES = join(here, 'places.json');
const CACHE = join(here, 'geocode-cache.json');
const OUT = join(here, 'locations.json');
const USER_AGENT = 'relational-builder-geotag/1.0 (humans@relationaltechproject.org)';
const retry = process.argv.includes('--retry');

const places = JSON.parse(readFileSync(PLACES, 'utf8'));
const cache = existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};

/** Every distinct place string across all three sections */
function allPlaceStrings() {
  const set = new Set();
  for (const section of ['commons', 'studio_items']) {
    for (const v of Object.values(places[section] ?? {})) {
      if (v.place) set.add(v.place);
      for (const a of v.also ?? []) set.add(a);
    }
  }
  return [...set];
}

/** A short label from Nominatim's address parts: "Logan Square, Chicago, Illinois" */
function labelFor(place, result) {
  const a = result.address ?? {};
  const local = a.neighbourhood ?? a.suburb ?? a.quarter ?? a.hamlet ?? a.village ?? a.town ?? a.city_district;
  const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  const region = a.state ?? a.region ?? a.province;
  const parts = [local, city, region].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i);
  if (parts.length === 0) return place;
  // Outside the US, the country is part of the name people use
  if (a.country_code && a.country_code !== 'us' && a.country) parts.push(a.country);
  return parts.slice(0, 4).join(', ');
}

async function geocode(place) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=1&accept-language=en&q=${encodeURIComponent(place)}`;
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = await res.json();
  const r = rows[0];
  if (!r) return null;
  return { lat: Number(r.lat), lng: Number(r.lon), label: labelFor(place, r), osm: `${r.osm_type}/${r.osm_id}` };
}

/** Photon (komoot's OSM geocoder) as the second opinion when Nominatim is rate-limiting or finds nothing */
async function geocodePhoton(place) {
  const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(place)}&limit=1&lang=en`);
  if (!res.ok) throw new Error(`Photon ${res.status}`);
  const f = (await res.json()).features?.[0];
  if (!f) return null;
  const p = f.properties;
  const parts = [p.name, p.district, p.city, p.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
  if (p.countrycode && p.countrycode !== 'US' && p.country) parts.push(p.country);
  const [lng, lat] = f.geometry.coordinates;
  return { lat, lng, label: parts.slice(0, 4).join(', ') || place, osm: `photon:${p.osm_type}/${p.osm_id}` };
}

/** Strip the most specific part and try again: "Sal Si Puedes, East San Jose, San Jose, CA, USA" → "East San Jose, San Jose, CA, USA" */
function fallbacks(place) {
  const parts = place.split(',').map(s => s.trim()).filter(Boolean);
  const out = [];
  for (let i = 1; i < parts.length - 1; i++) out.push(parts.slice(i).join(', '));
  return out;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));
/** Nominatim asks for at most one request a second; a shared address may need more room (NOMINATIM_DELAY_MS) */
const DELAY_MS = Number(process.env.NOMINATIM_DELAY_MS ?? 1100);

const todo = allPlaceStrings().filter(p => !(p in cache) || (retry && cache[p] === null));
console.log(`${allPlaceStrings().length} places, ${todo.length} to geocode`);
let n = 0;
for (const place of todo) {
  let hit = null;
  for (const q of [place, ...fallbacks(place)]) {
    try {
      hit = await geocode(q);
    } catch (e) {
      console.warn(`  ! ${q}: ${e.message}`);
    }
    if (!hit) {
      try {
        hit = await geocodePhoton(q);
      } catch (e) {
        console.warn(`  ! ${q}: ${e.message}`);
      }
    }
    await sleep(DELAY_MS);
    if (hit) {
      if (q !== place) hit.via = q;
      break;
    }
  }
  cache[place] = hit;
  n++;
  console.log(`${n}/${todo.length} ${hit ? '✓' : '✗'} ${place}${hit?.via ? ` (via ${hit.via})` : ''}${hit ? ` → ${hit.label}` : ''}`);
  if (n % 10 === 0) writeFileSync(CACHE, JSON.stringify(cache, null, 1));
}
writeFileSync(CACHE, JSON.stringify(cache, null, 1));

// Assemble the locations file
const out = { commons: {}, studio_items: {} };
const missing = new Set();
for (const section of Object.keys(out)) {
  for (const [key, v] of Object.entries(places[section] ?? {})) {
    if (!v.place || v.precision === 'none') { out[section][key] = null; continue; }
    const hit = cache[v.place];
    if (!hit) { missing.add(v.place); out[section][key] = null; continue; }
    const loc = { lat: hit.lat, lng: hit.lng, label: hit.label, precision: v.precision };
    if (v.basis) loc.basis = v.basis;
    const also = (v.also ?? []).map(a => cache[a]).filter(Boolean).map(h => ({ lat: h.lat, lng: h.lng, label: h.label }));
    for (const a of v.also ?? []) if (!cache[a]) missing.add(a);
    if (also.length) loc.also = also;
    out[section][key] = loc;
  }
}
writeFileSync(OUT, JSON.stringify(out, null, 1));
const placed = Object.values(out).reduce((n, s) => n + Object.values(s).filter(Boolean).length, 0);
console.log(`wrote ${OUT}: ${placed} items placed`);
if (missing.size) {
  console.log(`\n${missing.size} places did not geocode (fix the spelling in places.json, then re-run with --retry):`);
  for (const m of missing) console.log(`  - ${m}`);
}
