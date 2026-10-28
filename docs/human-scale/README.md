# Human-scale branch

An experiment in making Relational Builder itself human-scale AI: a builder
for neighborhood tools that can run on open models communities host, and
that makes apps which are small, local and owned by the people who use them.
It backs an application to the Mozilla Foundation Human-Scale AI Incubator
(due Nov 20, 2026). The full brief is [BRIEF.md](BRIEF.md); this file is the
brief applied to this repo as it stands on Oct 28, 2026.

Everything here lives on the `human-scale` branch behind a flag. `main` and
the live Builder are untouched until a workstream earns a PR.

How the work runs day to day: [DAILY-RUN.md](DAILY-RUN.md) (the loop),
[LOG.md](LOG.md) (journal, newest first), [NEXT.md](NEXT.md) (the queue and
the questions for Josh), [SPEND.md](SPEND.md) (every paid call).

## The principles, as RB behaviors

| Principle | What it means in this codebase |
|---|---|
| Sized to the problem | The Builder already auto-picks a model per stage (`resolveCommunityModelDefault` in `src/store/community-store.ts`: Fable for plan mode, Opus for builds and edits). "Smallest model that passes" means that resolver can choose an open-weight model when the task shape allows, and the chat says which model ran. The bench decides what "passes" means. |
| Bounded jobs, not chatbots | Built apps reach AI through one door today: the `ai_chat` action on the `app-capabilities` edge function, an open completion. The scaffold and system prompt (`buildSystemPrompt` in `src/knowledge/context-builder.ts`) should steer new apps toward named functions (summarize, match, resurface) over a prompt box. |
| Keep the record checkable | Generated text in built apps carries a link back to the note or recording it came from. A scaffold convention plus a prompt rule, not a framework. |
| Local and community-held | The Builder side exists: the local (Ollama) preset in `src/providers/openai-compatible.ts` (`createLocalProvider`), documented in `docs/LOCAL-MODEL.md`. The runtime side does not: `ai_chat` runs on a vaulted Anthropic/OpenAI/Gemini key or RTP's shared Anthropic key with Claude Opus. Workstream 1 adds the open-weight runtime option. |
| Data sovereignty | Export exists (`src/project/export.ts`, a zip with `.reltech.yml`), delete exists (`deleteProject` in `src/store/cloud-store.ts`). Neither has a test, and export does not yet include an app's stored data (`app-data`). Workstream 4 makes both complete and proven. |
| Footprint visible | The bench estimates cost from chars/4 and list prices (`bench/lib/cost.ts`); production records nothing about where a call ran. Workstream 3 records model, parameter count, host and tokens per call and adds a labeled energy estimate. |
| Plurality, not scale | The commons already carries place (`metadata.location`, `src/knowledge/geo.ts`) and lineage (`.reltech.yml`). Template metadata gains a community field; remix stays the verb. |
| Tools that strengthen ties | Templates ship with the human practice around them (who stewards, when people meet), in the template's own README, not only in the code. |
| Whose voice | Apps holding shared memory show who contributed what. A scaffold convention for shared-content apps. |

## Where model selection lives today

Builder side (the model that writes the app):

- `src/providers/registry.ts`: every provider, in order. Claude first; the
  RTP-hosted Tier 1 provider only when `VITE_RTP_MODEL_URL` is set (it is not
  today, so there is no free open-weight builder); BYOK providers; the keyless
  local preset last.
- `src/store/provider-store.ts`: `activeModelId` (default `claude-opus-5-5`)
  and `modelPinned` (the person chose it themselves). Migrations v1 to v8 walk
  retired defaults forward.
- `src/store/community-store.ts`: `resolveCommunityModelDefault` picks the
  stage model for free community building (plan vs. first build vs. edit).
- `src/components/Chat/ChatPanel.tsx` around line 535: where that resolver is
  applied per send, and where the automatic switch is announced in chat.
- `src/providers/model-label.ts`: how models are named in the UI.

Runtime side (the model a built app calls):

- `supabase/functions/app-capabilities/index.ts`: the `ai_chat` action. A
  builder-vaulted key (anthropic, openai, gemini) wins; otherwise Community AI
  on `ANTHROPIC_COMMUNITY_KEY` with Claude Opus, metered against the owner's
  weekly budget. No open-weight option, no local option, no per-project model
  setting.
- The generated app calls it with its public `app_id` and `app_key`, the same
  way it calls `app-data`.

Bench:

- `bench/` is the harness: one frozen task (`bench/task.ts`, `TASK_VERSION`),
  experiment tasks (`bench/tasks.ts`, `exp-*` versions), edit tasks
  (`bench/edit-task.ts`), the model matrix (`bench/models.ts`, which already
  lists Together open models and OpenRouter mirrors), cost estimates
  (`bench/lib/cost.ts`), and reports (`bench/lib/report.ts`). Results are
  committed under `bench/results/<runId>/`. Latest run: Sept 23, 2026, Opus
  5.5 only, effort comparison.
- `bench/retrieval-eval.ts` already measures commons retrieval on a golden
  set, which is the base for the "small model plus commons patterns" variant.
- No open-weight model has a committed result yet.

Not present in the repo at all: a unit test runner. `npm run lint` and
`tsc -b` are the checks. "Verify with a test" (workstream 4) needs vitest
added on this branch first.

## The flag and config shape (proposal)

**Flag.** `VITE_HUMAN_SCALE=1` at build time, read through one module,
`src/human-scale/flag.ts`, with a `?humanScale=1` URL override that sticks in
localStorage so a Vercel preview of the branch can be tried without a separate
environment. Nothing outside `src/human-scale/` and the places it is wired in
checks the flag directly. Off by default everywhere, including on this branch.

**Config.** One new per-project setting, `runtime`, persisted with the project
(`src/store/project-store.ts`) and written into `.reltech.yml` on export:

```yaml
runtime:
  kind: local | community | byok      # where the app's AI calls go
  endpoint: http://localhost:11434    # local only; a box in the room or the device
  model: qwen2.5:7b                   # local only
  fallback: none | community          # explicit, never silent
```

- `local` is the default for new projects when the flag is on. The app calls
  an OpenAI-compatible endpoint directly from the browser (same CORS story as
  `docs/LOCAL-MODEL.md`). First target: Ollama with a 1B to 8B Qwen or Gemma.
- `community` is today's behavior (Community AI through `app-capabilities`).
- `byok` is today's vaulted-key behavior.
- The kit gains one helper, `ai()` in `src/kit/files/lib/`, that reads the
  runtime config and exposes named functions (`summarize`, `match`,
  `resurface`) rather than a raw chat call. Generated apps import it; the
  system prompt tells the model to.

**Provenance record.** Every builder call and every runtime call appends one
row to a per-project log: `{at, side: builder|runtime, provider, model,
params (if known), host: local|hosted|community, tokensIn, tokensOut,
energyWhEstimate, method}`. `energyWhEstimate` is always labeled an estimate
and names its method. The build report and the app footer read from this.

Decisions this proposal leaves to Josh are in [NEXT.md](NEXT.md).

## Workstreams and status

| # | Workstream | Status |
|---|---|---|
| 1 | Builder/runtime split, open-weight runtime option | not started |
| 2 | Open-weight builder bench, Opus comparison, retrieval variant | not started |
| 3 | Footprint and provenance | not started |
| 4 | Export and delete, verified by tests | not started |
| 5 | Human-scale defaults in kickoff and scaffolding | not started |
| 6 | Anchor adapter stubs and governance template | not started |
| 7 | Demo build and walkthrough | not started |
