# Model bench — 2026-11-10T11-55-56-8b382fa-sufn

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `8b382fa`)
- **Date:** 2026-11-10T12:11:48.363Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 2/3 ✓ | 2/3 | 2/2 clean | 0/1 solved | bad-import | 11 | 0 | no | 5/5 | 0 | 0.1 | 2 | 143 lines | 0 | 6/9 | 68.9 | 6s | 98s | 75s | 98s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 3/3 ✓ | 1/3 | 2/3 clean, 1 blank | 2/2 solved | other, syntax | 12 | 0 | no | 5/5 | 0 | 0.4 | 13 | 139 lines | 0 | 7/10 | 70.8 | 7s | 177s | 40s | 177s | 0.02 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **glm-4.5-air**: z-ai/glm-4.5-air, via Novita / z-ai/glm-4.5-air, via Z.AI

## In the browser (bundled, but)

- **glm-4.5-air** · hs-listening-wall t1: BLANK PAGE
  - pageerror: answers is not defined

## Fix passes (how solves went)

- **glm-4.5-air** · hs-community-fridge t1: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/src/pages/HomePage.tsx:2: No matching export in "vfs:/src/components/FridgeStatus.tsx" for import "FridgeStatus"
  - triggered by: `vfs:/src/App.tsx:6: No matching export in "vfs:/src/components/ui/bottom-nav.tsx" for import "default"`
- **glm-4.5-air** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (17s, ~$0.00)
  - triggered by: `vfs:/src/pages/Home.tsx: Dynamic require of "@/data/seedData" is not supported (this is an ES module; use import)`
- **glm-4.5-air** · hs-listening-wall t3: build failed to bundle → auto-fix solved in one pass (63s, ~$0.01)
  - triggered by: `vfs:/src/data/seed.ts:69: Expected "}" but found "isAnonymous"`


## Previews

### hs-community-fridge — glm-4.5-air (trial 2)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t2.png)

### hs-community-fridge — glm-4.5-air (trial 3)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t3.png)

### hs-listening-wall — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t1.png)

### hs-listening-wall — glm-4.5-air (trial 2)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t2.png)

### hs-listening-wall — glm-4.5-air (trial 3)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t3.png)
