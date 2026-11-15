# Model bench — 2026-11-15T04-38-20-03d9b0a-3cdw

- **Tasks:** hs-block-sweep (harness 1.2.0, commit `03d9b0a`)
- **Date:** 2026-11-15T04:41:44.513Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-block-sweep (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3.6-27b | 0/2 ✓ | 0/2 | 2/2 clean | — | — | 1 | 0 | no | 2/5 | 0 | n/a | n/a | 0 lines | 0 | 0/0 | 57.7 | 7s | 97s | — | 97s | 0.02 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **qwen3.6-27b**: qwen/qwen3.6-27b, via DeepInfra / qwen/qwen3.6-27b, via Venice


## Previews

### hs-block-sweep — qwen3.6-27b (trial 1)

![qwen3.6-27b](shots/hs-block-sweep--qwen3.6-27b-t1.png)

### hs-block-sweep — qwen3.6-27b (trial 2)

![qwen3.6-27b](shots/hs-block-sweep--qwen3.6-27b-t2.png)
