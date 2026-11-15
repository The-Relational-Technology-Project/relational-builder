# Model bench — 2026-11-15T04-34-36-03d9b0a-620t

- **Tasks:** hs-block-sweep (harness 1.2.0, commit `03d9b0a`)
- **Date:** 2026-11-15T04:37:15.515Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-block-sweep (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nemotron-3.5-lightning | 0/2 ✓ | 0/2 | n/a | 0/2 solved | syntax, missing-file | 14.5 | 0 | no | 3.5/5 | 0 | 23.8 | n/a | 60.5 lines | 1.5 | 1.5/4 | 257.70000000000005 | 1s | 35s | 43s | 35s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **nemotron-3.5-lightning**: nvidia/nemotron-3.5-lightning, via DeepInfra

## Fix passes (how solves went)

- **nemotron-3.5-lightning** · hs-block-sweep t1: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/src/pages/StreetPage.tsx:87: Expected ">" but found "<"
  - triggered by: `vfs:/src/pages/StreetPage.tsx:86: Expected "..." but found "\" \""`
- **nemotron-3.5-lightning** · hs-block-sweep t2: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/main.tsx:2: Could not find "@/index.css" in the project (imported from /main.tsx)
  - triggered by: `vfs:/main.tsx:2: Could not find "@/index.css" in the project (imported from /main.tsx)`

