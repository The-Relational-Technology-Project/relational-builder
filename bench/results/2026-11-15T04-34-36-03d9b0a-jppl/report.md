# Model bench — 2026-11-15T04-34-36-03d9b0a-jppl

- **Tasks:** hs-block-sweep (harness 1.2.0, commit `03d9b0a`)
- **Date:** 2026-11-15T04:35:48.778Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-block-sweep (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-31b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 5 | 0 | no | 5/5 | 0 | 0.7 | 0 | 169 lines | 1 | 1/3 | 202.85000000000002 | 2s | 26s | — | 26s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-31b**: google/gemma-4-31b-it, via CoreWeave / google/gemma-4-31b-it, via KT


## Previews

### hs-block-sweep — gemma-4-31b (trial 1)

![gemma-4-31b](shots/hs-block-sweep--gemma-4-31b-t1.png)

### hs-block-sweep — gemma-4-31b (trial 2)

![gemma-4-31b](shots/hs-block-sweep--gemma-4-31b-t2.png)
