# Model bench — 2026-10-30T11-34-6adf156

- **Tasks:** hs-community-fridge (harness 1.2.0, commit `6adf156`)
- **Date:** 2026-10-30T11:35:50.930Z
- **Trials per model per task:** 1
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gpt-oss-120b | 1/1 ✓ | 1/1 | 0/1 clean, 1 blank | — | 12 | 0 | no | 5/5 | 0 | 23s | 109s | 109s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## In the browser (bundled, but)

- **gpt-oss-120b** · hs-community-fridge t1: BLANK PAGE
  - pageerror: The requested module 'lucide-react' does not provide an export named 'CircleHalf'


## Previews

### hs-community-fridge — gpt-oss-120b (trial 1)

![gpt-oss-120b](shots/hs-community-fridge--gpt-oss-120b-t1.png)
