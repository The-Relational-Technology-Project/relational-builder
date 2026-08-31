# Plan bench — 2026-08-28T06-05-de004ba

- **Scenarios:** neighborhood-project, rt-tool-request, open-ended-starter (set p1, harness 1.0.0, commit `de004ba`)
- **Date:** 2026-08-28T06:18:53.356Z
- **Models:** fable-5, opus-5 · **trials each:** 3 · **judge:** sonnet-5
- **Pipeline:** live commons retrieval → production plan prompt (`buildPromptContext`) → turn context after TURN_BREAK, production's exact message shape. Anonymous builder (no profile), web tools off.
- **Human review:** scored by Josh

> Cost and token figures are **estimates** (chars ÷ 4 × list prices); ~$ includes the judge call.
> Mechanical columns are medians across trials. **Commons drawn** = surfaced entries the reply
> named (production chip matcher) / entries surfaced. Retrieval runs once per scenario per run —
> within-run comparisons share the same surfaced set; the corpus is live, so expect drift across runs.

## Mechanical

### Scenario: neighborhood-project (expects **draft**)

Retrieval: `I want to start a community garden with the neighbors on my block. There's an empty lot on` → 8 surfaced (community-garden, block-party-organizing, neighborhood-connector-site, build-relational-map, build-public-narrative-workshop, community-income-sharing, build-block-scale-pb, community-clubs-platform)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| fable-5 | 10/10 | 2/8 | 0 | 790 | 6s | 29s | $0.15 |
| opus-5 | 9/10 | 3/8 | 0 | 1315 | 24s | 56s | $0.10 |

### Scenario: rt-tool-request (expects **draft**)

Retrieval: `Our block already has a group chat but things get lost in it. I want a lending board — a p` → 8 surfaced (tool-library, community-supplies, community-income-sharing, build-living-asset-map, community-clubs-platform, block-party-organizing, build-block-scale-pb, faith-community-care-connector)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| fable-5 | 10/10 | 3/8 | 0 | 805 | 15s | 37s | $0.14 |
| opus-5 | 10/10 | 2/8 | 0 | 1299 | 25s | 60s | $0.10 |

### Scenario: open-ended-starter (expects **explore**)

Retrieval: `I keep thinking my street could feel more like an actual neighborhood. People wave, but no` → 8 surfaced (porch-conversations, intersection-repair, block-stewards, an-outer-sunset-story, topic-index, porch-conversations-and-front-porch-culture, build-relational-map, build-local-ushahidi-third-places)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| fable-5 | 5/6 | 5/8 | 0 | 381 | 7s | 15s | $0.12 |
| opus-5 | 5/6 | 5/8 | 0 | 399 | 11s | 18s | $0.06 |

## Failed checks

- **fable-5** · neighborhood-project t2: ✗ `sections-present` — missing: The first screen
- **opus-5** · neighborhood-project t2: ✗ `sections-present` — missing: The first screen
- **opus-5** · neighborhood-project t3: ✗ `sections-present` — missing: The first screen
- **fable-5** · open-ended-starter t1: ✗ `explore-brevity` — 294 words before the question section
- **fable-5** · open-ended-starter t3: ✗ `explore-brevity` — 280 words before the question section
- **opus-5** · open-ended-starter t1: ✗ `explore-brevity` — 282 words before the question section
- **opus-5** · open-ended-starter t2: ✗ `explore-brevity` — 287 words before the question section
- **opus-5** · open-ended-starter t3: ✗ `explore-brevity` — 293 words before the question section

## Commons-honesty judge (sonnet-5)

**2 trial(s) fabricated commons citations — read those plans before trusting the rest of their scores.**

