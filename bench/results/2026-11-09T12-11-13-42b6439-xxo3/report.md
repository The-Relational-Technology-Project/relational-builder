# Model bench — 2026-11-09T12-11-13-42b6439-xxo3

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `42b6439`)
- **Date:** 2026-11-09T12:21:15.963Z
- **Trials per model per task:** 4
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 4/4 ✓ | 1/4 | 4/4 clean | 3/3 solved | bad-import, other | 8 | 0 | no | 4.5/5 | 0 | 2.9 | 0.5 | 94.5 lines | 0 | 4/6 | 92.6 | 1s | 47s | 7s | 47s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 3/4 ✓ | 2/4 | 3/3 clean | 1/2 solved | bad-import, other | 8 | 0 | no | 5/5 | 0 | 3.75 | 0 | 194 lines | 0 | 2.5/5 | 113.85 | 1s | 51s | 53s | 51s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-26b**: google/gemma-4-26b-a4b-it, via NextBit / google/gemma-4-26b-a4b-it, via DekaLLM / google/gemma-4-26b-a4b-it, via Novita / google/gemma-4-26b-a4b-it, via Io Net / google/gemma-4-26b-a4b-it, via Parasail

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (3s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx: The requested module 'lucide-react' does not provide an export named 'Fridge'`
- **gemma-4-26b** · hs-community-fridge t2: build failed to bundle → auto-fix solved in one pass (40s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`
- **gemma-4-26b** · hs-community-fridge t3: build failed to bundle → auto-fix solved in one pass (7s, ~$0.00)
  - triggered by: `vfs:/src/pages/PostPage.tsx: No matching export in "vfs:/src/components/ui/select.tsx" for import "selectProps"`
- **gemma-4-26b** · hs-listening-wall t1: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "App"
  - triggered by: `vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "App"`
- **gemma-4-26b** · hs-listening-wall t3: build failed to bundle → auto-fix solved in 2 passes (44s, ~$0.01)
  - triggered by: `vfs:/src/pages/WallPage.tsx: <DialogDescription> is used but never imported or declared in this file`


## Previews

### hs-community-fridge — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t1.png)

### hs-community-fridge — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t2.png)

### hs-community-fridge — gemma-4-26b (trial 3)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t3.png)

### hs-community-fridge — gemma-4-26b (trial 4)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t4.png)

### hs-listening-wall — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t2.png)

### hs-listening-wall — gemma-4-26b (trial 3)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t3.png)

### hs-listening-wall — gemma-4-26b (trial 4)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t4.png)
