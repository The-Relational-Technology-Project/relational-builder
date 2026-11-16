# Model bench — 2026-11-16T11-54-49-8e00cdc-tp42

- **Tasks:** remix-income-sharing (harness 1.2.0, commit `8e00cdc`)
- **Date:** 2026-11-16T12:07:01.651Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: remix-income-sharing (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mistral-small-3.2 | 2/2 ✓ | 2/2 | 1/2 clean, 1 blank | — | — | 16 | 0 | no | 4.5/5 | 0 | 0.55 | 1.5 | 245.5 lines | 0 | 4.5/13 | 25.45 | 3s | 354s | — | 354s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **mistral-small-3.2**: mistralai/mistral-small-3.2-24b-instruct, via DeepInfra

## In the browser (bundled, but)

- **mistral-small-3.2** · remix-income-sharing t1: BLANK PAGE
  - pageerror: Invalid declaration: `py-2 px-4 rounded-md transition-colors`
  - pageerror: Cannot read properties of undefined (reading 'displayName')


## Previews

### remix-income-sharing — mistral-small-3.2 (trial 1)

![mistral-small-3.2](shots/remix-income-sharing--mistral-small-3.2-t1.png)

### remix-income-sharing — mistral-small-3.2 (trial 2)

![mistral-small-3.2](shots/remix-income-sharing--mistral-small-3.2-t2.png)
