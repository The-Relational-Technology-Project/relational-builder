# Model bench — 2026-11-06T12-11-42-0305b30-8s6j

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `0305b30`)
- **Date:** 2026-11-06T12:19:12.662Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 1/2 ✓ | 0/2 | 1/1 clean | 1/2 solved | bad-import | 22.5 | 0 | no | 4.5/5 | 0 | 1.05 | 6 | 130 lines | 0 | 6.5/15.5 | 91.05000000000001 | 5s | 95s | 36s | 95s | 0.02 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 2/2 ✓ | 1/2 | 1/2 clean, 1 blank | 1/1 solved | bad-import | 10.5 | 0 | no | 5/5 | 0 | 0.9 | 0.5 | 97 lines | 0 | 4/8 | 78.25 | 6s | 72s | 11s | 72s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **glm-4.5-air**: z-ai/glm-4.5-air, via Z.AI / z-ai/glm-4.5-air, via Novita

## In the browser (bundled, but)

- **glm-4.5-air** · hs-listening-wall t1: BLANK PAGE
  - console: RangeError: Invalid time value at X (https://esm.sh/date-fns@4.1.0/X-ZXJlYWN0LHJlYWN0LWRvbQ/es2022/format.mjs:2:8319) at AnswerCard (file:///home/user/relational-builder/bench/results/2026-11-06T12-11-42-0305b30-8s6j/art
  - console: RangeError: Invalid time value at X (https://esm.sh/date-fns@4.1.0/X-ZXJlYWN0LHJlYWN0LWRvbQ/es2022/format.mjs:2:8319) at AnswerCard (file:///home/user/relational-builder/bench/results/2026-11-06T12-11-42-0305b30-8s6j/art
  - console: RangeError: Invalid time value at X (https://esm.sh/date-fns@4.1.0/X-ZXJlYWN0LHJlYWN0LWRvbQ/es2022/format.mjs:2:8319) at AnswerCard (file:///home/user/relational-builder/bench/results/2026-11-06T12-11-42-0305b30-8s6j/art
  - pageerror: Invalid time value

## Fix passes (how solves went)

- **glm-4.5-air** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (18s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:8: No matching export in "vfs:/src/pages/HomePage.tsx" for import "default"`
- **glm-4.5-air** · hs-community-fridge t2: build failed to bundle → auto-fix not solved after 2 passes — still: vfs:/src/pages/Home.tsx:6: No matching export in "vfs:/src/components/StatusIndicator.tsx" for import "StatusIndicator"
  - triggered by: `vfs:/src/pages/Home.tsx:6: No matching export in "vfs:/src/components/StatusIndicator.tsx" for import "StatusIndicator"`
- **glm-4.5-air** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (11s, ~$0.00)
  - triggered by: `vfs:/src/pages/QuestionPage.tsx:4: No matching export in "vfs:/src/components/ui/empty-state.tsx" for import "default"`


## Previews

### hs-community-fridge — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t1.png)

### hs-listening-wall — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t1.png)

### hs-listening-wall — glm-4.5-air (trial 2)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t2.png)
