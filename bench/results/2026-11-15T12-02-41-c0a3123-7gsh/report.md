# Model bench — 2026-11-15T12-02-41-c0a3123-7gsh

- **Tasks:** remix-income-sharing, remix-gathering-fund, remix-street-stories, remix-tool-lending-seed, hs-story-circle, hs-ballot-guide, hs-skill-swap, hs-bulletin-boards (harness 1.2.0, commit `c0a3123`)
- **Date:** 2026-11-15T12:40:33.508Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: remix-income-sharing (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 1/2 | 2/2 clean | 1/1 solved | other | 9 | 0 | no | 4.5/5 | 0 | 0 | 1 | 181.5 lines | 0 | 3/6.5 | 61.9 | 2s | 80s | 6s | 80s | 0.00 |

### Task: remix-gathering-fund (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 7 | 0 | no | 5/5 | 0 | 1.5499999999999998 | 0 | 182 lines | 0 | 3/5 | 48.55 | 3s | 101s | — | 101s | 0.00 |

### Task: remix-street-stories (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 9 | 0 | no | 4.5/5 | 0 | 0.6 | 0 | 129.5 lines | 0 | 5/7 | 34.25 | 2s | 227s | — | 227s | 0.00 |

### Task: remix-tool-lending-seed (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 6.5 | 0 | no | 5/5 | 0 | 0.35 | 0.5 | 124 lines | 0.5 | 2/4.5 | 40 | 1s | 155s | — | 155s | 0.00 |

### Task: hs-story-circle (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 6.5 | 0 | no | 5/5 | 0 | 1.9000000000000001 | 0.5 | 197 lines | 0.5 | 2.5/4.5 | 21.7 | 2s | 215s | — | 215s | 0.00 |

### Task: hs-ballot-guide (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 1/2 | 2/2 clean | 1/1 solved | syntax | 7 | 0 | no | 4.5/5 | 0 | 0.5 | 0 | 169 lines | 0 | 2/4 | 51.6 | 1s | 128s | 45s | 128s | 0.00 |

### Task: hs-skill-swap (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 6 | 0 | no | 4/5 | 0 | 0.8 | 0 | 128 lines | 0 | 2/4 | 52.8 | 1s | 71s | — | 71s | 0.00 |

### Task: hs-bulletin-boards (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 1/2 clean, 1 blank | — | — | 8.5 | 0 | no | 4/5 | 0 | 0.3 | 0 | 136.5 lines | 1 | 4/6.5 | 53.35 | 2s | 98s | — | 98s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-26b**: google/gemma-4-26b-a4b-it, via NextBit / google/gemma-4-26b-a4b-it, via PrimeIntellect / google/gemma-4-26b-a4b-it, via CoreWeave / google/gemma-4-26b-a4b-it, via Parasail

## In the browser (bundled, but)

- **gemma-4-26b** · hs-bulletin-boards t1: BLANK PAGE
  - console: Error: Minified React error #185; visit https://reactjs.org/docs/error-decoder.html?invariant=185 for the full message or use the non-minified dev environment for full errors and additional helpful warnings. at Ce (https
  - pageerror: Minified React error #185; visit https://reactjs.org/docs/error-decoder.html?invariant=185 for the full message or use the non-minified dev environment for full errors and additional helpful warnings.

## Fix passes (how solves went)

- **gemma-4-26b** · remix-income-sharing t1: build failed to bundle → auto-fix solved in one pass (6s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:40: Unexpected closing "Routes" tag does not match opening "main" tag`
- **gemma-4-26b** · hs-ballot-guide t1: build failed to bundle → auto-fix solved in one pass (45s, ~$0.00)
  - triggered by: `vfs:/src/App.tsx:149: Expected "}" but found ")"`


## Previews

### remix-income-sharing — gemma-4-26b (trial 1)

![gemma-4-26b](shots/remix-income-sharing--gemma-4-26b-t1.png)

### remix-income-sharing — gemma-4-26b (trial 2)

![gemma-4-26b](shots/remix-income-sharing--gemma-4-26b-t2.png)

### remix-gathering-fund — gemma-4-26b (trial 1)

![gemma-4-26b](shots/remix-gathering-fund--gemma-4-26b-t1.png)

### remix-gathering-fund — gemma-4-26b (trial 2)

![gemma-4-26b](shots/remix-gathering-fund--gemma-4-26b-t2.png)

### remix-street-stories — gemma-4-26b (trial 1)

![gemma-4-26b](shots/remix-street-stories--gemma-4-26b-t1.png)

### remix-street-stories — gemma-4-26b (trial 2)

![gemma-4-26b](shots/remix-street-stories--gemma-4-26b-t2.png)

### remix-tool-lending-seed — gemma-4-26b (trial 1)

![gemma-4-26b](shots/remix-tool-lending-seed--gemma-4-26b-t1.png)

### remix-tool-lending-seed — gemma-4-26b (trial 2)

![gemma-4-26b](shots/remix-tool-lending-seed--gemma-4-26b-t2.png)

### hs-story-circle — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-story-circle--gemma-4-26b-t1.png)

### hs-story-circle — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-story-circle--gemma-4-26b-t2.png)

### hs-ballot-guide — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-ballot-guide--gemma-4-26b-t1.png)

### hs-ballot-guide — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-ballot-guide--gemma-4-26b-t2.png)

### hs-skill-swap — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-skill-swap--gemma-4-26b-t1.png)

### hs-skill-swap — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-skill-swap--gemma-4-26b-t2.png)

### hs-bulletin-boards — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-bulletin-boards--gemma-4-26b-t1.png)

### hs-bulletin-boards — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-bulletin-boards--gemma-4-26b-t2.png)
