# Model bench — 2026-11-14T23-42-49-ce73c71-5m40

- **Tasks:** hs-block-sweep (harness 1.2.0, commit `ce73c71`)
- **Date:** 2026-11-14T23:46:31.189Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-block-sweep (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-3.2 | 0/3 ✓ | 0/3 | 2/3 clean | — | — | 3 | 0 | no | 3/5 | 0 | 0 | n/a | 136 lines | 0 | 0/1 | 50.8 | 1s | 63s | — | 63s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **mistral-small-3.2**: mistralai/mistral-small-3.2-24b-instruct, via Parasail

## In the browser (bundled, but)

- **mistral-small-3.2** · hs-block-sweep t1: renders with errors
  - console: Access to script at 'file:///home/user/rb-human-scale/bench/results/2026-11-14T23-42-49-ce73c71-5m40/artifacts/hs-block-sweep/mistral-small-3.2-t1/app.js' from origin 'null' has been blocked by CORS policy: Cross origin 


## Previews

### hs-block-sweep — mistral-small-3.2 (trial 1)

![mistral-small-3.2](shots/hs-block-sweep--mistral-small-3.2-t1.png)

### hs-block-sweep — mistral-small-3.2 (trial 2)

![mistral-small-3.2](shots/hs-block-sweep--mistral-small-3.2-t2.png)

### hs-block-sweep — mistral-small-3.2 (trial 3)

![mistral-small-3.2](shots/hs-block-sweep--mistral-small-3.2-t3.png)
