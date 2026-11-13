# Place packs: a neighborhood's commons as build material

*Written 2026-11-07. First pack: the Outer Sunset, served by Knowy Plover (knowy.org).*

A place pack is a neighborhood's own public data, kept by neighbors in a
public repo, reviewed by stewards, and served by a steward agent. The Builder
reads it the way it reads city open data ([CIVIC-DATA.md](./CIVIC-DATA.md)),
and builds can give back to it. It is the first working piece of part (c)
there ("public data flows both ways") and the content half of step 4 in
[PLACE-AS-PLATFORM.md](./PLACE-AS-PLATFORM.md) ("projects carry place").

## The two doors a pack serves

- `GET <site>/place.json`: it leads with the same fields a published
  Builder app's `/place.json` carries (v1: `version`, `generator`, `name`,
  `lat`, `lng`, `label`, `precision`, `catchment`), so a crawler drawing the
  map of place-based software reads a pack like any app. Then the pack: what the place is (label, center, catchment as a
  radius, time zone), every source with its license and freshness, the
  constituents and their advocates, the rules that travel with the data, and
  how a tool can give back (feed formats and record shapes).
- `POST <site>/mcp`: an open MCP server, JSON-RPC over HTTP, no auth, CORS
  open, the same transport as the city servers. Tools: `about_place`,
  `design_brief`, `live_endpoints`, `search`, `list`, `get`, `about_block`,
  `vital_signs`, `city_311`, `suggest_source`.
  Unlike the city portals, replies carry `structuredContent` (a `records`
  array) next to the prose.

A build for a place goes in three steps, and the pack has a tool for each:

1. **Design:** `design_brief` takes the idea in a sentence (and a block or
   corner) and returns what already exists that does something similar, what
   neighbors have asked for, who to talk to first, the notes on that block,
   the constituents a plan might touch, the place's voice, and the live URL
   for each kind of record the idea touches. It leads with people.
2. **Content:** `search` and `list`. Where the place has turned it on, search
   blends full-text with closeness in meaning.
3. **Wiring:** `live_endpoints` returns the plain URLs a built app fetches
   (`GET <site>/records.json`, `<site>/block.json`), with sources, licenses,
   and a snippet.

What's in it: nothing a neighbor couldn't already read on the pack's site.
The pack reads the same index the site's chat does, with the same privacy
filters (people only as listed, recommendations for individuals left out,
311 at block level).

## How the Builder uses it

A row in `city_data_endpoints` with `kind = 'place'`. Two ways to match.
By name, the same as cities (`matchCityEndpoints`): the row's `city` is the
place's name, so "Outer Sunset, San Francisco" matches "outer sunset" in the
conversation or the builder's profile. By ground
(`matchPlacePacksByGround`): when the project carries a place, the Builder
reads the head of each pack's `/place.json` and matches when the project's
point falls inside the pack's catchment or the two catchments overlap, so a
project pinned to a corner finds its neighborhood's pack without the name. `formatCivicDataForPrompt` sends place
rows to their own section (`formatPlacePacksForPrompt`), not the city portal
notes, which would be wrong for them. With web tools on, the pack is
attached as an MCP server and the model can call it while planning.

The prompt section asks the model to:

- ground plans in the pack's real records and point to what already exists
  before building a duplicate;
- read it live in apps, from `structuredContent`, cached a day at most so a
  neighbor's correction reaches every app;
- follow the rules that travel with the data (credit, freshness, people,
  block-level 311, constituents' advocates);
- give back: publish the build's public data as a feed (.ics, Neighborhood
  API JSON, RSS, CSV) and, with the person's yes, suggest it to the place's
  stewards with `suggest_source`. A steward decides; nothing enters the
  commons automatically.

## Adding a place

Steward operation, Management API, never the repo:

```sql
INSERT INTO city_data_endpoints (slug, city, kind, mcp_url, notes)
VALUES ('outer-sunset', 'Outer Sunset, San Francisco', 'place', 'https://knowy.org/mcp',
        'Place pack: neighbor-kept commons, served by Knowy Plover. Repo: The-Relational-Technology-Project/outer-sunset')
ON CONFLICT (slug) DO UPDATE SET mcp_url = EXCLUDED.mcp_url, kind = EXCLUDED.kind, active = true;
```

Any neighborhood running the neighborhood agent (code:
`neighborhood-agent`, data: a repo shaped like `outer-sunset`) gets a pack
for free: set `center`, `catchment_miles`, `catchment_label`, `place_label`,
and `place_about` lines at the end of its `place.md`.

## Not yet

- Ground matching reads every registered pack's `/place.json` from the
  browser. Fine for a handful of packs; with dozens, store each pack's
  centre and catchment on its row and match in one query.
- No kit component for "publish this app's public data as a feed" yet; the
  model writes the feed per build. Worth a kit piece once two or three builds
  have done it by hand.
- Writing records (not just suggesting feeds) back to a pack would go
  through the agent's signed-draft flow. Wait for demand.
