# Model bench — 2026-11-02T12-05-06-902809c-n3q4

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `902809c`)
- **Date:** 2026-11-02T12:25:00.616Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 0/3 ✓ | 0/3 | n/a | 0/3 solved | other, syntax | 8 | 0 | no | 5/5 | 0 | 2.6 | n/a | 70 lines | 0 | 5/6 | 27.1 | 2s | 140s | 19s | 140s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 0/2 ✓ | 0/2 | n/a | 0/2 solved | syntax | 16 | 0 | no | 5/5 | 0 | 2.4 | n/a | 147 lines | 0 | 4/12 | 31.55 | 3s | 266s | 47s | 266s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix not solved after one pass — still: No entry module found (no index.html module script or /src/main.tsx)
  - triggered by: `No entry module found (no index.html module script or /src/main.tsx)`
- **gemma-4-26b** · hs-community-fridge t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/main.tsx:1: Expected ";" but found "react"`
- **gemma-4-26b** · hs-community-fridge t3: build failed to bundle → auto-fix not solved after one pass — still: No entry module found (no index.html module script or /src/main.tsx)
  - triggered by: `No entry module found (no index.html module script or /src/main.tsx)`
- **gemma-4-26b** · hs-listening-wall t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/main.tsx:1: Expected ";" but found "react"`
- **gemma-4-26b** · hs-listening-wall t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:1: Expected ";" but found "react"
  - triggered by: `vfs:/src/main.tsx:1: Expected ";" but found "react"`

