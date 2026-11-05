# Place as the platform: software with a catchment

*Proposal, written 2026-11-05. Builds on [GEO-COMMONS.md](./GEO-COMMONS.md).*

## The idea in a paragraph

Software made in and for a neighborhood should know where it is. Today every
commons item can carry a point: where it was made or where it is rooted. This
proposal adds a second shape, a **catchment**: the area a tool serves. A
catchment is a radius around the point, a drawn boundary, or a named feature
of the land such as a watershed. With catchments, the gallery can answer
"what serves here" instead of only "what is near me," two tools whose
catchments overlap can be introduced to each other, a neighborhood can be
read as a map of its relational tech the way you read its parks and shops,
and a project built in the Builder can carry its place with it into the
prompt, the preview, the published app and the commons.

## What exists

- A location shape (`src/knowledge/geo.ts`): point, label, precision,
  basis, optional `also` places. Stored in `commons_items.metadata.location`
  and as a `location` column on studio items and event codes.
- A Nearby filter in the gallery: one remembered place per browser, a radius
  of 25 to 500 miles, cards show distance to the closest pin.
- A tagging pipeline (`scripts/geotag/`) with `places.json` as the curated
  truth. About half the commons is tagged. Untagged is a real state.
- Regional mode (`src/regions/regions.ts`): a profile setting that reranks
  services and hosts and injects a prompt block. This is the pattern place
  follows, at finer grain.

The current shape models **where software was made**. It does not model
**where software serves**. Precision hints at it (`neighborhood` means
rooted there, `origin` means only made there) but nothing can express "this
tool is for the six blocks between the river and the boulevard."

## What is new

### 1. The catchment shape

One optional field on the existing location, so every row that is tagged
today stays valid and every reader that ignores it keeps working.

```json
{
  "lat": 41.9284, "lng": -87.7068,
  "label": "Logan Square, Chicago, Illinois",
  "precision": "neighborhood",
  "basis": "manual",
  "catchment": {
    "kind": "radius",
    "miles": 1.5,
    "label": "Logan Square and the edges of Avondale"
  }
}
```

Three kinds:

- **radius**: `miles` around the point. The default and the one most people
  will pick. A slider in the UI, not a number field.
