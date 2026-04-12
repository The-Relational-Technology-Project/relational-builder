# Relational Builder — Project Context for Claude Code

## What This Is

An open-source, web-based app builder for relational technology. Users describe what they want to build in natural language; AI generates working code informed by RTP principles and community knowledge.

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
- **Preview:** WebContainer API or esbuild-wasm (TBD)
- **Models:** Three-tier provider system
  - Tier 1: RTP-hosted open-source model (free default, no API key)
  - Tier 2: BYOK cloud models (Claude, OpenAI, OpenRouter)
  - Tier 3: RTP-subsidized cloud access (for workshops/pilots)

## Key Directories

- `src/providers/` — LLM provider abstraction (types, OpenAI-compatible, Claude, registry)
- `src/store/` — Zustand stores (provider config, chat state)
- `src/components/` — React components (UI lives here)
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
