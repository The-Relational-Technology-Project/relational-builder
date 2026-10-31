# Model bench — 2026-10-31T10-47-fffea84

- **Tasks:** hs-listening-wall (harness 1.2.0, commit `fffea84`)
- **Date:** 2026-10-31T10:59:00.978Z
- **Trials per model per task:** 1
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-30b | 0/1 ✓ | 0/1 | n/a | 0/1 solved | missing-file | 20 | 0 | no | 4/5 | 0 | 1.3 | 155 lines | 0 | 9/13 | 75.6 | 2s | 100s | 188s | 100s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **qwen3-coder-30b** · hs-listening-wall t1: build failed to bundle → auto-fix not solved — still: vfs:/src/App.tsx:8: Could not find "./data/questions" in the project (imported from /src/App.tsx)
  - triggered by: `vfs:/src/App.tsx:8: Could not find "./data/questions" in the project (imported from /src/App.tsx)`

