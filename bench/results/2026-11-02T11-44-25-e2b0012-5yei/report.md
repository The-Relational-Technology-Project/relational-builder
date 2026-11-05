# Model bench — 2026-11-02T11-44-25-e2b0012-5yei

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `e2b0012`)
- **Date:** 2026-11-02T12:03:35.550Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 0/3 ✓ | 0/3 | n/a | 0/3 solved | other, bad-import, syntax | 12 | 0 | no | 4/5 | 0 | 2.1 | n/a | 101 lines | 1 | 4/8 | 42.7 | 1s | 104s | 37s | 104s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 0/3 ✓ | 0/3 | n/a | 0/3 solved | syntax, other | 9 | 0 | no | 5/5 | 0 | 1.3 | n/a | 106 lines | 0 | 3/5 | 36 | 3s | 109s | 65s | 109s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix not solved after one pass — still: No entry module found (no index.html module script or /src/main.tsx)
  - triggered by: `No entry module found (no index.html module script or /src/main.tsx)`
- **gemma-4-26b** · hs-community-fridge t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/pages/PostUpdate.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/pages/PostUpdate.tsx: No matching export in "vfs:/src/components/ui/select.tsx" for import "SelectContent"`
- **gemma-4-26b** · hs-community-fridge t3: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/main.tsx:1: Expected ";" but found "react"`
- **gemma-4-26b** · hs-listening-wall t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/main.tsx:1: Expected ";" but found "react"`
- **gemma-4-26b** · hs-listening-wall t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/main.tsx:1: Expected ";" but found "react"`
- **gemma-4-26b** · hs-listening-wall t3: build failed to bundle → auto-fix not solved after one pass — still: No entry module found (no index.html module script or /src/main.tsx)
  - triggered by: `No entry module found (no index.html module script or /src/main.tsx)`

