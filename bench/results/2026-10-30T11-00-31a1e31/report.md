# Model bench — 2026-10-30T11-00-31a1e31

- **Tasks:** hs-meal-train, hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `31a1e31`)
- **Date:** 2026-10-30T11:18:45.052Z
- **Trials per model per task:** 1
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-meal-train (exp-v1)

| Model | Bundle | First try | Renders | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-30b | 1/1 ✓ | 0/1 | 1/1 clean | 1/1 solved | 11 | 0 | no | 3/5 | 0 | 2s | 424s | 424s | 0.01 |

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-30b | 1/1 ✓ | 0/1 | 0/1 clean | 1/1 solved | 12 | 0 | no | 3/5 | 0 | 2s | 177s | 177s | 0.01 |

### Task: hs-listening-wall (?)

| Model | Bundle | First try | Renders | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|


## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## In the browser (bundled, but)

- **qwen3-coder-30b** · hs-community-fridge t1: renders with errors
  - pageerror: Cannot apply unknown utility class `fog-green`
  - pageerror: Cannot apply unknown utility class `fog-green`
  - pageerror: Cannot apply unknown utility class `fog-green`

## Fix passes (how solves went)

- **qwen3-coder-30b** · hs-meal-train t1: build failed to bundle → auto-fix solved in one pass (180s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:4: Could not find "./data/seedData" in the project (imported from /src/App.tsx)`
- **qwen3-coder-30b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (86s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:7: Could not find "./pages/CleaningShifts" in the project (imported from /src/App.tsx)`


## Previews

### hs-meal-train — qwen3-coder-30b (trial 1)

![qwen3-coder-30b](shots/hs-meal-train--qwen3-coder-30b-t1.png)

### hs-community-fridge — qwen3-coder-30b (trial 1)

![qwen3-coder-30b](shots/hs-community-fridge--qwen3-coder-30b-t1.png)
