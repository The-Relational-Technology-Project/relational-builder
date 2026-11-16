# Model bench — 2026-11-16T11-44-58-82c45f1-4xof

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `82c45f1`)
- **Date:** 2026-11-16T11:54:43.247Z
- **Trials per model per task:** 4
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-31b | 4/4 ✓ | 4/4 | 4/4 clean | — | — | 6 | 0 | no | 4.5/5 | 0 | 0.44999999999999996 | 1 | 226 lines | 0 | 2/4 | 293.85 | 4s | 17s | — | 17s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-31b | 4/4 ✓ | 3/4 | 4/4 clean | 1/1 solved | bad-import | 7.5 | 0 | no | 4/5 | 0 | 0 | 0.5 | 199 lines | 0 | 1/5 | 48.85 | 4s | 119s | 6s | 119s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-31b**: google/gemma-4-31b-it, via NextBit / google/gemma-4-31b-it, via KT / google/gemma-4-31b-it, via CoreWeave

## Fix passes (how solves went)

- **gemma-4-31b** · hs-listening-wall t3: build failed to bundle → auto-fix solved in one pass (6s, ~$0.00)
  - triggered by: `vfs:/src/store.ts: No matching export in "vfs:/src/data/seed.ts" for import "Answer"`


## Previews

### hs-community-fridge — gemma-4-31b (trial 1)

![gemma-4-31b](shots/hs-community-fridge--gemma-4-31b-t1.png)

### hs-community-fridge — gemma-4-31b (trial 2)

![gemma-4-31b](shots/hs-community-fridge--gemma-4-31b-t2.png)

### hs-community-fridge — gemma-4-31b (trial 3)

![gemma-4-31b](shots/hs-community-fridge--gemma-4-31b-t3.png)

### hs-community-fridge — gemma-4-31b (trial 4)

![gemma-4-31b](shots/hs-community-fridge--gemma-4-31b-t4.png)

### hs-listening-wall — gemma-4-31b (trial 1)

![gemma-4-31b](shots/hs-listening-wall--gemma-4-31b-t1.png)

### hs-listening-wall — gemma-4-31b (trial 2)

![gemma-4-31b](shots/hs-listening-wall--gemma-4-31b-t2.png)

### hs-listening-wall — gemma-4-31b (trial 3)

![gemma-4-31b](shots/hs-listening-wall--gemma-4-31b-t3.png)

### hs-listening-wall — gemma-4-31b (trial 4)

![gemma-4-31b](shots/hs-listening-wall--gemma-4-31b-t4.png)
