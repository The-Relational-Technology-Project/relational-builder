# Model bench — 2026-11-01T11-57-13-218157a-j9cr

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `218157a`)
- **Date:** 2026-11-01T12:00:17.922Z
- **Trials per model per task:** 1
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 0/1 ✓ | 0/1 | n/a | 0/1 solved | missing-file | 11 | 0 | no | 5/5 | 0 | 2.9 | n/a | 77 lines | 3 | 5/8 | 91.6 | 1s | 42s | 32s | 42s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 1/1 ✓ | 1/1 | 0/1 clean, 1 blank | — | — | 6 | 0 | no | 5/5 | 0 | 1.3 | 10 | 246 lines | 0 | 1/4 | 58 | 1s | 103s | — | 103s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## In the browser (bundled, but)

- **gemma-4-26b** · hs-listening-wall t1: BLANK PAGE
  - console: ReferenceError: React is not defined at WallPage (file:///home/user/relational-builder/bench/results/2026-11-01T11-57-13-218157a-j9cr/artifacts/hs-listening-wall/gemma-4-26b-t1/preview.html:630:35) at Hi (https://esm.sh/
  - pageerror: React is not defined

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/pages/PostPage.tsx:6: Expected ";" but found "react"
  - triggered by: `vfs:/src/pages/HomePage.tsx: Could not find "@/store" in the project (imported from /src/pages/HomePage.tsx)`


## Previews

### hs-listening-wall — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t1.png)
