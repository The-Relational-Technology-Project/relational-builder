# Model bench — 2026-11-15T05-31-03-c24ef82-rln4

- **Tasks:** hs-block-sweep (harness 1.2.0, commit `c24ef82`)
- **Date:** 2026-11-15T05:34:33.907Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-block-sweep (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-next | 2/3 ✓ | 1/3 | 3/3 clean | 1/1 solved | other | 5 | 0 | no | 5/5 | 0 | 1.15 | 1 | 261 lines | 0 | 1/3 | 98.2 | 1s | 57s | 13s | 57s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **qwen3-coder-next**: qwen/qwen3-coder-next, via Parasail

## Fix passes (how solves went)

- **qwen3-coder-next** · hs-block-sweep t1: build failed to bundle → auto-fix solved in one pass (13s, ~$0.00)
  - triggered by: `No entry module found (no index.html module script or /src/main.tsx)`


## Previews

### hs-block-sweep — qwen3-coder-next (trial 1)

![qwen3-coder-next](shots/hs-block-sweep--qwen3-coder-next-t1.png)

### hs-block-sweep — qwen3-coder-next (trial 2)

![qwen3-coder-next](shots/hs-block-sweep--qwen3-coder-next-t2.png)

### hs-block-sweep — qwen3-coder-next (trial 3)

![qwen3-coder-next](shots/hs-block-sweep--qwen3-coder-next-t3.png)
