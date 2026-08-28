# RTP Model Bench

A small, cost-conscious benchmark for deciding **which models Relational
Builder should use, and for what** — the community first-build default, the
edit-step model, BYOK recommendations, and open-model candidates for the free
RTP-hosted tier.

It also carries two **commons retrieval evals** (see below): a free golden-set
eval of the RT Commons search pipeline, and an LLM-judged eval of whether
surfaced knowledge actually lands in plans.

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

## Plan-phase bench

The strategy stage gets its own bench — plans shape everything downstream of
them, and `COMMUNITY_PLAN_MODEL` (Fable 5) was chosen on judgment, not
numbers. This is the bench that judgment call asked for.

```bash
npm run bench -- plan selftest        # checks + writers on canned replies, free
npm run bench -- plan --dry-run       # live retrieval + prompt sizes, no model calls
npm run bench -- plan                 # the production default model, 3 scenarios, ~$1
npm run bench -- plan --models claude-fable-5,claude-opus-5 --trials 3
npm run bench -- plan report bench/results/plan/<runId>   # merge scores.json → report.md
npm run bench -- plan review bench/results/plan/<runId>   # regenerate review page
```

**Frozen inputs** (`plan-tasks.ts`, versioned — bump `PLAN_SCENARIOS_VERSION`
to change anything): a normal neighborhood **project** ask (community garden;
the shaping Q&A is scripted so the measured reply is the drafted plan), a
normal relational-tech **tool** request (a lending board, same shape), and an
open-ended **starter** seed — where the correct reply explores (directions +
one-tap questions) and drafting a document is the failure.

**Production pipeline, for real:** live commons retrieval through the
retrieval policy, frames sensed from what surfaced, `buildPromptContext` in
plan mode, and the volatile turn context appended to the outgoing user
message after `TURN_BREAK` — the exact message shape ChatPanel sends. The
default model is imported from `COMMUNITY_PLAN_MODEL`, so a bare run always
measures what community builders actually get. Retrieval runs once per
scenario per run: every model sees the same surfaced set (fair within a
run); the corpus is live, so drift across runs is expected and recorded.
Known deltas from production: anonymous builder (no profile/ecosystem
sections) and web tools off.

**Scoring — three layers:**

1. **Mechanical** (free, `lib/plan-checks.ts`): the plan-mode contract a
   regex can hold — sections present, one real `PROJECT-NAME`, First build
   ≤6 items with a Later list, Look & feel committing to a hex + a named
   font, no code blocks, no question section in a draft (and for the seed:
   no draft, correct "Question for you" format, brevity), plus commons
   grounding via the production chip matcher.
2. **Judge** (`lib/judge.ts`, shared with the design eval, ~cents): the
   factual honesty questions only — which surfaced entries the plan drew
   on, and whether it fabricated commons-ish citations. Aesthetics stay
   human.
3. **Human review** (the score that decides): `review/index.html`, blinded,
   plans side by side per scenario. Three dimensions, **0–10** each — RT
   alignment, creativity, overall quality — with **overall weighted 2×**:
   composite = (RT + creativity + 2×overall) / 4. Export → save as
   `review/scores.json` → `plan report` merges it.

Results land in `bench/results/plan/<runId>/` (same commit rules as model
runs: `run.json`, `report.md`, `review/scores.json` committed; `artifacts/`
and the review page regenerable, gitignored). Generations vary — decision
runs want `--trials 3` and medians, same as the model bench.

## Commons retrieval evals

Two additional subcommands measure the knowledge side of the Builder — how
well RT Commons retrieval finds, filters, and lands in plans. They use the
same Vite-SSR harness (production `searchCommons`, the retrieval policy in
`src/knowledge/retrieval.ts`, the production `buildPromptContext` with the
turn context sent production's way).

### Layer 1 — retrieval golden set (free, no LLM)

```bash
npm run bench -- retrieval
```

Runs `bench/retrieval-golden.ts` (~24 frozen queries) against the LIVE
commons hybrid search plus the client pipeline, and reports **recall@K**,
**MRR**, **noise leakage** (mid-build edits and off-topic asks must come back
empty past the relevance floor), the **text-arm canary** (exact keyword
queries must produce `text`/`both` matches — the FTS half of the hybrid
search fails silently otherwise), and kept/dropped **similarity
distributions** so floor drift is visible as the corpus grows. Pure pipeline
selftests (turn gating, topic derivation, query blending, mention matching)
run first with no network. Exits 1 on threshold failures, so it can gate CI.
Results land in `bench/results/retrieval/<stamp>.json` (committed — they're
the drift record).

Baseline (2026-08, golden v1): recall 100%, MRR 0.96, leakage 2/9 (both
borderline ~0.60 semantic hits), text arm 4/4.

When a case fails after a corpus change, first check whether the corpus moved
(an entry renamed or re-slugged) before touching the pipeline; expectations
live in `retrieval-golden.ts` and bump `GOLDEN_VERSION` when they change.

### Layer 2 — design eval (LLM-judged, ~$1 on Sonnet)

```bash
export ANTHROPIC_API_KEY=…
npm run bench -- design-eval            # --model / --judge to override, --dry-run for pipeline-only
```

Five scenarios run the real plan-mode pipeline end to end (live retrieval →
production system prompt → real generation), then an LLM judge answers three
factual questions: which surfaced entries the plan **referenced**, whether it
**fabricated** commons-ish citations that weren't surfaced, and whether it
**shoehorned** community framing into a generic ask. A mechanical title-match
cross-check (the same matcher that drives the in-app "Drew on the commons"
chips) corroborates the judge. The model bench's no-LLM-judge rule doesn't
apply here: these questions are factual, not aesthetic. Generations vary —
re-run before treating a single failure as a regression. Artifacts land in
`bench/results/design-eval/<stamp>/` (per-scenario plan + judge verdict).
