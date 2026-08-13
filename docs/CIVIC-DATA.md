# Live Civic Data (city MCP endpoints)

*Added 2026-08-13, for the Responsive Cities Studio work.*

Partner networks (currently the Responsive Cities Network) run one MCP
server per city, fronting that city's open data portal (ArcGIS Hub or
CKAN). The Builder uses them for three things — the first two live now,
the third is roadmap.

**The endpoint list is not in this repo.** Rows live in the Builder
backend's `city_data_endpoints` table (schema in
`supabase/migrations/20260813180000_city_data_endpoints.sql`), provisioned
by stewards via the Management API and readable by signed-in builders
(RLS). Code stays generic; cities come and go without a deploy.

## (a) Civic data as build context — live

`src/knowledge/civic-data.ts` + `ChatPanel`: on every send, the current
message, recent conversation, and the builder's profile place are matched
against the endpoint list's city names. Matches ride into the system
prompt's volatile tail (`## Live Civic Data Available` in
`context-builder.ts`): the model is told which cities have live data, to
treat open data as a first-class ingredient in plans and chat, and to
prefer reading it live over inventing sample data. A `civic-data` build
event records each match.

## (b) Civic data in live apps — live

The same prompt section teaches the wiring: these MCP servers answer plain
HTTP JSON-RPC (`tools/list`, `tools/call`) with no auth and no SDK, so a
generated app can `fetch` them directly (verified: a bare `tools/list`
POST answers 200 with the city's dataset tools). Guardrails ride with it:
name the data source and freshness in the UI, design the
endpoint-unreachable state, conditions-not-people, keep a human path.

## (c) RB tools as hyperlocal data sources — roadmap

The loop back: certain public data *produced* by relational tech built in
RB (deliberation results, community group maps, curated community
calendars) should become available as hyperlocal open data — candidate
shape: the Neighborhood API spec. Sketch: an opt-in per app ("publish
this tool's public data"), an edge function exposing the consented slice
under a stable schema, and eventually registration so city MCP servers
can read community-generated data back — "public data flows both ways"
(Responsive Cities principle 6). Not started.

## Steward operations

Add or change a city (Management API, never the repo):

```sql
INSERT INTO city_data_endpoints (slug, city, kind, mcp_url, notes)
VALUES ('<slug>', '<City, ST>', 'arcgis|ckan|…', 'https://…/mcp', '<provenance>')
ON CONFLICT (slug) DO UPDATE SET mcp_url = EXCLUDED.mcp_url, active = true;
```

Deactivate: `UPDATE city_data_endpoints SET active = false WHERE slug = '…';`

City matching is by name/slug in conversation + profile text
(`matchCityEndpoints`) — deliberately simple; a false positive costs one
harmless prompt section.
