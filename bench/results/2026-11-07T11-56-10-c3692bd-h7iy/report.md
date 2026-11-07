# Model bench — 2026-11-07T11-56-10-c3692bd-h7iy

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `c3692bd`)
- **Date:** 2026-11-07T12:08:03.155Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-3.2 | 3/3 ✓ | 0/3 | 3/3 clean | 3/3 solved | syntax, bad-import | 10 | 0 | no | 5/5 | 0 | 0.3 | 5 | 131 lines | 1 | 5/7 | 64.1 | 3s | 70s | 21s | 70s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-3.2 | 3/3 ✓ | 2/3 | 3/3 clean | 1/1 solved | bad-import | 10 | 0 | no | 5/5 | 0 | 0.3 | 4 | 205 lines | 0 | 4/7 | 62.1 | 3s | 107s | 6s | 107s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **mistral-small-3.2**: mistralai/mistral-small-3.2-24b-instruct, via Parasail

## Fix passes (how solves went)

- **mistral-small-3.2** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (21s, ~$0.00)
  - triggered by: `vfs:/src/pages/Shifts.tsx:57: Expected ":" but found "re"`
- **mistral-small-3.2** · hs-community-fridge t2: build failed to bundle → auto-fix solved in one pass (13s, ~$0.00)
  - triggered by: `vfs:/src/pages/Inventory.tsx: The requested module 'lucide-react' does not provide an export named 'Bread'`
- **mistral-small-3.2** · hs-community-fridge t3: build failed to bundle → auto-fix solved in one pass (47s, ~$0.00)
  - triggered by: `vfs:/src/pages/Shifts.tsx:6: No matching export in "vfs:/src/components/ui/select.tsx" for import "SelectContent"`
- **mistral-small-3.2** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (6s, ~$0.00)
  - triggered by: `vfs:/src/main.tsx:3: No matching export in "vfs:/src/App.tsx" for import "default"`


## Previews

### hs-community-fridge — mistral-small-3.2 (trial 1)

![mistral-small-3.2](shots/hs-community-fridge--mistral-small-3.2-t1.png)

### hs-community-fridge — mistral-small-3.2 (trial 2)

![mistral-small-3.2](shots/hs-community-fridge--mistral-small-3.2-t2.png)

### hs-community-fridge — mistral-small-3.2 (trial 3)

![mistral-small-3.2](shots/hs-community-fridge--mistral-small-3.2-t3.png)

### hs-listening-wall — mistral-small-3.2 (trial 1)

![mistral-small-3.2](shots/hs-listening-wall--mistral-small-3.2-t1.png)

### hs-listening-wall — mistral-small-3.2 (trial 2)

![mistral-small-3.2](shots/hs-listening-wall--mistral-small-3.2-t2.png)

### hs-listening-wall — mistral-small-3.2 (trial 3)

![mistral-small-3.2](shots/hs-listening-wall--mistral-small-3.2-t3.png)
