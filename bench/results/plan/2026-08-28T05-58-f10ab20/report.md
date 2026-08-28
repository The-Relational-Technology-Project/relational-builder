# Plan bench — 2026-08-28T05-58-f10ab20

- **Scenarios:** neighborhood-project, rt-tool-request, open-ended-starter (set p1, harness 1.0.0, commit `f10ab20`)
- **Date:** 2026-08-28T06:00:44.145Z
- **Models:** fable-5 · **trials each:** 1 · **judge:** sonnet-5
- **Pipeline:** live commons retrieval → production plan prompt (`buildPromptContext`) → turn context after TURN_BREAK, production's exact message shape. Anonymous builder (no profile), web tools off.
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices); ~$ includes the judge call.
> Mechanical columns are medians across trials. **Commons drawn** = surfaced entries the reply
> named (production chip matcher) / entries surfaced. Retrieval runs once per scenario per run —
> within-run comparisons share the same surfaced set; the corpus is live, so expect drift across runs.

## Mechanical

### Scenario: neighborhood-project (expects **draft**)

Retrieval: `I want to start a community garden with the neighbors on my block. There's an empty lot on` → 8 surfaced (community-garden, block-party-organizing, neighborhood-connector-site, build-relational-map, build-public-narrative-workshop, community-income-sharing, build-block-scale-pb, community-clubs-platform)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| fable-5 | 10/10 | 2/8 | 0 | 781 | 7s | 30s | $0.15 |

### Scenario: rt-tool-request (expects **draft**)

Retrieval: `Our block already has a group chat but things get lost in it. I want a lending board — a p` → 8 surfaced (tool-library, community-supplies, community-income-sharing, build-living-asset-map, community-clubs-platform, block-party-organizing, build-block-scale-pb, faith-community-care-connector)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| fable-5 | 10/10 | 3/8 | 1 | 771 | 17s | 37s | $0.14 |

### Scenario: open-ended-starter (expects **explore**)

Retrieval: `I keep thinking my street could feel more like an actual neighborhood. People wave, but no` → 8 surfaced (porch-conversations, intersection-repair, block-stewards, an-outer-sunset-story, topic-index, porch-conversations-and-front-porch-culture, build-relational-map, build-local-ushahidi-third-places)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| fable-5 | 6/6 | 5/8 | 0 | 304 | 6s | 14s | $0.11 |

## Failed checks

_None — every trial passed every mechanical check._

## Commons-honesty judge (sonnet-5)

**1 trial(s) fabricated commons citations — read those plans before trusting the rest of their scores.**

- **fable-5** · neighborhood-project t1: referenced 1 (mechanical 2) — The plan draws its core-team size and launch-timeline claims directly and accurately from the Community Garden entry, invents no other sourced facts, and the community framing fits the original community-garden request.
- **fable-5** · rt-tool-request t1: referenced 2 (mechanical 3) · **fabricated: Claim that many real tool libraries 'started exactly here, as an informal inventory of what neighbors already own' — not supported by the Tool Library entry's excerpt** — The plan accurately draws on Tool Library and Community Supplies but invents an unsupported origin-story detail about tool libraries as if it were commons lore.
- **fable-5** · open-ended-starter t1: referenced 5 (mechanical 5) — All specific claims (porch sitting, block stewards, intersection repair details, Josh Nesbit's story opening, the relational map tool) map accurately to entries in the provided knowledge base.

## Human review

_Not scored yet — open review/index.html, score each model per scenario (0–10: RT alignment, creativity, overall — overall counts 2×), export, save as review/scores.json, re-run `npm run bench -- plan report <runDir>`._

## Which model plans best

_Maintainer's call, informed by the human composite first and the tables above — the report feeds the decision, it doesn't make it. The production default lives in `COMMUNITY_PLAN_MODEL` (src/store/community-store.ts)._
