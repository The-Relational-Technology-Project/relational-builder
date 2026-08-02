# Model bench — 2026-08-02T15-33-48aa455

- **Tasks:** edit-copy, edit-feature, edit-restyle (harness 1.2.0, commit `48aa455`)
- **Date:** 2026-08-02T15:37:50.121Z
- **Trials per model per task:** 3
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: edit-copy (edit-seed-v1)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus-5 | 3/3 ✓ | 3/3 | — | 0 | 0 | no | 3/3 | 0 | 7s | 7s | 7s | 0.07 |
| sonnet-5 | 3/3 ✓ | 3/3 | — | 0 | 0 | no | 3/3 | 0 | 4s | 5s | 5s | 0.04 |

### Task: edit-feature (edit-seed-v1)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus-5 | 3/3 ✓ | 3/3 | — | 0 | 0 | no | 3/3 | 0 | 11s | 16s | 16s | 0.07 |
| sonnet-5 | 3/3 ✓ | 3/3 | — | 0 | 0 | no | 3/3 | 0 | 7s | 15s | 15s | 0.05 |

### Task: edit-restyle (edit-seed-v1)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus-5 | 3/3 ✓ | 3/3 | — | 1 | 0 | no | 3/3 | 0 | 21s | 31s | 31s | 0.08 |
| sonnet-5 | 3/3 ✓ | 3/3 | — | 0 | 0 | no | 3/3 | 0 | 7s | 11s | 11s | 0.04 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

- **Community first-build default:** `claude-opus-5` (unchanged)
- **Community edit model:** `claude-opus-5` — Sonnet 5 was routed here earlier
  the same day on the cost case and reverted after this run.
- Decided 2026-08-02 by Josh: the earliest real builders are arriving now, and
  reliability beats the saving until there is more than n=3 behind it.

### What this run actually showed

Sonnet 5 is the better edit model on the common cases and it is not close:
identical surgical output on a copy change (the dominant edit shape), *more*
surgical than Opus on the restyle (1 file / 475 bytes vs 2 / 774), 41% cheaper,
30% faster, zero collateral, and a coastal restyle that reads correctly.

It lost on one thing. `edit-feature` t2 rendered `post.urgent` in the card and
never added the field to the data — the build bundles, the app renders, and the
badge simply never appears. 2/3 where Opus went 3/3. Every mechanical gate
except the both-halves-landed check passes that trial, which is precisely why a
non-technical builder could not diagnose it: nothing looks broken.

Two things make that single miss decisive rather than noise-to-be-averaged:
edits currently have **no automated safety net at all** (the quality review
pass runs on first builds only, by design), and the people hitting this are the
first cohort, for whom a silently half-built feature is the worst failure shape
available.

### Owed before revisiting

- `--trials 9 --tasks edit-feature` to establish whether 1-in-3 is real (~$0.30).
- Human review: nobody has scored `review/index.html`. The design/completeness
  column that the harness treats as the deciding score is still empty here.
- A narrow "did both halves of a multi-file edit land" check would target this
  exact failure at a fraction of the full review pass's cost.

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._


## Previews

### edit-copy — opus-5 (trial 1)

![opus-5](shots/edit-copy--opus-5-t1.png)

### edit-copy — opus-5 (trial 2)

![opus-5](shots/edit-copy--opus-5-t2.png)

### edit-copy — opus-5 (trial 3)

![opus-5](shots/edit-copy--opus-5-t3.png)

### edit-feature — opus-5 (trial 1)

![opus-5](shots/edit-feature--opus-5-t1.png)

### edit-feature — opus-5 (trial 2)

![opus-5](shots/edit-feature--opus-5-t2.png)

### edit-feature — opus-5 (trial 3)

![opus-5](shots/edit-feature--opus-5-t3.png)

### edit-restyle — opus-5 (trial 1)

![opus-5](shots/edit-restyle--opus-5-t1.png)

### edit-restyle — opus-5 (trial 2)

![opus-5](shots/edit-restyle--opus-5-t2.png)

### edit-restyle — opus-5 (trial 3)

![opus-5](shots/edit-restyle--opus-5-t3.png)

### edit-copy — sonnet-5 (trial 1)

![sonnet-5](shots/edit-copy--sonnet-5-t1.png)

### edit-copy — sonnet-5 (trial 2)

![sonnet-5](shots/edit-copy--sonnet-5-t2.png)

### edit-copy — sonnet-5 (trial 3)

![sonnet-5](shots/edit-copy--sonnet-5-t3.png)

### edit-feature — sonnet-5 (trial 1)

![sonnet-5](shots/edit-feature--sonnet-5-t1.png)

### edit-feature — sonnet-5 (trial 2)

![sonnet-5](shots/edit-feature--sonnet-5-t2.png)

### edit-feature — sonnet-5 (trial 3)

![sonnet-5](shots/edit-feature--sonnet-5-t3.png)

### edit-restyle — sonnet-5 (trial 1)

![sonnet-5](shots/edit-restyle--sonnet-5-t1.png)

### edit-restyle — sonnet-5 (trial 2)

![sonnet-5](shots/edit-restyle--sonnet-5-t2.png)

### edit-restyle — sonnet-5 (trial 3)

![sonnet-5](shots/edit-restyle--sonnet-5-t3.png)
