# The commons on a map: geo-tagging and the Nearby filter

*Written 2026-10-22.*

Every item in the commons gallery can carry a place. The gallery's **Nearby**
filter then shows a person what is rooted close to them, from the commons,
their studios' shelves, and the event walls they have been part of, without
anyone having to build a studio for their town first.

## The shape

One shape everywhere (`src/knowledge/geo.ts`):

```json
{
  "lat": 41.9284, "lng": -87.7068,
  "label": "Logan Square, Chicago, Illinois",
  "precision": "neighborhood",
  "basis": "attribution",
  "also": [{ "lat": 40.68, "lng": -74.01, "label": "Red Hook, New York" }]
}
```

- **Where it lives.** Commons rows: `commons_items.metadata.location` (the
  shared commons schema stays column-stable, so it rides in metadata next to
  `image_url`). Builder backend: a `location jsonb` column on
  `studio_library_items` and on `event_codes`. The Studio KB's tools and
  stories are read-only from here; their place sits on the commons' mirror
  of them (the `rt-studio` shelf, keyed by `source_local_id`) and
  `fetchStudioLocations()` joins it back by KB id.
- **Precision** says how rooted the item is: `neighborhood`, `city`,
  `region`, `country`, or `origin`. `origin` is the honest tag for something
  universal (a book, a framework, a design pattern) pinned only where it was
  made. Nearby lists origin pins in a second band, "made there", after what
  is actually rooted in the circle, so a Buy Nothing recipe never reads as a
  Bainbridge Island program to someone on Bainbridge Island.
- **Basis**: `attribution` (a place was already named on the row), `text`
  (named in the body), `research` (looked up while tagging), `manual` (typed
  by a studio admin or steward in the app).
- **also**: other places the item is equally rooted in. Nearby measures to
  the closest.

Untagged is a real state. A distributed network with no home base, a prompt
template, a research library's patterns: these carry no location rather than
a made-up one. Roughly half the commons is like that today.

## The tagging pipeline (`scripts/geotag/`)

1. **`places.json`** is the curated truth: for every commons slug and every
   studio library item id, a place string, a precision, a basis, optional
   `also` places and a note. It was first written by reading every item's
   attribution, summary and body (with web research for unfamiliar
   organizations) under the rules in the file's readme. Edit it by hand to
   correct a pin or place something new.
2. **`node scripts/geotag/geocode.mjs`** turns the distinct place strings
   into coordinates with OpenStreetMap's Nominatim (one request a second,
   cached in `geocode-cache.json`; Photon as the second opinion when
   Nominatim is rate-limiting or finds nothing) and writes `locations.json`.
   A place that will not resolve is listed at the end; fix its spelling and
   run again with `--retry`.
3. **`SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… node scripts/geotag/apply.mjs`**
   writes `locations.json` into both databases through the Management API
   (`--dry-run` to count first). A null entry removes the location, so
   `places.json` stays the whole truth.

Going forward, a place arrives three other ways without the pipeline:

- A **Studio Admin** types a Place on a library item (Studio admin → Library →
  Add/Edit item); the browser geocodes it with Photon on save.
- A **steward** places an event on the Steward page's Codes tab; every build
  on that event's wall and every item on its inspiration shelf is Nearby
  there.
- A **contribution** that names a neighborhood (`attribution.neighborhood`)
  is tagged when the pipeline next runs: add it to `places.json` with basis
  `attribution`.

Pins made for this pass that the taggers were least sure of are noted in
`places.json` (`note`); the obvious review list is anything with precision
`origin` whose note says "from memory".

## Nearby in the gallery

`src/store/nearby-store.ts` remembers one place per browser (the browser's
own location, rounded to about a kilometre and named by reverse geocoding,
or a typed town) and a radius (25, 50, 150 or 500 miles). Nearby is a toggle
beside the search box, not a shelf: it combines with search and with the
shelf picker, and it works on a studio's gallery too. Cards in the circle
show the distance and the closest of their places; the viewer's own event
galleries inside the circle are offered as links.

Geocoding is OpenStreetMap data (ODbL) via Nominatim and komoot's Photon,
credited in the Nearby bar. Nothing about the person's location leaves the
browser except the words they type into the geocoder.
