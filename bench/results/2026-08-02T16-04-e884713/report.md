# Model bench — 2026-08-02T16-04-e884713

- **Tasks:** edit-feature (harness 1.2.0, commit `e884713`)
- **Date:** 2026-08-02T16:08:53.686Z
- **Trials per model per task:** 9
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: edit-feature (edit-seed-v2)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| opus-5 | 9/9 ✓ | 9/9 | — | 0 | 0 | no | 3/3 | 0 | 11s | 17s | 17s | 0.07 |
| sonnet-5 | 9/9 ✓ | 8/9 | 1/1 solved | 0 | 0 | no | 3/3 | 0 | 5s | 13s | 13s | 0.05 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Follow-up run: the 9 trials the 15:33 run said were owed._

**`edit-feature`, n=9 per model (plus the 3 from the earlier run = 12 each):**

| | all checks pass | bundle | med cost | med latency |
|---|---|---|---|---|
| opus-5 | **12/12** | 9/9 | $0.0720 | 17s |
| sonnet-5 | **9/12** | 9/9 | $0.0485 | 13s |

The 1-in-3 was not noise. Sonnet failed twice more here (trials 3 and 5), and
every single failure — all three across both runs — is the *same check*:
`urgent-in-data`. It never once failed `urgent-in-ui`.

That consistency is the finding, more than the ratio is. Sonnet reliably writes
the half of the change it can see on screen (the badge in the card) and skips
the half it cannot (the field in the data file). That is a systematic
behaviour on multi-file edits, not variance you can average away with more
trials — and it produces an app that bundles, renders, and silently does
nothing, which is the failure a non-technical builder has no way to diagnose.

**Decision stands: `claude-opus-5` for the edit slot.** Opus is 12/12 at ~1.5x
the cost and 4s slower. Given edits have no automated safety net, that is the
right trade for now.

**Still worth revisiting, because the rest of Sonnet's case is strong:** on copy
changes (the dominant edit shape) it produced byte-identical output to Opus at
40% less, and on the restyle it was the *more* surgical of the two. A router
that sent single-file edits to Sonnet and multi-file ones to Opus would capture
most of the saving without this failure mode — the hard part is classifying the
edit before you make it, which is not obviously cheaper than just using Opus.


_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **sonnet-5** · edit-feature t8: build failed to bundle → auto-fix solved in one pass (6s, ~$0.04)
  - triggered by: `vfs:/src/data/seed.ts:20: Unexpected "==="`

