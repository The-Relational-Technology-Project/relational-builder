# Model bench — 2026-10-31T11-07-50-7b28bd5-zbzj

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `7b28bd5`)
- **Date:** 2026-10-31T11:12:41.031Z
- **Trials per model per task:** 1
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 1/1 ✓ | 0/1 | 1/1 clean | 0/1 solved | bad-import | 15 | 0 | no | 5/5 | 0 | 0.4 | 136 lines | 0 | 5/11 | 89.9 | 8s | 60s | 36s | 60s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| glm-4.5-air | 1/1 ✓ | 0/1 | 1/1 clean | 0/1 solved | bad-import | 21 | 0 | no | 5/5 | 0 | 1.1 | 213 lines | 4 | 7/17 | 71.7 | 7s | 156s | 23s | 156s | 0.02 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **glm-4.5-air** · hs-community-fridge t1: build failed to bundle → auto-fix not solved — still: vfs:/src/components/ui/bottom-nav.tsx: <Icon> is used but never imported or declared in this file
  - triggered by: `vfs:/src/App.tsx:4: No matching export in "vfs:/src/components/ui/app-bar.tsx" for import "default"`
- **glm-4.5-air** · hs-listening-wall t1: build failed to bundle → auto-fix not solved — still: vfs:/src/components/ui/avatar.tsx: <HTMLDivElement> is used but never imported or declared in this file
  - triggered by: `vfs:/src/components/AnswerCard.tsx:4: No matching export in "vfs:/src/components/ui/avatar.tsx" for import "AvatarFallback"`


## Previews

### hs-community-fridge — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-community-fridge--glm-4.5-air-t1.png)

### hs-listening-wall — glm-4.5-air (trial 1)

![glm-4.5-air](shots/hs-listening-wall--glm-4.5-air-t1.png)
