# Relational Builder

An open-source, web-based app builder for relational technology -- tools that strengthen neighborhood connection, care, civic information, and local resilience.

Describe what you want to build in natural language. AI generates working code informed by community principles and patterns. Publish your creation back to the commons.

## What This Is

Relational Builder combines three things that don't yet exist together:

1. **A builder interface** where you describe what you want and AI generates working code with a live preview
2. **The Relational Tech Studio knowledge base** -- principles, patterns, tools, and real stories from community builders -- woven into the AI's context so every build is relational-tech-aware
3. **A commons loop** where finished builds can be published back to the network, growing the knowledge base for the next builder

## Features

- **Chat-driven building** -- describe what you want in plain language, get working code
- **Plan & Build modes** -- sketch a structured build plan together first (grounded in relational framing), then press "Build this plan"; or build directly
- **Studio build plans** -- paste a Studio share link (or ID) and the plan is fetched as your starting draft, with lineage recorded automatically
- **RT Commons retrieval** -- every message runs a hybrid semantic + full-text search across the whole commons (tools, stories, recipes, the Neighboring Commons library, frameworks) and weaves the most relevant knowledge into the AI's context
- **Studio-aware building** -- pick a Studio from the network (or arrive via a `?studio=` link) and build inside its frame: the studio's principles layer onto the base RTP principles in the AI's context (append-only, never replacing), and the studio travels in your project's lineage
- **Offer builds back to the commons** -- after publishing, share your build to the commons contribution queue (consent-first, steward-reviewed, credited by name)
- **Community access** -- invited pilot builders get free Claude building via RTP's subsidized key, gated server-side with daily budgets — no API key, no credit card
- **Cloud projects & collaboration** -- sign in with a magic link, save projects to the cloud, and add collaborators by email; edits sync live via Supabase Realtime
- **Live preview** -- see your app running in real time as the AI generates it (powered by Sandpack)
- **Image input** -- attach or paste a sketch, screenshot, or mockup and the AI builds from it (works with Claude and Gemini vision)
- **Targeted edits** -- the AI sees your current files and makes surgical SEARCH/REPLACE changes instead of rewriting whole files (faster, cheaper, safer on big projects)
- **Ask AI to fix it** -- when the preview breaks, one click hands the exact error back to the AI for a repair (no copy-pasting stack traces)
- **Point at it** -- toggle select mode in the preview, click any element in your running app, and the chat is prefilled with what you pointed at — describe the change in plain words, no selectors or code-speak
- **Version history** -- every AI change is a restorable checkpoint; walk back a bad stretch (or forward again) from the chat
- **RTP Knowledge Base** -- browse 20+ community tools and 45+ stories from the relational tech network, all injected into the AI's context
- **Network Activity feed** -- see what other builders are shipping across the ecosystem, pulled live from [updates.relationaltechproject.org](https://updates.relationaltechproject.org)
- **Publish to Commons** -- export your project as a zip with a `.reltech.yml` manifest, push to GitHub, and the [network watcher](https://github.com/The-Relational-Technology-Project/watcher) discovers it automatically
- **Community Hosting** -- one-click free hosting from RTP (3 sites per builder, no platform accounts or tokens) with privacy-friendly visit counts; Netlify/Vercel still available for bigger needs
- **My Sites dashboard** -- your live community-hosted sites on the home screen: views, weekly activity, and take-down — the "is it alive?" surface for showing your neighborhood what the work is worth
- **Neighbor notes** -- every community-hosted site gets a built-in "leave a note" widget (no accounts, no tracking); notes flow back to your dashboard, so building *with* neighbors has a return channel (opt out per site with `<meta name="rb-feedback" content="off">`)
- **Deploy to Netlify/Vercel** -- deploy directly from the builder with a personal access token
- **GitHub two-way sync** -- connect a GitHub repo, push project files as atomic commits, and pull remote changes back into the builder
- **RAG-powered context** -- AI responses informed by the most relevant KB tools, stories, and network activity for each message
- **Share preview links** -- generate a shareable link (via CodeSandbox) that anyone can open — no signup needed, perfect for sharing with neighbors
- **Service integrations** -- connect Supabase, Neon, Resend, and Firecrawl in the Services tab; the AI knows what's connected and generates code that uses it (secrets only ever reach deploy platforms)
- **Environment variables** -- add API keys and config in the Env panel; public vars are injected into the live preview, secret vars are only sent to deploy platforms
- **Custom domains** -- attach your own domain (e.g. myapp.ourneighborhood.org) when deploying to Netlify or Vercel, with DNS setup instructions
- **Resizable panels** -- drag dividers to resize the chat, preview, and knowledge panels
- **Session persistence** -- your chat and project files survive page refreshes via localStorage (and the cloud when signed in)
- **Model-agnostic** -- latest models from Anthropic (Claude Opus 4.8, Sonnet 5, Haiku 4.5), Google (Gemini 3.5), OpenAI (GPT-5.5), Together AI, OpenRouter, or any OpenAI-compatible endpoint

## Guiding Principles

This project is guided by the core principles of the [Relational Technology Project](https://github.com/The-Relational-Technology-Project):

- **Technology is a trojan horse for community building** -- it enters daily life through practical needs while opening space for deeper connection
- **The 90/10 principle** -- 90% of the work is community presence and relationship-building; 10% is building technology. AI makes the 10% more accessible but must never eat into the 90%
- **River, garden, commons** -- RTP is the river carrying stories and tools across local gardens, while each garden is tended by those who live there
- **Agency, belonging, trust** -- every build should nurture these three dimensions of healthy relational soil
- **The practice cycle** -- observe, invite, relate, build, share — how we build matters more than what we build
- **Open source and remixing** -- scale deep in place and spread horizontally, neighborhood to neighborhood, through remixing rather than replication

## Open and Accessible

A neighborhood builder should be able to visit a URL and start building without signing up for anything or entering a credit card. The default experience will run on an RTP-hosted open-source model -- no API keys required. Users who want higher-quality output can bring their own API keys for Claude, OpenAI, or other providers.

## Architecture

```
Chat Panel          |  Preview Sandbox   |  Knowledge / Files / Network
                    |  (Sandpack)        |
               Orchestration Layer
     (model router, RAG context injection, project state)
                    |
               Provider Layer
     (RTP-hosted vLLM | Claude BYOK | OpenAI BYOK | OpenRouter)
                    |
     ┌──────────────┼──────────────┬────────────────────┐
  Supabase          |         GitHub API          Network Watcher
  (KB tools,     Deploy         (two-way        (updates.relational
   stories)   (Netlify/Vercel)   file sync)     techproject.org)
```

## Tech Stack

- **Framework:** Vite + React + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand (persisted to localStorage)
- **Preview:** Sandpack (CodeSandbox runtime, Apache 2.0)
- **Database:** Supabase (shared with RTS Studio)
- **Network feed:** [Relational Tech Watcher](https://github.com/The-Relational-Technology-Project/watcher)

Provider abstraction inspired by [Dyad](https://github.com/dyad-sh/dyad) (Apache 2.0).

## Getting Started

```bash
# Clone the repo
git clone https://github.com/The-Relational-Technology-Project/relational-builder.git
cd relational-builder

# Install dependencies
npm install

# Copy env config (optional — works without it for local dev)
cp .env.example .env

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start building.

### LLM Proxy (Production)

In production, LLM API calls route through a Supabase Edge Function (`supabase/functions/llm-proxy`) to avoid CORS issues and keep API keys server-side. The proxy accepts OpenAI-compatible requests and translates them for each provider (Anthropic, OpenAI, RTP-hosted vLLM).

```bash
# Deploy the proxy (requires Supabase CLI)
supabase functions deploy llm-proxy --no-verify-jwt

# Set the proxy URL in your .env
VITE_LLM_PROXY_URL=https://YOUR_PROJECT.supabase.co/functions/v1/llm-proxy
```

Without a proxy URL, Claude falls back to direct browser-to-Anthropic calls (fine for local development with BYOK).

### API Keys

To use cloud models, click **Settings** in the toolbar and enter your API key:

- **Claude** -- get a key at [console.anthropic.com](https://console.anthropic.com) (Opus 4.8, Sonnet 5, Haiku 4.5)
- **Google Gemini** -- get a key at [aistudio.google.com](https://aistudio.google.com/apikey) (Gemini 3.5 Flash, 3.1 Pro)
- **OpenAI** -- get a key at [platform.openai.com](https://platform.openai.com)
- **Together AI** -- get a key at [api.together.ai](https://api.together.ai)
- **OpenRouter** -- get a key at [openrouter.ai](https://openrouter.ai)

## Project Structure

```
src/
  components/         React components
    Chat/             Chat interface (panel, messages, input, plan/build toggle)
    KnowledgeBase/    KB panel, tool/story cards, network feed
    ui/               shadcn/ui primitives
  providers/          LLM provider abstraction (Claude, Gemini, OpenAI, Together, OpenRouter, RTP)
  store/              Zustand stores (provider, chat, project, github, deploy, env, knowledge, auth, cloud)
  project/            Virtual file system, code extractor, export, deploy, GitHub API, share preview
  knowledge/          Supabase client (RTS Studio KB, read-only), RTP principles, context builder
  cloud/              Builder backend client, auto-save + realtime sync
  integrations/       Service catalog (Supabase, Neon, Resend, Firecrawl)
supabase/
  functions/llm-proxy Edge function routing model calls server-side
  migrations/         Builder backend schema (accounts, projects, collaboration)
```

## Cloud Projects & Collaboration

Sign in with an email magic link (no passwords) to save projects to the cloud.
From the **Projects** dialog you can invite a collaborator by email — when they
sign in with that address the project appears in their list, and edits sync
live between everyone via Supabase Realtime (last save wins per project).
Everything still works signed-out in local-only mode.

Setting up the backend takes about five minutes — see [DEPLOY.md](DEPLOY.md).

## GitHub Sync

Click **GitHub** in the toolbar to connect a repository:

1. Enter a GitHub Personal Access Token with `repo` scope
2. Select an existing repo or create a new one (auto-adds the `relational-tech` topic)
3. **Push** -- commits all project files to the repo as a single atomic commit
4. **Pull** -- fetches all files from the repo into the builder

Tokens are saved to localStorage. The sync uses GitHub's Git Data API for atomic multi-file commits (blobs → tree → commit → ref update).

## Publishing & Deploying

When your project is ready to share, click **Publish** in the toolbar. You have three options:

- **Download** -- get a zip file with all project files, a `.reltech.yml` manifest, and a README
- **Netlify** -- deploy directly to Netlify with a personal access token ([get one here](https://app.netlify.com/user/applications#personal-access-tokens))
- **Vercel** -- deploy directly to Vercel with an access token ([get one here](https://vercel.com/account/tokens))

Both Netlify and Vercel deploys support **custom domains** — enter your domain (e.g. `myapp.ourneighborhood.org`) and the builder will register it with the platform and show you the DNS records to add at your registrar. SSL is automatic.

To join the relational tech network, push your code to GitHub and add the `relational-tech` topic. The [network watcher](https://github.com/The-Relational-Technology-Project/watcher) scans for this topic twice daily and your project will appear on [updates.relationaltechproject.org](https://updates.relationaltechproject.org).

## Sharing Previews

Click **Share** in the toolbar to generate a preview link powered by CodeSandbox. You get two URLs:

- **Preview link** (`{id}.csb.app`) -- a clean, neighbor-friendly URL showing just the running app. No signup, no code, no IDE. Share this via text or email.
- **Editor link** (`codesandbox.io/s/{id}`) -- the full CodeSandbox IDE for developers who want to view or remix the code.

Public environment variables are included in shared previews. Secret variables are never shared.

## Environment Variables

The **Env** tab in the right panel lets you manage API keys and config:

- **Public vars** (e.g. `SUPABASE_URL`, `SUPABASE_ANON_KEY`) -- injected into the live preview and shared CodeSandbox links. Safe for client-side use (protected by RLS).
- **Secret vars** (e.g. `RESEND_API_KEY`, Supabase service role key) -- stored locally, shown masked in the UI, and only sent to deploy platforms as environment variables. Never included in previews or shared links.

Generated code imports env vars from an auto-generated module: `import { env } from "./env"`. The AI knows about this system and will tell you which variables to add.

## Recommended Services

The AI recommends these services when your project needs backend or integrations:

| Need | Service | Why |
|------|---------|-----|
| Database & Auth | [Supabase](https://supabase.com) | Postgres, auth, storage, realtime. Free tier. |
| Email | [Resend](https://resend.com) | Simple transactional email API. |
| SMS & Messaging | [Twilio](https://twilio.com) | SMS, voice, WhatsApp for community notifications. |
| Web Scraping | [Firecrawl](https://firecrawl.dev) | Scrape community calendars and websites. |
| Hosting | [Netlify](https://netlify.com) / [Vercel](https://vercel.com) | Static sites and serverless functions. |

These are woven into the AI's system prompt so it generates code with the right integrations.

## Related Projects

- [RTS Studio](https://github.com/The-Relational-Technology-Project/rtstudio) -- the knowledge base and community platform
- [Relational Tech Watcher](https://github.com/The-Relational-Technology-Project/watcher) -- the network activity feed
- [Relational Technology Project](https://github.com/The-Relational-Technology-Project) -- the parent organization

## License

MIT
