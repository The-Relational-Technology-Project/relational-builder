# Model bench — 2026-11-05T11-42-44-4ab7a98-75w2

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `4ab7a98`)
- **Date:** 2026-11-05T11:57:54.004Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ministral-14b | 1/3 ✓ | 1/3 | 1/1 clean | 0/2 solved | bad-import | 12 | 0 | no | 4/5 | 0 | 1.2 | 7 | 180 lines | 0 | 5/7 | 63.5 | 1s | 90s | 22s | 90s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ministral-14b | 1/2 ✓ | 0/2 | 1/1 clean | 0/2 solved | other, bad-import | 16.5 | 0 | no | 4.5/5 | 0 | 0.4 | 7 | 174.5 lines | 0 | 5.5/9 | 48.3 | 1s | 162s | 95s | 162s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **ministral-14b**: mistralai/ministral-14b-2512, via Mistral

## Fix passes (how solves went)

- **ministral-14b** · hs-community-fridge t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"
  - triggered by: `vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"`
- **ministral-14b** · hs-community-fridge t3: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"
  - triggered by: `vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"`
- **ministral-14b** · hs-listening-wall t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/pages/HomePage.tsx:12: The symbol "setSelectedQuestion" has already been declared
  - triggered by: `vfs:/src/pages/HomePage.tsx:12: The symbol "setSelectedQuestion" has already been declared`
- **ministral-14b** · hs-listening-wall t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/data/seed.ts: No matching export in "vfs:/src/store.ts" for import "Response"
  - triggered by: `vfs:/src/pages/Home.tsx:8: No matching export in "vfs:/src/data/seed.ts" for import "questions"`


## Previews

### hs-community-fridge — ministral-14b (trial 1)

![ministral-14b](shots/hs-community-fridge--ministral-14b-t1.png)

### hs-listening-wall — ministral-14b (trial 2)

![ministral-14b](shots/hs-listening-wall--ministral-14b-t2.png)
