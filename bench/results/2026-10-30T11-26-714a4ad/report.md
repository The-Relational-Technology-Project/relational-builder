# Model bench — 2026-10-30T11-26-714a4ad

- **Tasks:** hs-community-fridge (harness 1.2.0, commit `714a4ad`)
- **Date:** 2026-10-30T11:26:56.257Z
- **Trials per model per task:** 1
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 1/1 ✓ | 0/1 | 0/1 clean, 1 blank | 1/1 solved | 10 | 0 | no | 5/5 | 0 | 1s | 45s | 45s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## In the browser (bundled, but)

- **gemma-4-26b** · hs-community-fridge t1: BLANK PAGE
  - console: ReferenceError: Calendar is not defined at Board (file:///home/user/relational-builder/bench/results/2026-10-30T11-26-714a4ad/artifacts/hs-community-fridge/gemma-4-26b-t1/preview.html:367:30) at Hi (https://esm.sh/react-
  - pageerror: Calendar is not defined

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (7s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:6: Expected "from" but found "{"`


## Previews

### hs-community-fridge — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t1.png)
