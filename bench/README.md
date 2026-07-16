# RTP Model Bench

A small, cost-conscious benchmark for deciding **which models Relational
Builder should use, and for what** — the community first-build default, the
edit-step model, BYOK recommendations, and open-model candidates for the free
RTP-hosted tier.

One frozen design+build task goes to every candidate model through the **real
production pipeline** — the actual system prompt (`buildSystemPrompt`), the
actual providers, the actual code extractor, the actual esbuild bundler with
the kit merged in, the actual publish build for previews. A bench "bundle ✓"
means the app would genuinely preview and deploy.

Scoring has three layers:

1. **Mechanical** (free, objective): files extracted, bundle ok, failed
   SEARCH/REPLACE edit blocks, expected preview kind, task-specific checks
   (theme tokens, kit usage, seeded data, router choice, no-backend),
   security-scan findings, truncation/continuations, latency, estimated cost.
2. **Human review** (the score that decides): `review/index.html` shows every
   model's app side by side — **blinded** (Model A/B/C, reveal toggle) — with
   1–5 scores for design quality, RTP fit, and completeness, plus an overall
   drag-to-rank. Export → save as `review/scores.json` → re-run the report.
3. There is deliberately **no LLM judge** — cheap, and humans judge "warm and
   neighborly" better than a rubric prompt does.

## Running

```bash
# Keys for whichever providers you want to test (env vars only — the harness
# never reads the app's stored keys):
export ANTHROPIC_API_KEY=…   # claude-*
export OPENAI_API_KEY=…      # gpt-*
export GEMINI_API_KEY=…      # gemini-*
export TOGETHER_API_KEY=…    # open models

npm run bench -- --list-models        # what's in the matrix
npm run bench -- --dry-run            # prompt size + cost estimate, no API calls
npm run bench -- selftest             # full pipeline on a canned reply, no API calls

npm run bench                         # all enabled models, 1 trial each
npm run bench -- --models claude-sonnet-5,gpt-5.5 --trials 2
npm run bench -- report bench/results/<runId>   # regenerate report.md (merges scores.json)
```

A full default run (8 models × 1 trial) costs roughly **$1.50–3** at list
prices. Flags: `--models a,b,c` · `--trials N` · `--dry-run` ·
`--skip-screenshots` · `--out <dir>` · `--list-models`.

Typical loop when triggering from Claude Code: set the keys as environment
secrets, ask Claude to run the bench, review the screenshots it shows you (or
open `review/index.html` locally), give scores, and let it merge them into
`report.md` and commit.

## Results layout

```
bench/results/<runId>/
  run.json            committed — full mechanical record, versions pinned
  report.md           committed — the leaderboard + "which model for what"
  shots/*.png         committed — what each model's app looks like
  review/index.html   gitignored (regenerable; references artifacts/)
  review/scores.json  committed — your exported human scores
  artifacts/…         gitignored — transcript.md, files/, preview.html per trial
```

## Stability rules (what makes runs comparable over time)

- **The task is frozen.** Never edit `task.ts`'s prompt or the meaning of its
  checks in place — bump `TASK_VERSION` instead. Reports carry the version;
  never compare a v1 number against a v2 number.
- Adding a model is one entry in `models.ts` (announced-but-unreleased models
  sit there with `enabled: false` until their API id is live; naming one
  explicitly in `--models` runs it anyway).
- Token counts and costs are **chars ÷ 4 estimates** at list prices —
  directional, not billing-grade. `run.json` marks them `estimated: true`.
- Providers send no temperature (production parity), so generations vary;
  for decision runs use `--trials 3` and read medians, never single shots.

## Known limits (v1)

- One build task: measures first-build quality, not edit discipline. The
  natural v2 addition is an edit task against a frozen seed project — it
  slots into the same harness.
- Claude runs use the direct API path (adaptive thinking, xhigh effort) —
  the same request shape production's llm-proxy sends upstream.
- Screenshots prefer Playwright (network fulfilled via Node fetch, so
  intercepting proxies don't blank the CDN fetches) and fall back to plain
  `chromium --screenshot`; with neither installed they're skipped and the
  review page still works.
