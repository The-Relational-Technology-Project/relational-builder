# Model bench — 2026-11-01T11-50-25-7f84f05-gxzk

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `7f84f05`)
- **Date:** 2026-11-01T11:54:07.593Z
- **Trials per model per task:** 1
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 1/1 ✓ | 0/1 | 1/1 clean | 1/1 solved | bad-import | 15 | 0 | no | 5/5 | 0 | 0.5 | 3 | 176 lines | 0 | 3/13 | 92.1 | 7s | 66s | 23s | 66s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 0/1 ✓ | 0/1 | 0/1 clean | — | — | 3 | 0 | no | 3/5 | 0 | 0 | 0 | 201 lines | 0 | 0/1 | 45.8 | 46s | 124s | — | 124s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## In the browser (bundled, but)

- **glm-4.5-air** · hs-listening-wall t1: renders with errors
  - console: Failed to load resource: net::ERR_FILE_NOT_FOUND
  - console: Failed to load resource: net::ERR_FILE_NOT_FOUND

## Fix passes (how solves went)

- **glm-4.5-air** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (23s, ~$0.00)
  - triggered by: `vfs:/src/pages/HomePage.tsx:7: No matching export in "vfs:/src/components/ui/avatar.tsx" for import "AvatarFallback"`


## Previews

### hs-community-fridge — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t1.png)

### hs-listening-wall — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t1.png)
