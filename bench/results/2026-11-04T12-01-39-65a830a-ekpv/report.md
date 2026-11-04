# Model bench — 2026-11-04T12-01-39-65a830a-ekpv

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `65a830a`)
- **Date:** 2026-11-04T12:09:59.953Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 3/3 ✓ | 1/3 | 2/3 clean, 1 blank | 2/2 solved | bad-import, syntax | 8 | 0 | no | 4/5 | 0 | 2.6 | 5 | 95 lines | 0 | 4/6 | 90.5 | 1s | 38s | 6s | 38s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 3/3 ✓ | 2/3 | 3/3 clean | 1/1 solved | bad-import | 5 | 0 | no | 5/5 | 0 | 1.2 | 4 | 263 lines | 0 | 1/3 | 55.1 | 1s | 70s | 130s | 70s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-26b**: google/gemma-4-26b-a4b-it, via Makora / google/gemma-4-26b-a4b-it, via NextBit / google/gemma-4-26b-a4b-it, via Io Net / google/gemma-4-26b-a4b-it, via PrimeIntellect

## In the browser (bundled, but)

- **gemma-4-26b** · hs-community-fridge t3: BLANK PAGE

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (8s, ~$0.00)
  - triggered by: `vfs:/src/pages/Feed.tsx: No matching export in "vfs:/src/components/ui/textarea.tsx" for import "textarea"`
- **gemma-4-26b** · hs-community-fridge t2: build failed to bundle → auto-fix solved in one pass (4s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:5: Expected "from" but found "import"`
- **gemma-4-26b** · hs-listening-wall t2: build failed to bundle → auto-fix solved in 2 passes (130s, ~$0.01)
  - triggered by: `vfs:/src/App.tsx: No matching export in "vfs:/src/components/ui/select.tsx" for import "option"`


## Previews

### hs-community-fridge — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t1.png)

### hs-community-fridge — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t2.png)

### hs-community-fridge — gemma-4-26b (trial 3)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t3.png)

### hs-listening-wall — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t1.png)

### hs-listening-wall — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t2.png)

### hs-listening-wall — gemma-4-26b (trial 3)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t3.png)
