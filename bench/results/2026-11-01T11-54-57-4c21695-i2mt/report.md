# Model bench — 2026-11-01T11-54-57-4c21695-i2mt

- **Tasks:** hs-community-fridge, hs-listening-wall (harness 1.2.0, commit `4c21695`)
- **Date:** 2026-11-01T12:04:40.686Z
- **Trials per model per task:** 1
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-next | 0/1 ✓ | 0/1 | n/a | 0/1 solved | missing-file | 21 | 0 | no | 4/5 | 0 | 0.7 | 14 | 162 lines | 0 | 6/18 | 80.4 | 1s | 121s | 2s | 121s | 0.01 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| qwen3-coder-next | 1/1 ✓ | 0/1 | 1/1 clean | 1/1 solved | syntax | 21 | 0 | no | 5/5 | 0 | 0.9 | 5 | 175 lines | 0 | 3/16 | 76.2 | 1s | 150s | 71s | 150s | 0.02 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Fix passes (how solves went)

- **qwen3-coder-next** · hs-community-fridge t1: build failed to bundle → auto-fix not solved — still: vfs:/src/App.tsx:7: No matching export in "vfs:/src/components/ui/bottom-nav.tsx" for import "default"
  - triggered by: `vfs:/src/components/ui/avatar.tsx:2: Could not find "@/lib/cn" in the project (imported from /src/components/ui/avatar.tsx)`
- **qwen3-coder-next** · hs-listening-wall t1: build failed to bundle → auto-fix solved in one pass (71s, ~$0.01)
  - triggered by: `vfs:/src/pages/AdminPanel.tsx:1: Expected string but found "{"`


## Previews

### hs-listening-wall — qwen3-coder-next (trial 1)

![qwen3-coder-next](shots/hs-listening-wall--qwen3-coder-next-t1.png)
