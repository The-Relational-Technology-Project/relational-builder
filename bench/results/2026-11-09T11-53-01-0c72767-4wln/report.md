# Model bench — 2026-11-09T11-53-01-0c72767-4wln

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `0c72767`)
- **Date:** 2026-11-09T12:00:25.888Z
- **Trials per model per task:** 4
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 4/4 ✓ | 1/4 | 3/4 clean, 1 blank | 3/3 solved | missing-file, other, syntax | 10.5 | 0 | no | 5/5 | 0 | 2.3499999999999996 | 1 | 100.5 lines | 0 | 4.5/6.5 | 206.55 | 1s | 23s | 31s | 23s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 4/4 ✓ | 2/4 | 4/4 clean | 2/2 solved | missing-file, syntax | 9 | 0 | no | 4.5/5 | 0 | 1.55 | 1.5 | 117 lines | 0 | 3.5/6.5 | 88.30000000000001 | 2s | 56s | 6s | 56s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-26b**: google/gemma-4-26b-a4b-it, via DekaLLM / google/gemma-4-26b-a4b-it, via Makora / google/gemma-4-26b-a4b-it, via Io Net / google/gemma-4-26b-a4b-it, via AkashML / google/gemma-4-26b-a4b-it, via NextBit

## In the browser (bundled, but)

- **gemma-4-26b** · hs-community-fridge t2: BLANK PAGE
  - pageerror: The requested module 'react-router-dom' does not provide an export named 'RouterLink'

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t2: build failed to bundle → auto-fix solved in one pass (3s, ~$0.00)
  - triggered by: `vfs:/src/components/ui/avatar.tsx:2: Could not find "@/lib/cn" in the project (imported from /src/components/ui/avatar.tsx)`
- **gemma-4-26b** · hs-community-fridge t3: build failed to bundle → auto-fix solved in one pass (31s, ~$0.00)
  - triggered by: `vfs:/src/pages/Dashboard.tsx: <Calendar> is used but never imported or declared in this file`
- **gemma-4-26b** · hs-community-fridge t4: build failed to bundle → auto-fix solved in 2 passes (46s, ~$0.00)
  - triggered by: `vfs:/src/pages/Home.tsx:3: Expected "from" but found "badge"`
- **gemma-4-26b** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (3s, ~$0.00)
  - triggered by: `vfs:/src/components/ResponseModal.tsx:7: Could not find "@/src/store" in the project (imported from /src/components/ResponseModal.tsx)`
- **gemma-4-26b** · hs-listening-wall t4: build failed to bundle → auto-fix solved in one pass (10s, ~$0.00)
  - triggered by: `vfs:/src/store.ts:30: Expected "}" but found "s"`


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
