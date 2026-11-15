# Model bench — 2026-11-15T05-31-05-c24ef82-6ozt

- **Tasks:** hs-block-sweep (harness 1.2.0, commit `c24ef82`)
- **Date:** 2026-11-15T05:31:44.397Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-block-sweep (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 0/3 ✓ | 0/3 | 3/3 clean | — | — | 2 | 0 | no | 2/5 | 0 | 0 | n/a | 0 lines | 0 | 0/0 | 259.8 | 3s | 8s | — | 8s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gpt-oss-120b**: openai/gpt-oss-120b, via Google


## Previews

### hs-block-sweep — gpt-oss-120b (trial 1)

![gpt-oss-120b](shots/hs-block-sweep--gpt-oss-120b-t1.png)

### hs-block-sweep — gpt-oss-120b (trial 2)

![gpt-oss-120b](shots/hs-block-sweep--gpt-oss-120b-t2.png)

### hs-block-sweep — gpt-oss-120b (trial 3)

![gpt-oss-120b](shots/hs-block-sweep--gpt-oss-120b-t3.png)
