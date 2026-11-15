# Which open model for which job

*Written 2026-11-15 by a session working on the place-based demo, not the daily run. A screen, not
a verdict: most cells are one or two tries. Sizes and licenses were checked on the makers' own
model cards that day; memory figures marked 3P are third-party.*

The system asks a model to do three different jobs. This page tests whether different open models
suit each, on the same demo (a street cleaning reminder for one block in the Outer Sunset).

1. **Knowy answers a neighbor.** Call the right lookup, say what it returned, cite it, know when to
   stop. 19 scored questions (`neighborhood-agent`: `golden.yml`, `golden-block.yml`).
2. **The Builder plans.** Read the place's design brief, open with what exists and who to talk to,
   ask two good questions. One real plan request, eight plain checks
   (`scripts/human-scale/plan-screen.mjs`; the plans are in `screens/2026-11-15-plans/`).
3. **The Builder builds.** Write a working app from the plan and the brief. `--tasks place`, with
   six grounding checks on the built files (`place-grounding.mjs`).

## Results

Fits a box = runs on a 16 to 24 GB GPU or a 32 GB Mac at 4-bit, per the maker or (3P) a third party.

| Model | Size, license | Fits a box | Knowy, of 19 | Plan, of 8 | Build: working / first try; grounding of 6 |
|---|---|---|---|---|---|
| Claude Haiku 5.5 (reference) | closed | no | 17.5 mean of 4 | 8 | not run |
| Claude Sonnet 5 (reference) | closed | no | not run | 7 | demo capture: built, 6 |
| **Gemma 4 31B** | 30.7B dense, Apache 2.0 | 17.5 GB | 15 | 7 | 2/2, 2/2; 5, 6 |
| **Gemma 4 26B A4B** | 25.2B, 3.8B active, Apache 2.0 | 14.4 GB | 8; 14 with look-first (3 passes) | 6 | 3/3, 3/3; 5, 6, 6 |
| **Mistral Small 3.2** | 24B dense, Apache 2.0 | about 15 GB (3P) | 16.0 mean of 4 | 7 | 0/3 (single page; 2/3 opened); 6, 4, 6 |
| Qwen 3.8 27B | 27B dense, Apache 2.0 | not stated | 14 | 8 | 1 of 1 so far, 375s; 5 |
| Qwen 3.6 27B | 27B dense, Apache 2.0 | about 17 GB (3P) | 11 | 8 | 0/2 (single page; 2/2 opened); 6, 6 |
| Qwen 3.6 35B-A3B | 35B, 3B active, Apache 2.0 | 22 to 24 GB (3P) | 9 | 7 | 1/2, 0/2; 6, 6 |
| Qwen 3.5 9B | 9B, Apache 2.0 | about 6 GB (3P) | 11; 15 with look-first | not run | not run |
| Ministral 3 8B | 8.4B, Apache 2.0 | under 12 GB | 14 | not run | not run |
| Granite 4.2 8B | 8B, Apache 2.0 | not stated | 14 | 7 (too long) | not run |
| Nemotron 3.5 Lightning | 30B, 3B active, OpenMDW-1.1 | not stated | 9 | 8, in 3s | 0/2, did not open; 5, 2 |
| LFM2.5-24B-A2B | 24B, 2B active, LFM Open License | 15 to 16 GB (3P) | 11 | empty reply | not run |
| LFM3 1.7B | 1.7B, LFM Open License | about 1 GB | 10 | not run | not run |
| Mistral Small 4 | **119B**, 6.5B active, Apache 2.0 | **no** | 15 | 6 | 0/2 (single page; 2/2 opened); 6, 6 |
| GLM-5.3-Flash | **320B**, 18B active, MIT | **no** | 17 | 7 | not run |
| GLM 4.5 Air | **106B**, 12B active, MIT | **no** | not run | not run | 0/3; 3, 5, 5 |

## What it says

- **The jobs do sort the models differently.** Mistral Small 3.2 is the best box-size model at
  answering neighbors and does not write the app shape. Nemotron 3.5 Lightning wrote one of the two
  best plans in three seconds, and was near the bottom at answering neighbors and could not build.
  Qwen 3.6 27B plans well and is slow and weak at Knowy's lookups.
- **But one generalist is close on all three.** Gemma 4 31B: 15 of 19 for Knowy without any help,
  a good plan, and a working app both tries in 26 seconds. A neighborhood box holds one model in
  memory at a time, so a generalist that is second-best everywhere may beat three specialists.
- **For builds, Gemma leads here, against the outside consensus.** Reviews say "Qwen for code".
  In this harness Gemma 4 built the app every try and the Qwens mostly did not. The harness has
  been tuned around Gemma for two weeks, so this may be the harness as much as the model.
- **"Small" and "Flash" in a name do not mean small.** Mistral Small 4 is 119B, GLM-5.3-Flash 320B,
  GLM 4.5 Air 106B. They are open-weight and cheap when hosted, and none fits a community box. GLM
  4.5 Air has been a transfer model in this program; it bounds what open can do, like gpt-oss-120b.
- **Grounding is mostly a property of the prompt, not the model.** Nearly every model that produced
  something scored 5 or 6 of 6. The brief does the work.
- **Liquid's models carry a license to read first.** Free commercial use below $10M revenue, with a
  nonprofit exemption for non-commercial or research use. They also scored low here.

## What to try next

1. **Gemma 4 31B on Knowy with look-first**, three passes. If it reaches Mistral Small's 16, it is
   the one-model answer for a 24 GB box.
2. **Repeat the plan screen** three times on Gemma 4 31B, Qwen 3.8 27B and Nemotron, and have Josh
   read them. One call each and eight crude checks is not enough to pick a planner.
3. **Give the Qwens a fair build run**: the fix passes and guards were shaped by Gemma's mistakes.
4. **An open embedding model** for Knowy's search: `granite-embedding-english-r2` (149M, Apache
   2.0) or `Qwen3-Embedding-0.6B` (Apache 2.0). Neither tested.

## Caveats

One or two tries per cell except where a mean is given. All hosted through OpenRouter; nothing ran
on a box, and hosted speed says little about local speed. The plan checks reward form. Qwen 3.8
27B's second build was still running when this was written. Knowy on production uses Claude Sonnet
5.5, which was not run as a reference.
