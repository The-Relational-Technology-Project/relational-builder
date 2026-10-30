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

- `community` is the default for new projects when the flag is on, and on
  this branch it runs an open-weight model through OpenRouter (Josh's call,
  Oct 28: hosted open models count as community-hostable). Today's Community
  AI on Claude Opus stays available as an explicit choice, never the silent
  default.
- `local` is one click away in the project's runtime setting. The app calls
  an OpenAI-compatible endpoint directly from the browser (same CORS story as
  `docs/LOCAL-MODEL.md`). First target: Ollama with a 1B to 8B Qwen or Gemma.
  When the endpoint is not reachable the helper says so plainly.
- `byok` is today's vaulted-key behavior.
- The kit gains one helper, `src/kit/files/lib/ai.ts` (`@/lib/ai` in a built
  app), that reads the runtime config and exposes named functions
  (`summarize`, `match`, `resurface`, plus `ask`) rather than a raw chat
  call. Generated apps import it; the system prompt tells the model to.
- As built (Oct 30): the setting is stored as four public env vars on the
  project (`AI_RUNTIME`, `AI_RUNTIME_ENDPOINT`, `AI_RUNTIME_MODEL`,
  `AI_RUNTIME_FALLBACK`) rather than a new store field, because the env
  store already persists per project and flows into preview, export and
  deploy as `env`. `src/human-scale/runtime.ts` is the one module that knows
  the keys; `.reltech.yml` gets the block above from it.

**Provenance record.** Every builder call and every runtime call appends one
row to a per-project log: `{at, side: builder|runtime, provider, model,
params (if known), host: local|hosted|community, tokensIn, tokensOut,
energyWhEstimate, method}`. `energyWhEstimate` is always labeled an estimate
and names its method. The build report and the app footer read from this.

Decisions this proposal leaves to Josh are in [NEXT.md](NEXT.md).

## The community-controlled stack: where each layer stands

The point of the daily loop is a Relational Builder a community could run
end to end without us or any one vendor. Each layer below is scored on
Oct 29, 2026, with what "community-controlled" means for it and the
evidence the application can cite. Every LOG entry names the layer it
moved. Layers with no path by Nov 20 are said so, not glossed.

| Layer | Today | Community-controlled means | Gap, and what moves it |
|---|---|---|---|
| Builder model (writes the app) | Claude Opus 5.5 by default, through RTP's proxy. Local Ollama preset exists; RTP's own vLLM tier is not live | An open-weight model a community can host, chosen by default when it passes the task | Workstream 2 bench decides which open model passes which tasks; `resolveCommunityModelDefault` then prefers it. Evidence: a committed bench report |
| Runtime model (the app calls it) | Per-project `runtime` setting (community, local, byok) behind the flag since Oct 30; `local` calls an OpenAI-compatible endpoint from the browser through the kit's `@/lib/ai`; `community` still reaches Claude Opus via `app-capabilities` until it is routed to an open model | Open-weight by default; local one click away; hosted frontier only by explicit choice | Workstream 1: the `runtime` setting, the kit helper, the community runtime on an open model through OpenRouter. Evidence: one template running on it |
| Inference hosting | OpenRouter and Anthropic. No community hardware | A box the community runs (Ollama, llama.cpp, vLLM) serving both builder and runtime | Workstream 1 local path plus `docs/LOCAL-MODEL.md`. Evidence: the demo built in a room off one box, or an honest note that it was not |
| The Builder app itself | Vercel, by RTP | Anyone can `npm run build` and serve it from their own host or box | [SELF-HOST.md](SELF-HOST.md): checklist run Oct 30 through serving and opening the built app with no env (screenshot). Still to run: the local-model steps, on a real box |
| Backend (accounts, projects, app data) | Two Supabase projects RTP runs, plus edge functions | A community can stand up its own Supabase or Postgres and point the Builder at it; local-only mode works with no backend | Local-only mode exists (no `VITE_BUILDER_SUPABASE_URL`). A self-host runbook for the backend is the gap; export and delete (workstream 4) are the data-sovereignty half |
| App hosting (published sites) | RTP community hosting, or Netlify and Vercel with the builder's token | Export is complete and open; any static host works; the app's data goes with it | Workstream 4. Evidence: a test that an exported zip contains app, data, content and config, and serves |
| Commons and knowledge | Supabase-backed commons RTP runs, 500+ items; prompt seeds, principles, patterns exported to `public/knowledge/*.md` | The commons is forkable and the retrieval works against a local copy | Mostly open already (markdown export, the MCP server). Gap: retrieval against a local copy. Low priority before Nov 20 |
| Footprint and provenance | Nothing recorded in production | Every call says model, where it ran, tokens, and a labeled energy estimate | Workstream 3 |

Priority for the loop, in order (Josh, Oct 30): the builder model via the
bench, evaluated on speed, error rates, design quality and code quality
against Opus; then footprint, export and delete, the runtime path's deploy,
and the self-host runbooks as time allows. The anchor stubs and the demo
come after those have evidence.

## Workstreams and status

| # | Workstream | Status |
|---|---|---|
| 1 | Builder/runtime split, open-weight runtime option | runtime setting, kit `ai` helper, settings card and prompt rule landed Oct 30 (behind the flag, tested); the community path still runs on today's Claude Opus until item 2 routes it to an open model |
| 2 | Open-weight builder bench, Opus comparison, retrieval variant | 12 commons tasks and 3 hostable open models added Oct 30; run one partial (3 builds, all bundled, two needed the auto-fix); Opus comparison and human review pending |
| 3 | Footprint and provenance | row shape and labeled energy estimate (`src/human-scale/provenance.ts`, `rb-flops-v1`) landed Oct 30 with tests; not yet recording |
| 4 | Export and delete, verified by tests | server side already complete (paged export, cascading delete); Builder-side data files for the zip landed Oct 30 with tests; not yet in the zip or the delete path |
| 5 | Human-scale defaults in kickoff and scaffolding | not started |
| 6 | Anchor adapter stubs and governance template | not started |
| 7 | Demo build and walkthrough | not started |
