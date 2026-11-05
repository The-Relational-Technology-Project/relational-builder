# Model bench — 2026-11-01T11-53-13-4134dfa-y02d

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `4134dfa`)
- **Date:** 2026-11-01T11:57:46.753Z
- **Trials per model per task:** 1
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-30b | 0/1 ✓ | 0/1 | n/a | 0/1 solved | missing-file | 10 | 0 | no | 5/5 | 0 | 0.2 | n/a | 131 lines | 0 | 5/7 | 270.8 | 2s | 16s | 17s | 16s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-30b | 0/1 ✓ | 0/1 | n/a | 0/1 solved | missing-file | 6 | 0 | no | 5/5 | 0 | 1.4 | n/a | 345 lines | 0 | 1/3 | 42.9 | 2s | 137s | 99s | 137s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **qwen3-coder-30b** · hs-community-fridge t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/App.tsx:5: Could not find "./pages/Home" in the project (imported from /src/App.tsx)
  - triggered by: `vfs:/src/App.tsx:5: Could not find "./pages/Home" in the project (imported from /src/App.tsx)`
- **qwen3-coder-30b** · hs-listening-wall t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:2: Could not find "./App" in the project (imported from /src/main.tsx)
  - triggered by: `vfs:/src/main.tsx:2: Could not find "./App" in the project (imported from /src/main.tsx)`

