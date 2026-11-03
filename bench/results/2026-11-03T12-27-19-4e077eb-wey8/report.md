# Model bench — 2026-11-03T12-27-19-4e077eb-wey8

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `4e077eb`)
- **Date:** 2026-11-03T12:36:35.580Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 3/3 ✓ | 0/3 | 1/3 clean, 1 blank | 3/3 solved | other | 8 | 0 | no | 4/5 | 0 | 0.4 | 4 | 92 lines | 1 | 3/5 | 63.2 | 3s | 49s | 13s | 49s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 3/3 ✓ | 2/3 | 3/3 clean | 1/1 solved | other | 10 | 0 | no | 4/5 | 0 | 0.3 | 1 | 94 lines | 0 | 4/7 | 51.1 | 12s | 90s | 20s | 90s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gpt-oss-120b**: openai/gpt-oss-120b, via PrimeIntellect / openai/gpt-oss-120b, via CoreWeave / openai/gpt-oss-120b, via DeepInfra

## In the browser (bundled, but)

- **gpt-oss-120b** · hs-community-fridge t1: renders with errors
  - pageerror: Cannot apply unknown utility class `font-inter`
  - pageerror: Cannot apply unknown utility class `font-inter`
  - pageerror: Cannot apply unknown utility class `font-inter`
- **gpt-oss-120b** · hs-community-fridge t3: BLANK PAGE
  - console: Error at B (https://esm.sh/@remix-run/router@1.23.0/es2022/router.mjs:2:2356) at re (https://esm.sh/react-router@6.30.0/X-ZXJlYWN0/es2022/react-router.mjs:2:12854) at Hi (https://esm.sh/react-dom@18.3.1/X-ZXJlYWN0/es2022
  - pageerror: Error

## Fix passes (how solves went)

- **gpt-oss-120b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (13s, ~$0.00)
  - triggered by: `vfs:/src/pages/PostsPage.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`
- **gpt-oss-120b** · hs-community-fridge t2: build failed to bundle → auto-fix solved in one pass (29s, ~$0.00)
  - triggered by: `vfs:/src/main.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`
- **gpt-oss-120b** · hs-community-fridge t3: build failed to bundle → auto-fix solved in one pass (2s, ~$0.00)
  - triggered by: `vfs:/src/main.tsx: BrowserRouter from 'react-router-dom' opens on "Page not found" in the preview and on static hosts; use HashRouter`
- **gpt-oss-120b** · hs-listening-wall t1: build failed to bundle → auto-fix solved in one pass (20s, ~$0.00)
  - triggered by: `vfs:/src/pages/QuestionPage.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`


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
