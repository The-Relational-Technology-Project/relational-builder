# Model bench — 2026-11-01T12-10-54-565c5cd-llco

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `565c5cd`)
- **Date:** 2026-11-01T12:25:34.339Z
- **Trials per model per task:** 3
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 2/3 ✓ | 0/3 | 1/2 clean, 1 blank | 0/3 solved | bad-import | 13 | 0 | no | 5/5 | 0 | 1.1 | 7.5 | 161 lines | 1 | 6/8 | 76 | 6s | 84s | 40s | 84s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 3/3 ✓ | 0/3 | 2/3 clean, 1 blank | 3/3 solved | bad-import, other | 11 | 0 | no | 5/5 | 0 | 0.9 | 2 | 309 lines | 0 | 5/8 | 87.3 | 6s | 116s | 16s | 116s | 0.02 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## In the browser (bundled, but)

- **glm-4.5-air** · hs-community-fridge t3: BLANK PAGE
  - pageerror: The requested module 'react-router-dom' does not provide an export named 'HashLink'
- **glm-4.5-air** · hs-listening-wall t3: BLANK PAGE
  - pageerror: useStore is not defined

## Fix passes (how solves went)

- **glm-4.5-air** · hs-community-fridge t1: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/pages/Home.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)
  - triggered by: `vfs:/src/pages/Home.tsx:7: No matching export in "vfs:/src/components/ui/select.tsx" for import "SelectContent"`
- **glm-4.5-air** · hs-community-fridge t2: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/main.tsx:2: No matching export in "vfs:/src/App.tsx" for import "App"
  - triggered by: `vfs:/src/main.tsx:2: No matching export in "vfs:/src/App.tsx" for import "App"`
- **glm-4.5-air** · hs-community-fridge t3: build failed to bundle → auto-fix not solved after one pass — still: vfs:/src/components/FridgeStatus.tsx: No matching export in "vfs:/src/store.ts" for import "FridgeStatus"
  - triggered by: `vfs:/src/components/UpdateForm.tsx:6: No matching export in "vfs:/src/components/ui/select.tsx" for import "SelectContent"`
- **glm-4.5-air** · hs-listening-wall t1: build failed to bundle → auto-fix solved in one pass (16s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:4: No matching export in "vfs:/src/components/ui/app-bar.tsx" for import "default"`
- **glm-4.5-air** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (17s, ~$0.00)
  - triggered by: `vfs:/src/pages/QuestionPage.tsx: ReferenceError: React is not defined (uses React.* with no `import React from 'react'` or `import * as React from 'react'`)`
- **glm-4.5-air** · hs-listening-wall t3: build failed to bundle → auto-fix solved in one pass (13s, ~$0.00)
  - triggered by: `vfs:/src/components/AnswerCard.tsx: <Card> is used but never imported or declared in this file`


## Previews

### hs-community-fridge — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t1.png)

### hs-community-fridge — glm-4.5-air (trial 3)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t3.png)

### hs-listening-wall — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t1.png)

### hs-listening-wall — glm-4.5-air (trial 2)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t2.png)

### hs-listening-wall — glm-4.5-air (trial 3)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t3.png)
