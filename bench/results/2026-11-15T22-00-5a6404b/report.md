# Model bench — 2026-11-15T22-00-5a6404b

- **Tasks:** mutual-aid-board (harness 1.2.0, commit `5a6404b`)
- **Date:** 2026-11-15T22:07:33.082Z
- **Trials per model per task:** 2
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: mutual-aid-board (v1)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| pareto | 2/2 ✓ | 2/2 | — | 8 | 0 | no | 4/5 | 0 | 138s | 138s | 138s | 0.03 |
| claude-opus-5-5 | 2/2 ✓ | 2/2 | — | 10 | 0 | no | 5/5 | 0 | 89s | 222s | 222s | 0.31 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._


## Previews

### mutual-aid-board — pareto (trial 1)

![pareto](shots/mutual-aid-board--pareto-t1.png)

### mutual-aid-board — claude-opus-5-5 (trial 1)

![claude-opus-5-5](shots/mutual-aid-board--claude-opus-5-5-t1.png)

### mutual-aid-board — pareto (trial 2)

![pareto](shots/mutual-aid-board--pareto-t2.png)

### mutual-aid-board — claude-opus-5-5 (trial 2)

![claude-opus-5-5](shots/mutual-aid-board--claude-opus-5-5-t2.png)
