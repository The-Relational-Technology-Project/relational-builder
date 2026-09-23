# Plan bench — 2026-09-23T15-35-ef1d7eb

- **Scenarios:** neighborhood-project, rt-tool-request, open-ended-starter (set p1, harness 1.0.0, commit `ef1d7eb`)
- **Date:** 2026-09-23T15:41:16.179Z
- **Models:** claude-opus-5-5, claude-fable-5-1 · **trials each:** 1 · **judge:** off
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
| claude-opus-5-5 | 9/10 | 3/8 | — | 1082 | 39s | 60s | $0.06 |
| claude-fable-5-1 | 9/10 | 3/8 | — | 1311 | 57s | 93s | $0.17 |

### Scenario: rt-tool-request (expects **draft**)

Retrieval: `Our block already has a group chat but things get lost in it. I want a lending board — a p` → 8 surfaced (tool-library, community-supplies, community-income-sharing, build-living-asset-map, community-clubs-platform, block-party-organizing, build-block-scale-pb, faith-community-care-connector)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 10/10 | 2/8 | — | 1096 | 47s | 66s | $0.06 |
| claude-fable-5-1 | 10/10 | 2/8 | — | 989 | 71s | 98s | $0.15 |

### Scenario: open-ended-starter (expects **explore**)

Retrieval: `I keep thinking my street could feel more like an actual neighborhood. People wave, but no` → 8 surfaced (porch-conversations, intersection-repair, block-stewards, an-outer-sunset-story, topic-index, porch-conversations-and-front-porch-culture, build-relational-map, build-local-ushahidi-third-places)

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 6/6 | 5/8 | — | 350 | 20s | 24s | $0.04 |
| claude-fable-5-1 | 6/6 | 5/8 | — | 370 | 20s | 26s | $0.10 |

## Failed checks

- **claude-opus-5-5** · neighborhood-project t1: ✗ `first-build-restraint` — first build 9 items, later 16
- **claude-fable-5-1** · neighborhood-project t1: ✗ `sections-present` — missing: The first screen



## Human review

_Not scored yet — open review/index.html, score each model per scenario (0–10: RT alignment, creativity, overall — overall counts 2×), export, save as review/scores.json, re-run `npm run bench -- plan report <runDir>`._

## Which model plans best

_Maintainer's call, informed by the human composite first and the tables above — the report feeds the decision, it doesn't make it. The production default lives in `COMMUNITY_PLAN_MODEL` (src/store/community-store.ts)._
