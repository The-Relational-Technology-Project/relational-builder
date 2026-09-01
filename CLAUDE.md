# Relational Builder — Project Context for Claude Code

## What This Is

An open-source, web-based app builder for relational technology. Users describe what they want to build in natural language; AI generates working code informed by RTP principles and community knowledge.

## Working Agreement (owner's preference)

- **Never commit to `main`.** Every change goes on a branch and reaches `main`
  only through a pull request — including one-line fixes, doc edits, and
  anything that feels too small to bother. There is no "routine work"
  exception, because that exception is how everything ends up on `main`.
- **Branch, push, and open the PR without being asked**, once a change is
  complete and verified. All three are part of finishing; don't stop after the
  commit and wait for permission to push, and don't leave verified work sitting
  on a branch with no PR.
- **Then stop.** Merging is the owner's call. Don't merge your own PR, and
  don't fast-forward `main` onto a branch to "help it along".
- **An assigned branch is the destination, not a staging step.** If a task,
  harness, or session prompt assigns a working branch (e.g. `claude/…`),
  develop there and open the PR from there. Never promote it to `main` yourself.
- `main` is meant to be protected on GitHub (require a pull request before
  merging). If a direct push to `main` ever succeeds, that's a gap in the
  setup — not permission. Fix the workflow, never the protection.
- Still call out anything genuinely risky or irreversible before doing it.

## Deploying / Supabase Operations

- **Default to the Supabase Management API** (`https://api.supabase.com/v1/...` with `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` from the environment) for anything Supabase — deploying edge functions, secrets, config. Don't reach for the `supabase` CLI first: its upload transport fails through the sandbox proxy (`TransportError`), while direct API calls work fine.
- Edge function deploy, for reference:
  `curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -F 'metadata={"name":"<slug>","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' -F 'file=@supabase/functions/<slug>/index.ts;type=application/typescript' "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/deploy?slug=<slug>"`
- Smoke-test after deploy (e.g. a credential-less POST should return the function's own error JSON, not a platform 5xx).

## Architecture

```
Chat/Builder Panel  |  Preview Sandbox (iframe)  |  RTP Knowledge Base Panel
                    |                            |
               Orchestration Layer
          (model router, RTP context injection, project state)
                    |
               Provider Layer
    (RTP-hosted vLLM | Claude BYOK | OpenAI BYOK | OpenRouter)
                    |
             Supabase Backend
    (RTP library, build commons, user projects)
```

## Tech Stack

- **Framework:** Vite + React + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand (persisted to localStorage)
- **Database:** Supabase (Postgres) — shared with RTS Studio
- **Preview:** two engines, routed by project shape (`src/preview/detect.ts`):
  - *Framework apps* (`@/` aliases, vite config, `/src/main.*`) — in-browser
    esbuild-wasm bundler (`src/preview/bundler/`): bare imports pinned to esm.sh
    via an import map, CSS collected for Tailwind v4's browser JIT (`@theme`
    token blocks compile), blob-URL iframe. The same bundle+shell powers publish
    builds (`src/project/build-for-publish.ts`), so preview output ≡ deployed output.
  - *Simple tools* (single-file HTML/JS, plain React) — Sandpack, instant.
- **Code sync:** connecting a repo is the whole decision — after it,
  `src/project/auto-sync.ts` runs both directions on its own. Push settles
  ~6s after a change (never mid-generation, never an unchanged tree, never
  over commits the Builder hasn't pulled). Pull watches the repo (focus +
  2-min poll) and applies outside commits when the workspace still matches
  the last push — checkpoint first, plain-language summary to chat. Unpushed
  local edits make it a person's call instead: `RemoteChangesBanner` asks.
  All pushes go through `pushToRepo` in `src/project/code-sync.ts`.
  Imported repos that are LIVE for a community sync through a safe-copy
  branch (`relational-builder`) instead: `src/project/promote.ts` owns the
  three verbs — `publishToLive` (merge safe copy → live branch, the
  "Publish to your live site" button), `foldLiveChanges` (merge live →
  safe copy automatically when clean; collisions raise `liveConflict` and
  wait for a person), and `resetSafeCopyToLive` (the escape hatch).
- **Models:** Three-tier provider system
  - Tier 1: RTP-hosted open-source model (free default, no API key)
  - Tier 2: BYOK cloud models (Claude, OpenAI, OpenRouter)
  - Tier 3: RTP-subsidized cloud access (for workshops/pilots)

## Key Directories

- `src/providers/` — LLM provider abstraction (types, OpenAI-compatible, Claude, registry)
- `src/store/` — Zustand stores (provider config, chat state, project state)
- `src/project/` — Virtual file system, code extractor, publish builds
- `src/preview/` — preview engines: kind detection, esbuild-wasm bundler, inspector
- `src/kit/` — the RB component kit: shadcn-aligned sources (`files/` mirrors a
  generated project's `/src`) merged under the project VFS at bundle time and
  materialized into exports/repos via `withKitFiles()`. The theme contract lives
  in `src/kit/theme.ts` and is embedded into the system prompt — change either
  and prompt, preview, and exported scaffolds all follow
- `src/router.ts` — the app's addresses (`/`, `/gallery`, `/projects`, `/new`,
  …). `useUIStore.setView` writes the URL; `initRouting()` adopts it on boot
  and follows back/forward. Deep links need the SPA fallback rewrite in
  `vercel.json`. `#privacy` / `#contact` stay hash pages, above the app shell
- `src/knowledge/` — Supabase client, RTP principles, context builder, queries
- `src/components/` — React components (UI lives here)
- `src/components/Chat/` — Chat interface (panel, messages, input, code blocks)
- `src/components/ui/` — shadcn/ui primitives (don't edit directly)

## Design Principles

- **Open and accessible:** Default experience works with zero config — no API key, no signup
- **RTP-aware:** AI context includes the five RTP core principles and relevant knowledge base content
- **Model-agnostic:** Provider layer supports any OpenAI-compatible endpoint
- **Commons loop:** Built apps can be published back to the community library

## Provider Abstraction (inspired by Dyad, Apache 2.0)

Every provider implements `LLMProvider` interface from `src/providers/types.ts`:
- `isConfigured()` — whether provider has required config
- `getModels()` — list available models
- `chat(messages, model, callbacks, signal)` — streaming chat completion

## Conventions

- Use `@/` path alias for imports from `src/`
- Use shadcn/ui components for all UI (add via `npx shadcn@latest add <component>`)
- Keep stores thin — business logic in dedicated modules, not in store actions
- TypeScript strict mode — no `any` types without justification
