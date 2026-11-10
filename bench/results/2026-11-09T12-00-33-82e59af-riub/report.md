# Model bench — 2026-11-09T12-00-33-82e59af-riub

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `82e59af`)
- **Date:** 2026-11-09T12:13:09.572Z
- **Trials per model per task:** 4
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 4/4 ✓ | 3/4 | 4/4 clean | 1/1 solved | other | 8 | 0 | no | 4.5/5 | 0 | 2.4000000000000004 | 0.5 | 117.5 lines | 0 | 3.5/5.5 | 40.55 | 1s | 108s | 24s | 108s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 4/4 ✓ | 2/4 | 3/4 clean, 1 blank | 2/2 solved | syntax | 9 | 0 | no | 4.5/5 | 0 | 2.6 | 1 | 132.5 lines | 0 | 3.5/6.5 | 78.19999999999999 | 1s | 68s | 11s | 68s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-26b**: google/gemma-4-26b-a4b-it, via PrimeIntellect / google/gemma-4-26b-a4b-it, via NextBit / google/gemma-4-26b-a4b-it, via Io Net

## In the browser (bundled, but)

- **gemma-4-26b** · hs-listening-wall t1: BLANK PAGE
  - pageerror: The requested module 'store' does not provide an export named 'useStore'

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t4: build failed to bundle → auto-fix solved in one pass (24s, ~$0.00)
  - triggered by: `vfs:/src/pages/Home.tsx: <RefreshCw> is used but never imported or declared in this file`
- **gemma-4-26b** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (13s, ~$0.00)
  - triggered by: `vfs:/src/data/seed.ts:38: Expected ")" but found "t"`
- **gemma-4-26b** · hs-listening-wall t4: build failed to bundle → auto-fix solved in one pass (9s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:9: Expected "from" but found "<"`


## Previews

### hs-community-fridge — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t1.png)

### hs-community-fridge — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t2.png)

### hs-community-fridge — gemma-4-26b (trial 3)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t3.png)

### hs-community-fridge — gemma-4-26b (trial 4)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t4.png)

### hs-listening-wall — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t1.png)

### hs-listening-wall — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t2.png)

### hs-listening-wall — gemma-4-26b (trial 3)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t3.png)

### hs-listening-wall — gemma-4-26b (trial 4)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t4.png)
