# Model bench — 2026-11-04T11-44-01-8f2c483-qqdv

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `8f2c483`)
- **Date:** 2026-11-04T11:51:47.813Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 3/3 ✓ | 1/3 | 2/3 clean, 1 blank | 2/2 solved | other | 10 | 0 | no | 5/5 | 0 | 1.9 | 2 | 103 lines | 0 | 4/8 | 77.5 | 5s | 47s | 2s | 47s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 3/3 ✓ | 1/3 | 3/3 clean | 2/2 solved | other | 9 | 0 | no | 5/5 | 0 | 0.5 | 2 | 101 lines | 0 | 4/6 | 131.3 | 5s | 22s | 6s | 22s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gpt-oss-120b**: openai/gpt-oss-120b, via DeepInfra / openai/gpt-oss-120b, via AkashML / openai/gpt-oss-120b, via PrimeIntellect / openai/gpt-oss-120b, via Venice / openai/gpt-oss-120b, via Sail Research

## In the browser (bundled, but)

- **gpt-oss-120b** · hs-community-fridge t2: BLANK PAGE
  - console: TypeError: set is not a function at loadSeed (file:///home/user/relational-builder/bench/results/2026-11-04T11-44-01-8f2c483-qqdv/artifacts/hs-community-fridge/gpt-oss-120b-t2/preview.html:473:3) at file:///home/user/rel
  - pageerror: set is not a function

## Fix passes (how solves went)

- **gpt-oss-120b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (3s, ~$0.00)
  - triggered by: `vfs:/src/main.tsx: BrowserRouter from 'react-router-dom' opens on "Page not found" in the preview and on static hosts; use HashRouter`
- **gpt-oss-120b** · hs-community-fridge t2: build failed to bundle → auto-fix solved in one pass (1s, ~$0.00)
  - triggered by: `vfs:/src/components/PostForm.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`
- **gpt-oss-120b** · hs-listening-wall t1: build failed to bundle → auto-fix solved in one pass (6s, ~$0.00)
  - triggered by: `vfs:/src/pages/QuestionDetail.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`
- **gpt-oss-120b** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (6s, ~$0.00)
  - triggered by: `vfs:/src/pages/Wall.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`


## Previews

### hs-community-fridge — gpt-oss-120b (trial 1)

![gpt-oss-120b](shots/hs-community-fridge--gpt-oss-120b-t1.png)

### hs-community-fridge — gpt-oss-120b (trial 2)

![gpt-oss-120b](shots/hs-community-fridge--gpt-oss-120b-t2.png)

### hs-community-fridge — gpt-oss-120b (trial 3)

![gpt-oss-120b](shots/hs-community-fridge--gpt-oss-120b-t3.png)

### hs-listening-wall — gpt-oss-120b (trial 1)

![gpt-oss-120b](shots/hs-listening-wall--gpt-oss-120b-t1.png)

### hs-listening-wall — gpt-oss-120b (trial 2)

![gpt-oss-120b](shots/hs-listening-wall--gpt-oss-120b-t2.png)

### hs-listening-wall — gpt-oss-120b (trial 3)

![gpt-oss-120b](shots/hs-listening-wall--gpt-oss-120b-t3.png)
