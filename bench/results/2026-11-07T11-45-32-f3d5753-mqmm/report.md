# Model bench — 2026-11-07T11-45-32-f3d5753-mqmm

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `f3d5753`)
- **Date:** 2026-11-07T11:59:04.818Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-3.2 | 3/3 ✓ | 2/3 | 3/3 clean | 1/1 solved | bad-import | 10 | 0 | no | 5/5 | 0 | 1.3 | 4 | 125 lines | 0 | 5/7 | 63.2 | 3s | 67s | 23s | 67s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-3.2 | 1/3 ✓ | 0/3 | 0/1 clean, 1 blank | 1/3 solved | syntax, missing-file, bad-import | 15 | 0 | no | 4/5 | 0 | 0.8 | 4 | 169 lines | 0 | 4/9 | 66.4 | 3s | 98s | 73s | 98s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **mistral-small-3.2**: mistralai/mistral-small-3.2-24b-instruct, via Parasail

## In the browser (bundled, but)

- **mistral-small-3.2** · hs-listening-wall t2: BLANK PAGE
  - console: ReferenceError: cn is not defined at file:///home/user/relational-builder/bench/results/2026-11-07T11-45-32-f3d5753-mqmm/artifacts/hs-listening-wall/mistral-small-3.2-t2/preview.html:1192:18 at Hi (https://esm.sh/react-d
  - pageerror: cn is not defined

## Fix passes (how solves went)

- **mistral-small-3.2** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (23s, ~$0.00)
  - triggered by: `vfs:/src/pages/Home.tsx:6: No matching export in "vfs:/src/components/ui/select.tsx" for import "SelectTrigger"`
- **mistral-small-3.2** · hs-listening-wall t1: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/src/data/questions.ts:32: Expected "}" but found "s"
  - triggered by: `vfs:/src/data/questions.ts:32: Expected "}" but found "s"`
- **mistral-small-3.2** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (18s, ~$0.00)
  - triggered by: `vfs:/src/main.tsx:4: Could not find "./index.css" in the project (imported from /src/main.tsx)`
- **mistral-small-3.2** · hs-listening-wall t3: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"
  - triggered by: `vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"`


## Previews

### hs-community-fridge — mistral-small-3.2 (trial 1)

![mistral-small-3.2](shots/hs-community-fridge--mistral-small-3.2-t1.png)

### hs-community-fridge — mistral-small-3.2 (trial 2)

![mistral-small-3.2](shots/hs-community-fridge--mistral-small-3.2-t2.png)

### hs-community-fridge — mistral-small-3.2 (trial 3)

![mistral-small-3.2](shots/hs-community-fridge--mistral-small-3.2-t3.png)

### hs-listening-wall — mistral-small-3.2 (trial 2)

![mistral-small-3.2](shots/hs-listening-wall--mistral-small-3.2-t2.png)
