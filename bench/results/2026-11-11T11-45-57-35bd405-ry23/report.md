# Model bench — 2026-11-11T11-45-57-35bd405-ry23

- **Tasks:** hs-community-fridge, hs-listening-wall, remix-income-sharing, hs-ballot-guide, remix-street-stories, hs-skill-swap (harness 1.2.0, commit `35bd405`)
- **Date:** 2026-11-11T12:06:32.259Z
- **Trials per model per task:** 2
- **Import guard:** on (static import check feeds the fix pass)
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Renders** = opened in a browser after bundling, visible page and no uncaught errors (n/a before Oct 30, 2026); **Fail kind** = what the first-try bundle error was (missing-file, bad-import, unknown-package, syntax); **Lint/100** = eslint findings per 100 lines with the app's own config; **tsc errors** = type errors in the model's files with the kit merged and uninstalled packages untyped, counted only on builds that bundled, syntax errors kept apart (n/a before Nov 1, 2026); **Largest file**, **any**, **Kit files** (files importing the RB kit over code files) and **tok/s** come from the files the model wrote (n/a before Oct 31, 2026); **Fix time** = the auto-fix pass's own wall time; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: hs-community-fridge (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 1/2 | 2/2 clean | 1/1 solved | bad-import | 7 | 0 | no | 4.5/5 | 0 | 0.5 | 0.5 | 179.5 lines | 0.5 | 2.5/4.5 | 33.2 | 1s | 132s | 21s | 132s | 0.00 |

### Task: hs-listening-wall (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 1/2 | 2/2 clean | 1/1 solved | bad-import | 10.5 | 0 | no | 5/5 | 0 | 0.4 | 0 | 93.5 lines | 0.5 | 4/6.5 | 62.1 | 1s | 86s | 38s | 86s | 0.00 |

### Task: remix-income-sharing (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 7 | 0 | no | 4.5/5 | 0 | 0.6 | 1 | 210 lines | 0 | 3/5 | 119.1 | 1s | 37s | — | 37s | 0.00 |

### Task: hs-ballot-guide (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 2/2 clean | — | — | 5 | 0 | no | 4.5/5 | 0 | 1.25 | 0 | 214.5 lines | 1 | 1/3 | 126.1 | 1s | 41s | — | 41s | 0.00 |

### Task: remix-street-stories (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 1/2 | 2/2 clean | 1/1 solved | syntax | 7.5 | 0 | no | 4.5/5 | 0 | 0 | 1 | 164.5 lines | 0 | 3/5 | 48.75 | 2s | 96s | 26s | 96s | 0.00 |

### Task: hs-skill-swap (exp-v1)

| Model | Bundle | First try | Renders | Fix | Fail kind | Files | Failed edits | Truncated | Checks | Sec flags | Lint/100 | tsc errors | Largest file | any | Kit files | tok/s | TTFT | Build time | Fix time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | 2/2 ✓ | 2/2 | 1/2 clean, 1 blank | — | — | 6.5 | 0 | no | 4/5 | 0 | 0.85 | 0.5 | 164 lines | 0.5 | 2.5/4.5 | 51.45 | 1s | 149s | — | 149s | 0.00 |

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

## Served as (provider-reported)

- **gemma-4-26b**: google/gemma-4-26b-a4b-it, via PrimeIntellect / google/gemma-4-26b-a4b-it, via NextBit / google/gemma-4-26b-a4b-it, via DekaLLM / google/gemma-4-26b-a4b-it, via Parasail / google/gemma-4-26b-a4b-it, via CoreWeave

## In the browser (bundled, but)

- **gemma-4-26b** · hs-skill-swap t2: BLANK PAGE
  - pageerror: Cannot read properties of null (reading 'useState')

## Fix passes (how solves went)

- **gemma-4-26b** · hs-community-fridge t1: build failed to bundle → auto-fix solved in one pass (21s, ~$0.00)
  - triggered by: `vfs:/src/pages/PostUpdate.tsx: No matching export in "vfs:/src/components/ui/label.tsx" for import "label"`
- **gemma-4-26b** · hs-listening-wall t2: build failed to bundle → auto-fix solved in one pass (38s, ~$0.00)
  - triggered by: `vfs:/src/pages/AddResponse.tsx:3: No matching export in "vfs:/src/App.tsx" for import "QUESTIONS"`
- **gemma-4-26b** · remix-street-stories t1: build failed to bundle → auto-fix solved in one pass (26s, ~$0.00)
  - triggered by: `vfs:/src/data/seed.ts:132: Expected "}" but found "Big"`


## Previews

### hs-community-fridge — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t1.png)

### hs-community-fridge — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-community-fridge--gemma-4-26b-t2.png)

### hs-listening-wall — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t1.png)

### hs-listening-wall — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-listening-wall--gemma-4-26b-t2.png)

### remix-income-sharing — gemma-4-26b (trial 1)

![gemma-4-26b](shots/remix-income-sharing--gemma-4-26b-t1.png)

### remix-income-sharing — gemma-4-26b (trial 2)

![gemma-4-26b](shots/remix-income-sharing--gemma-4-26b-t2.png)

### hs-ballot-guide — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-ballot-guide--gemma-4-26b-t1.png)

### hs-ballot-guide — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-ballot-guide--gemma-4-26b-t2.png)

### remix-street-stories — gemma-4-26b (trial 1)

![gemma-4-26b](shots/remix-street-stories--gemma-4-26b-t1.png)

### remix-street-stories — gemma-4-26b (trial 2)

![gemma-4-26b](shots/remix-street-stories--gemma-4-26b-t2.png)

### hs-skill-swap — gemma-4-26b (trial 1)

![gemma-4-26b](shots/hs-skill-swap--gemma-4-26b-t1.png)

### hs-skill-swap — gemma-4-26b (trial 2)

![gemma-4-26b](shots/hs-skill-swap--gemma-4-26b-t2.png)