- **polygon**: GeoJSON `Polygon` coordinates, drawn or imported. For a
  community that already knows its boundary (a block club's blocks, a
  parish, a mutual aid group's delivery zone).
- **named**: a reference to a feature of the land that resolves to a polygon
  at tag time and is cached with the row. `source` says where it came from.
  First sources: USGS watershed boundaries (HUC-12 is roughly
  neighborhood-sized), then municipal open-data neighborhood boundaries
  where a city publishes them, then bioregions. This is how a tool gets a
  creek as its catchment.

```json
"catchment": {
  "kind": "named",
  "source": "usgs-wbd",
  "ref": "huc12:071200040203",
  "label": "North Branch Chicago River, lower",
  "polygon": [[[-87.71, 41.95], ...]]
}
```

A row with a point and no catchment reads as it does today. A `precision`
of `origin` and a catchment together is a contradiction; the pipeline
rejects it.

### 2. The flipped query: "serves here"

Nearby asks: what is within N miles of me. Serves here asks: which
catchments contain the place I am standing. Point-in-radius is a distance
check we already have; point-in-polygon is a short ray-casting function.
Both run in the browser against the rows the gallery already holds, so no
new query shape on the server.

In the gallery this is a second toggle beside Nearby. Nearby stays for
discovery at distance (a study trip to another city). Serves here is for the
person standing on their own block.

### 3. Overlap is the signal

Two catchments that share ground is the computable version of "find new
connections." Radius against radius is one distance check. Polygon against
polygon can be approximated by sampling or by bounding boxes for the first
pass; exactness does not matter much here because the result is a
suggestion shown to a person, not a gate.

Where it surfaces:

- On a tool's card and page: "Shares ground with 3 other tools" with the
  list.
- In the Builder, when a project has a place: "Three tools already serve
  this area. Want to see them before you build?"
- On a place page as the map itself: where the circles overlap is where the
  conversation is.

### 4. Place pages and the map

A page per place, at `/place/<slug>`, and a map view of the gallery.

The place page is the thing a person in one neighborhood opens to see
another neighborhood's stack. It lists what serves there, grouped the way the
gallery already groups (tools, stories, patterns, builds from event walls),
drawn on a map with catchments as translucent shapes over a plain base. It
is also the page a steward sends to their own neighbors.

The trap: a map of where tools are is a map of where they are not, and empty
ground reads as deficit. Two answers. Empty ground on a place page says
"Nobody has built here yet" with the Builder's door right there and the
nearest tools as examples. And launch with two or three dense places (the
build day cities) rather than a world map with scattered pins.

Base map: this needs tiles or vector data we do not have today. Options in
order of effort: a static illustrated base per launch place (hand-made,
honest, fine for three places), OpenStreetMap raster tiles via a tile proxy
(ODbL, attribution already in the Nearby bar), or Protomaps PMTiles hosted
on our own storage (one file per city, no third-party calls from the
browser, fits the regional mode story). Start with the first, plan for the
third.

### 5. Projects carry place

This is what "place as the platform" means concretely. Regional mode already
does it at the scale of a continent: a setting that changes what the Builder
ranks and injects. Place is the same move at the scale of a neighborhood.

A project gets an optional `place` (the same location shape, catchment
included), set in the project's settings or asked for once by the plan when
the brief names somewhere. From it:

- **The prompt** gets a place block: the label, the catchment in plain words,
  the local civic data endpoints the commons bridge already knows
  (`find-civic-data-endpoints`), and the tools that already serve the area as
  worked examples. "Draw from the place" in the theme contract gets a real
  place to draw from.
- **The preview** gets sensible defaults: map centers, time zone, locale.
- **Publishing** writes the place into the deployed app's metadata and into
  the commons contribution, so the catchment travels with the tool and the
  tagging pipeline has nothing to guess.
- **The commons loop** closes: a tool built for a place shows up on that
  place's page the day it is published.

Place is a thing a person adds, like a photo. Never inferred from IP, never
set by default. A solo builder's project location is often their home; the
geocoder rounds the way the Nearby store already does, to about a
kilometre, and the UI says so.

### 6. Soft gates, not fences

The ask was "maybe even some geo-fenced access, community-driven." The
community-driven part is right. The fence is wrong.

Location gating by IP or GPS is trivially bypassed by anyone acting in bad
faith and reliably excludes people acting in good faith: the person who moved
away but still cares for a parent on the block, the organizer who lives one
street outside the line, anyone on a phone with location off. Front Porch
Forum makes Vermont-only work with address verification and a human, not a
browser check.

The Builder version is a kit component, `PlaceGate`, that a generated app
can include when its brief says the tool is for a place. It asks, orients,
and hands off:

- "This tool is for Humboldt Park. Are you here?" with three answers: I live
  here, I'm visiting or helping, show me my own place.
- Living here opens the tool. Visiting opens it with a note about who it is
  for. The third answer looks up the nearest tools that serve where the
  person actually is and links them.
- The community that runs the tool can add their own step behind it (an
  invite code, an address a steward confirms, a group's existing membership)
  because the gate is a component in their code, not a platform rule.

Nothing is enforced by the browser. The gate states who the tool is for and
trusts people, which is the only version that matches the principles.

### 7. The land, not just the grid

Most catchments will be radii, because that is easy. Named catchments are
the deliberate option for a tool that follows the land: a watershed, a
greenway, a stretch of shoreline, a bioregion. The UI offers them beside the
radius ("or choose a feature of the land") with the shape drawn before the
person commits. A tool whose catchment is a creek is both a real use case
(a water quality logger, a cleanup coordinator, a beaver watch) and a small
statement about who counts as a neighbor.

## Sequencing

Each step ships on its own and is useful without the next.

1. **Catchment on the shape.** Add the field to `GeoLocation`, `parseLocation`,
   `places.json`, the Studio admin's Place editor (a radius slider), and the
   steward's event placement. Point-in-catchment and overlap helpers in
   `geo.ts`. One short pass over `places.json` to give the obviously local
   tools a radius.
2. **Serves here** toggle in the gallery, overlap count on cards.
3. **Place pages** for the two or three launch places, with an illustrated
   base. The map view of the gallery can wait until there is tile hosting.
4. **Projects carry place.** Settings field, prompt block, publish metadata,
   contribution metadata. Mirror the regional mode wiring.
5. **PlaceGate** in the kit, with a prompt rule for when the model reaches
   for it.
6. **Named catchments**, watersheds first, through a small resolver in the
   commons bridge so the browser never calls USGS directly.

Steps 1 and 2 are a few days. Step 4 is the one that changes what the
Builder is.

## Open questions

- **Who sets a catchment on commons items that were tagged by research?** The
  pipeline can propose a radius from precision (neighborhood: 1.5 miles,
  city: 8 miles) but a proposed catchment should look different from one a
  steward drew. Suggest a `basis` on the catchment too.
- **How does a tool with several `also` places get catchments?** Simplest:
  one catchment per place, same kind. Defer anything fancier.
- **What does a place page show for the half of the commons that has no
  place?** Nothing, deliberately. The universal things are in the gallery
  already. A place page is for what is rooted.
- **Should the Builder suggest a place from the brief?** The plan could ask
  "This sounds like it is for a specific neighborhood. Where?" when the brief
  names one. Asking is fine. Filling it in is not.
- **Tile hosting and regional mode.** Protomaps on our own storage keeps map
  loads inside the EU story. Worth deciding before step 3 ships a map that
  calls a US tile server.
