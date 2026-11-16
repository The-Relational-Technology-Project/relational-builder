# Model bench — 2026-11-16T00-36-646ed3b

- **Tasks:** edit-copy, edit-feature, edit-restyle (harness 1.2.0, commit `646ed3b`)
- **Date:** 2026-11-16T00:37:44.239Z
- **Trials per model per task:** 2
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: edit-copy (edit-seed-v2)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 2/2 ✓ | 2/2 | — | 0 | 0 | no | 3/3 | 0 | 2s | 3s | 3s | 0.06 |
| pareto | 2/2 ✓ | 2/2 | — | 0 | 0 | no | 3/3 | 0 | 4s | 4s | 4s | 0.01 |

### Task: edit-feature (edit-seed-v2)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 2/2 ✓ | 2/2 | — | 0 | 0 | no | 3/3 | 0 | 5s | 9s | 9s | 0.07 |
| pareto | 2/2 ✓ | 2/2 | — | 0 | 0 | no | 3/3 | 0 | 18s | 18s | 18s | 0.01 |

### Task: edit-restyle (edit-seed-v2)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| claude-opus-5-5 | 2/2 ✓ | 2/2 | — | 1 | 0 | no | 3/3 | 0 | 15s | 22s | 22s | 0.07 |
| pareto | 2/2 ✓ | 2/2 | — | 1 | 0 | no | 3/3 | 0 | 10s | 11s | 11s | 0.01 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._


## Previews

### edit-copy — claude-opus-5-5 (trial 1)

![claude-opus-5-5](shots/edit-copy--claude-opus-5-5-t1.png)

### edit-copy — pareto (trial 1)

![pareto](shots/edit-copy--pareto-t1.png)

### edit-copy — claude-opus-5-5 (trial 2)

![claude-opus-5-5](shots/edit-copy--claude-opus-5-5-t2.png)

### edit-copy — pareto (trial 2)

![pareto](shots/edit-copy--pareto-t2.png)

### edit-feature — claude-opus-5-5 (trial 1)

![claude-opus-5-5](shots/edit-feature--claude-opus-5-5-t1.png)

### edit-feature — claude-opus-5-5 (trial 2)

![claude-opus-5-5](shots/edit-feature--claude-opus-5-5-t2.png)

### edit-feature — pareto (trial 1)

![pareto](shots/edit-feature--pareto-t1.png)

### edit-feature — pareto (trial 2)

![pareto](shots/edit-feature--pareto-t2.png)

### edit-restyle — claude-opus-5-5 (trial 1)

![claude-opus-5-5](shots/edit-restyle--claude-opus-5-5-t1.png)

### edit-restyle — pareto (trial 1)

![pareto](shots/edit-restyle--pareto-t1.png)

### edit-restyle — pareto (trial 2)

![pareto](shots/edit-restyle--pareto-t2.png)

### edit-restyle — claude-opus-5-5 (trial 2)

![claude-opus-5-5](shots/edit-restyle--claude-opus-5-5-t2.png)