- **fable-5** · neighborhood-project t1: referenced 1 (mechanical 2) — The plan explicitly and accurately draws on the Community Garden entry (bonding/bridging capital, 5-10 core team, 6-12 month timeline) and invents no other sourced claims, while the request itself was already about a community garden so no shoehorning occurred.
- **fable-5** · neighborhood-project t2: referenced 1 (mechanical 2) — The plan explicitly and accurately draws on the Community Garden entry (core team size, 6-12 month launch timeline) and otherwise sticks to invented flyer/outreach specifics, so nothing is fabricated as sourced.
- **fable-5** · neighborhood-project t3: referenced 1 (mechanical 3) — The plan draws directly and accurately on the Community Garden entry's team size, bonding/bridging capital, and 6–12 month timeline, without inventing outside sources, and the community framing is appropriate since the request was inherently about organizing neighbors for a garden.
- **opus-5** · neighborhood-project t1: referenced 2 (mechanical 3) — The plan accurately draws on the Community Garden entry's social-capital and team-size details and the Block Party Organizing entry's role-card/roster features, both correctly attributed, with no invented sourcing and no forced community framing since the request was already about a garden.
- **opus-5** · neighborhood-project t2: referenced 2 (mechanical 3) · **fabricated: Community Cloud** — The plan legitimately draws on the Community Garden entry's timeline/team-size/social-capital details and the Block Party Organizing entry's volunteer role-card pattern, but invents a named service ('Community Cloud') not present in the knowledge base.
- **opus-5** · neighborhood-project t3: referenced 2 (mechanical 3) — The plan accurately draws on the Community Garden entry's team size, capital types, and timeline, and legitimately borrows the Block Party Organizing prompt's shift-card pattern, without fabricating any outside sources.
- **fable-5** · rt-tool-request t1: referenced 2 (mechanical 3) — The plan explicitly and accurately draws on the Tool Library (drill math, growth stats) and Community Supplies (photos/categories/condition tags) entries, uses the user's own corkboard description for styling (not KB), and invents no external sourced claims beyond generic tech choices like Supabase.
- **fable-5** · rt-tool-request t2: referenced 2 (mechanical 3) — The plan accurately draws on Tool Library's stats and rationale and Community Supplies' 'who referred you?' trust detail, with no invented citations, and the request was already about neighbors so no shoehorning occurred.
- **fable-5** · rt-tool-request t3: referenced 2 (mechanical 3) — The plan accurately draws on the Tool Library (200-drills math, growth path to shared collection) and Community Supplies (filter/tag system, landing-page onboarding) excerpts without inventing false attributions; 'Community Cloud (Supabase)' is a generic tech suggestion, not claimed as a KB source.
- **opus-5** · rt-tool-request t1: referenced 2 (mechanical 2) — The plan accurately draws on the Tool Library and Community Supplies entries (including their stats and tradeoffs) without inventing any other commons sources.
- **opus-5** · rt-tool-request t2: referenced 2 (mechanical 3) — Both citations (Tool Library's math/costs, Community Supplies' feature list) accurately reflect the provided excerpts and are used honestly as contrast points; the request was already about a neighbor sharing board, so no shoehorning occurred.
- **opus-5** · rt-tool-request t3: referenced 2 (mechanical 2) · **fabricated: Community Cloud (Supabase)** — The plan legitimately draws on Tool Library and Community Supplies with accurate details from their excerpts, but invents 'Community Cloud (Supabase)' as if it were a named platform/service rather than just citing Supabase as a generic tool.
- **fable-5** · open-ended-starter t1: referenced 5 (mechanical 5) — All named practices are genuinely drawn from KB entries, though the claim that 'An Outer Sunset Story' 'worked through moves like these' (porch sitting, stewarding, intersection repair) goes beyond what the excerpt actually shows and is an unverified embellishment of a real entry's content.
- **fable-5** · open-ended-starter t2: referenced 5 (mechanical 5) — The plan draws accurately on five real knowledge-base entries without inventing external sources, and the community framing is appropriate since the user's question was explicitly about neighborhood connection.
- **fable-5** · open-ended-starter t3: referenced 5 (mechanical 5) — All cited items map to real KB entries with content faithfully represented, and the query was genuinely about neighborhood community-building.
- **opus-5** · open-ended-starter t1: referenced 3 (mechanical 3) — The plan draws accurately on three real KB entries (Porch Conversations, Block Stewards, Relational Map) without inventing fake sources, and the community framing is appropriate since the user's ask was literally about neighbors.
- **opus-5** · open-ended-starter t2: referenced 5 (mechanical 5) — The plan draws directly and accurately on five knowledge-base entries without inventing outside sources, and the community framing is appropriate since the user explicitly asked about neighborhood connection.
- **opus-5** · open-ended-starter t3: referenced 5 (mechanical 5) — All cited items correspond to real knowledge-base entries with content accurately represented, and the request was genuinely about neighborhood community-building.

## Human review (scored by Josh)

Composite = (RT + Creativity + 2×Overall) / 4, out of 10.

| Rank | Model | Mean composite | Scenarios scored |
|---|---|---|---|
| #1 | opus-5 | 8.0 | 3/3 |
| #2 | fable-5 | 6.9 | 3/3 |

### neighborhood-project

| Model | RT alignment | Creativity | Overall (×2) | Composite | Notes |
|---|---|---|---|---|---|
| fable-5 | 8 | 6 | 7 | 7.0 | |
| opus-5 | 9 | 7 | 8 | 8.0 | |

### rt-tool-request

| Model | RT alignment | Creativity | Overall (×2) | Composite | Notes |
|---|---|---|---|---|---|
| fable-5 | 7 | 6 | 7 | 6.8 | |
| opus-5 | 9 | 7 | 8 | 8.0 | |

### open-ended-starter

| Model | RT alignment | Creativity | Overall (×2) | Composite | Notes |
|---|---|---|---|---|---|
| fable-5 | 8 | 6 | 7 | 7.0 | |
| opus-5 | 8 | 8 | 8 | 8.0 | |

## Which model plans best

_Maintainer's call, informed by the human composite first and the tables above — the report feeds the decision, it doesn't make it. The production default lives in `COMMUNITY_PLAN_MODEL` (src/store/community-store.ts)._
