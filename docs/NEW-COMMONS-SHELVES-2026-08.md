# Two New Commons Shelves — Draft for Review

*Drafted 2026-08-13; approved by Josh and **seeded to the RT Commons the same day** (87 items live, embeddings generated, retrieval verified). The "open items before public pages" below remain the working list.*

Two new shelves for the RT Commons (and, after approval, the RB gallery + public/theme pages):

1. **Community Organizing** (`community-organizing`) — 42 items
2. **Local Civic Tech** (`local-civic-tech`) — 45 items

Draft content: `scripts/seed/community-organizing-commons.json` and `scripts/seed/local-civic-tech-commons.json`.
Seeding (after approval): `SUPABASE_ACCESS_TOKEN=… node scripts/seed-commons-shelf.mjs scripts/seed/<file>.json --apply` — the new `seed-commons-shelf.mjs` upserts the `commons_studios` row and all items keyed on `(slug, kind)`, with a preflight that aborts on cross-shelf slug collisions. All 87 slugs verified collision-free against the live DB (2026-08-13).

## How these were researched

- **Community Organizing** is grounded in a full read of the attached *Organizing: People, Power, Change* handbook (the Ganz / Leading Change Network / New Organizing Institute guide, 2014 Dogwood–Leadnow adaptation), plus web research briefs on the Ross→Chavez→Ganz lineage, the IAF relational tradition, power analysis, and asset-based community development (Kretzmann/McKnight, Cormac Russell, De'Amon Harges).
- **Local Civic Tech** is grounded in a systematic sweep of the **Civic Tech Field Guide** via its public API (506-category taxonomy mapped; ~45 neighborhood-relevant categories enumerated; graveyard included), plus deep tool profiles (licenses checked against repos where possible) and documented hyperlocal deployment stories.
- Every story names real people and places and carries a source URL in its body or `metadata.source_note`. Items flagged `[to verify]` below kept cautious wording.

## Shelf 1: Community Organizing

Framed by the six questions (tagged `question:*` on every item, ready for theme pages):
*Who are my people? · What do we care about? · What resources do we have? · What could we do together? · What commitments do we make to each other? · How did it go — are we stronger now?*

- **3 frameworks** — The Six Questions; People, Power, Change (Ganz definitions); To, For, With, By (Cormac Russell)
- **16 recipes** — the 1:1 relational meeting; the house meeting; public narrative (self/us/now); tracking down the power; theory-of-change sentence; the organizing sentence; the hard ask & three nos; launching a team; the snowflake; campaign timeline; sweet-spot tactics test; coaching in five steps; the debrief; asset map; gift conversations (head/hands/heart); the connectors table
- **13 stories** — Sal Si Puedes (Ross finds Chavez); the grape boycott's boycott houses; Montgomery's 381 days; Highlander's beautician & bus driver; COPS San Antonio; 2008 neighborhood teams; Dudley Street; Logan Square parent mentors; KC Tenants; Moms 4 Housing; the Roving Listener; Savannah's Grants for Blocks; Edmonton's block connectors
- **5 prompts** (RB starter builds) — relational map; public-narrative workshop; power-map canvas; commitment ledger; two-question debrief tool
- **5 references** — the Organizer's Handbook itself; Ganz's *Why Stories Matter*; Ross's *Axioms for Organizers*; the ABCD Green Book; *The Abundant Community*

## Shelf 2: Local Civic Tech

Thesis (lead framework): civic tech doesn't have to be built for your neighborhood to work in your neighborhood — remix **platforms** (open source), **patterns** (adopt-a-thing, public repair ledgers), and **stories**.

- **4 frameworks** — Remix at Neighborhood Scale; Learn from the Graveyard (EveryBlock, Neighborland, PledgeBank + survivor patterns); Six Lessons from Neighborhood Civic Tech (phone-first, paper in the stack, pay stewards, small apps remix best, subtract friction, measure relational outcomes); Design for Care, Not Enforcement
- **20 tools** — Ushahidi, FixMyStreet, Decidim, CONSUL, Pol.is, LocalWiki, Loomio, Cobudget, Mobilizon, Gathio, Open Referral/HSDS, Streetmix, Field Papers+OSM, Terrastories, Mapeo/CoMapeo, Karrot, Human Essentials, Open Food Network, LittleSis+Oligrapher, Stanford PB Platform — each with maker, license, repo, a real deployment, and a one-line neighborhood remix
- **13 stories** — Bed-Stuy Strong; MAMAS pods; Red Hook WiFi + Detroit digital stewards; Front Porch Forum's origin (with the 13k-user study); DavisWiki; E-Democracy's door-knocked forums; Snowmageddon Cleanup; Adopt-a-Hydrant's descendants; 596 Acres; Large Lots Chicago; the 49th Ward PB; Barcelona's neighborhood budget; Disfactory (Taiwan)
- **6 prompts** — third-places map (the local Ushahidi); adopt-a-thing; block-scale PB; living asset map (bridges both shelves); front-porch digest; phone-first mutual aid intake
- **2 references** — the Civic Tech Field Guide itself (CC BY-NC-SA, open API — and it already lists RTP!); City Bureau's Documenters

## Cross-shelf connective tissue

- The `question:*` tags run across both shelves (e.g., LittleSis is tagged to "what could we do together"), so the six questions can drive theme pages spanning organizing *and* tools.
- Responsive Cities Studio: the civic tech shelf is the natural library backbone — the 311-equity research pointers, Decidim/CONSUL/Polis profiles, Documenters, and "Design for Care, Not Enforcement" all speak directly to the studio's principles ("build for the resident who never calls 311," "glass box," "detect conditions, not people").

## Open items before public pages (not blockers for seeding)

1. **License pass** — confirm ~8 repo licenses marked "to confirm" in tool metadata (adopt-a-hydrant, Stanford PB, Field Papers per-repo, Living Lots, HSDS spec license); a round-2 research pass hit the session's usage limit and can be rerun cheaply.
2. **Citation-hardening for the harms framework** — Nextdoor's 2016 redesign figure (~75%, company-reported) and the 311-equity studies need primary citations before public pages (flagged in that item's metadata).
3. **Known date/number variances** are flagged in `source_note`s (DSNI eminent-domain 1988 vs 1989; FPF ~235k vs ~250k members; Montgomery handbill counts).
4. **Possible future additions** (researched but deferred): Ella Baker's group-centered leadership and McAlevey's structure tests (references); Buy Nothing Project; JustFix and PlaceCal (tools); a "who pays, who owns, who maintains" sustainability reference; digitized-organizing tool scan (Empower/Reach/Kumu — the CTFG `relational-organizing` category has 17 live entries).
5. **Give back**: CTFG has no timebanking category and thin tenant-tech coverage — worth submitting our entries back to the guide (app.civictech.guide/add), closing the loop.

## After approval

1. Seed both shelves (`--apply`).
2. Wire gallery shelves in `src/knowledge/commons-items.ts` + `CommonsGallery.tsx` (same pattern as `fetchCivicMediaCards`).
3. Public pages + six-question theme pages.
4. Confirm `search-commons` retrieval picks the new rows up (embedding job).
