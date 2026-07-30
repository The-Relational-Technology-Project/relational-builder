# Model bench — 2026-07-30T05-32-4a50f23

- **Tasks:** mutual-aid-board (harness 1.0.0, commit `4a50f23`)
- **Date:** 2026-07-30T05:43:36.426Z
- **Trials per model per task:** 2
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: mutual-aid-board (v1)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kimi-k3-direct | 0/1 ✓ | 0/1 | 0/1 solved | 8 | 0 | no | 4/5 | 0 | 461s | 509s | 509s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **kimi-k3-direct** · mutual-aid-board t1: build failed to bundle → auto-fix not solved — still: vfs:/src/App.tsx:14: Could not find "@/pages/Board" in the project (imported from /src/App.tsx)
  - triggered by: `vfs:/src/App.tsx:13: Could not find "@/components/PersonaSwitcher" in the project (imported from /src/App.tsx)`


### Run notes (Kimi K3 direct — first real signal, interrupted)

- **First trial through Moonshot's own API worked** — no more OpenRouter 402s.
  509s generation (thinking-only model, default max effort), 8 files, clean
  chunking: the reply ended with `NEXT-FILES:` exactly as the system prompt
  teaches. But harness 1.0.0 only continued on *truncation*, not on planned
  chunk boundaries, so the declared files were never requested and the build
  scored bundle ✗ on missing `/src/pages/*`. Theme tokens, kit components,
  and HashRouter checks all passed on what did arrive.
- **Trial 2 was killed by a session suspend**, not by the model — no t2 record.
- Harness 1.1.0 (commit `bed9ae4`) honors NEXT-FILES; the follow-up run
  supersedes this one for any model-quality read.
