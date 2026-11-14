# Open models across the place-based demo

*Written 2026-11-14 by a session working on main and neighborhood-agent, not the daily run. It is a
plan and a first set of results. The daily run can pick up the steps marked "next".*

The demo is small software for one place: a neighbor asks the neighborhood's own agent (Knowy) about
their block, then builds a street cleaning reminder for that block in the Builder, designed from
what the neighborhood's commons knows. This page follows that demo step by step and asks, at each
step, which model does the work today and what it would take to do it on a small open one.

## Where each step stands

| Step in the demo | Model today | Open-model arm | How it is measured | Status |
|---|---|---|---|---|
| 1. Knowy answers a neighbor | Claude Haiku 5.5 | Any OpenAI-compatible endpoint (`MODEL_BASE_URL` in neighborhood-agent) | 19 scored questions: `golden.yml` + `golden-block.yml` | First pass done, below |
| 2. Search by meaning in the commons | Voyage embeddings | An open embedding model on the same box (`EMBED_URL` seam exists) | A small set of "plain words to the right record" pairs, hit in top 5 | Not built |
| 3. The place's design brief | No model | Already model-free: search, block lookup, city data | n/a | Done, live on knowy.org |
| 4. The Builder plans | Claude (also under the flag) | Open model for planning | Does the plan open with the block's real facts; do question cards parse | Not started |
| 5. The Builder builds | Sonnet 5 in the demo capture; Gemma 4 26B under the flag | `hs-block-sweep` on Gemma, Mistral Small, GLM, Opus as reference | Working and first try (as now), plus six grounding checks | Task and check added; not run |
| 6. The built app runs | No model | Stays that way: it reads `block.json` | n/a | Done |
| 7. Hardware | Hosted (OpenRouter, Anthropic) | One box in the neighborhood for Knowy's model and embeddings | Tokens a second, watts, cost a question | Not run; no box |

Two of the seven steps use no model at all. That is the main result so far, not a gap: the knowledge
sits in the commons and in plain lookups, so the model's job is small enough for a small model.

## Step 1 results (14 Nov, one pass each, hosted)

Passed of 19: Claude Haiku 5.5 18; Mistral Small 3.2 24B 16; Qwen 3.5 9B with look-first 15; Gemma 4
26B with look-first 14; Ministral 8B 14; Qwen 3.5 9B 11; Gemma 4 26B 8.

- Gemma's failures were nearly all one thing: answering "I don't have that" without calling a tool.
  Making the first move a read-only tool call took it from 8 to 14. This is the same shape as the
  build guards here: a small deterministic rule around the model, not a bigger model.
- A forced first call must be read-only. Before that restriction one model opened with `draft_pr`.
- Every model that looked answered the block questions correctly.
- A pass uses about half a million input tokens, nearly all of it the standing prompt resent each
  round. All eleven passes cost about $0.40. One pass per model is not a measurement.

Full table and every answer: neighborhood-agent `docs/golden-results.md` and `bench/results/`.

## Step 5: what was added to this bench

- `hs-block-sweep` (`bench/tasks.ts`, `--tasks place`): the street cleaning reminder for 46th Ave
  between Moraga and Noriega. The prompt carries the place's design brief, captured from
  knowy.org into `bench/fixtures/place-brief-46-moraga.md`, the way the Builder on main puts it in
  the turn context.
- `scripts/human-scale/place-grounding.mjs <built-app-dir | files.json>`: six checks with no model.
  Reads the block live; both sides' real days; the "signs on the block" line kept; two or more
  sources credited; no location gate; no year the brief never gave (a flag for a person to look at).
  The app Sonnet 5 built in the demo capture scores 6 of 6.

## Next, in order

1. **Run `hs-block-sweep`** on gemma-4-26b (bf16), mistral-small-3.2 and glm-4.5-air, three trials,
   standard flags, then `place-grounding.mjs` on each build. About $0.10. Log it in SPEND first.
2. **Repeat step 1 three times** on Haiku, Mistral Small and Gemma with look-first, so a difference
   of one question can be told from noise. About $0.50.
3. **Shrink Knowy's standing prompt for small models** (it is about 30k tokens a round) and rerun.
4. **Bring main into this branch.** The flag and the place work (area, boundary, block, the Builder
   fetching the brief itself) are on different branches. Josh's call when and how.
5. **Planning on an open model** (step 4), scored on whether the plan opens with the place's facts.
6. **An open embedding model** for search by meaning (step 2).
7. **A box.** Knowy's model and embeddings on hardware in the neighborhood. Needs a machine.

## What would change the default

Knowy moves to an open model by default when, on three repeats, it is within one question of the
reference overall and passes all seven block questions, on a model that fits a 16 to 24 GB box.
Mistral Small 3.2 is the closest today.
