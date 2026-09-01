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
- **Plan & Build modes** -- Plan mode is the default for new builds: a real visioning phase that meets the idea where it is: bring a seed of an idea and it explores with you first — reflecting your place back, offering 2–3 distinct directions drawn from the commons by name, gathering the context that actually shapes the build — while a fully-baked ask goes straight to a plan. It grounds the tool in your place and people, names the neighboring practices around the tech, and asks one vision-level question at a time. Press "Build this plan" when it feels right — or build directly
- **Live progress while you wait** -- long generations show what's actually happening: reaching the model, the AI's own summarized thinking streaming past, files landing as they're written, elapsed time throughout
- **Builds that finish** -- an output budget sized for real multi-file apps (128k tokens), large builds that deliberately pause between files and continue on purpose instead of dying mid-file to a timeout, automatic continuation if a reply is ever cut off, and a one-tap recovery banner if a reload or dropped connection interrupts a build before its files are saved
- **Studio build plans** -- paste a Studio share link (or ID) and the plan is fetched as your starting draft, with lineage recorded automatically
- **Start from the Studio** -- the dashboard gallery turns live Studio library tools and shared build plans into starting points: tool cards distill into a place-adaptable build prompt that lands in Plan mode, so you shape it for your neighborhood before building fresh (full-code forking stays available for advanced use)
- **Prompts as first-class** -- every build can distill into a self-contained, travel-ready prompt ("Git for prompts"): save it with the project, version it, share it by link, and browse other builders' shared prompts in the gallery. The prompt travels in `.reltech.yml`, so the recipe spreads even when the code doesn't
- **RT Commons retrieval** -- every message runs a hybrid semantic + full-text search across the whole commons (tools, stories, recipes, the Neighboring Commons library, frameworks) and weaves the most relevant knowledge into the AI's context
- **Studio-aware building** -- pick a Studio from the network (or arrive via a `?studio=` link) and build inside its frame: the studio's principles layer onto the base RTP principles in the AI's context (append-only, never replacing), and the studio travels in your project's lineage
- **Offer builds back to the commons** -- after publishing, share your build to the commons contribution queue (consent-first, steward-reviewed, credited by name)
- **Community access** -- invited pilot builders get free Claude building via RTP's subsidized key, gated server-side with generous daily budgets — no API key, no credit card. Claude Opus 5 (the strongest builder on our bench) is the default for builds and edits; the daily budget also covers Fable 5, Opus 4.8, Sonnet 5, and Haiku 4.5, and picking a model in the picker pins it for that project. If Anthropic has an outage, community builds automatically fail over to a covered non-Anthropic model so a workshop never stalls
- **Community Cloud** -- one click gives any project a free shared data store hosted by RTP (3 backends per builder, 100MB each) with built-in neighbor email-code sign-in — no database accounts, no SQL
- **Cloud dashboard** -- the Cloud tab shows everything behind your apps: collections and documents (with moderation), the neighbors who've signed in, storage against the free tier, and backend settings — a friendly database console
- **Your neighbors' data is safe, and it's yours** -- every backend exports as one zip (full JSON plus a spreadsheet per collection and the neighbor list), daily server-side backups snapshot each backend that changed (kept two weeks deep, plus back-up-now on demand), and restore puts documents back atomically — with a pre-restore snapshot first, so even a restore is undoable
- **Quality review pass** -- after your first build, a fast second model quietly checks the result against what you asked for; real defects (dead buttons, broken references) trigger one automatic fix, solid builds pass in silence
- **Any web stack that fits** -- simple tools ship as plain HTML, richer ones as React, and "an app neighbors can install on their phones" becomes a real PWA (manifest + service worker) that installs from your published site
- **Home-screen ready by default** -- every published site (community hosting, preview links, Netlify, Vercel) automatically gets an app icon drawn from its name, a web manifest, and an apple-touch-icon, so "Add to Home Screen" on any phone shows a real icon — projects that bring their own icons keep them
- **Cloud projects & collaboration** -- sign in with a magic link, save projects to the cloud, and add collaborators by email; edits sync live via Supabase Realtime
- **Place-grounded builder profiles** -- a short onboarding captures your neighborhood, dreams, and tech comfort; every chat is shaped by who you are and where you build, and an optional personal design system makes your apps look like they come from you and your place
- **Build with others** -- an opt-in builders directory with consent-first, double-opt-in introductions; the chat can quietly suggest one relevant builder when your work overlaps with theirs (dismissible, never pushy)
- **Live preview** -- see your app running in real time as the AI generates it: simple tools render instantly via Sandpack, and full framework apps (`@/` aliases, npm packages, Tailwind v4 tokens, routing) run in an in-browser esbuild bundler — the same bundle that powers publishing, so preview output matches deployed output
- **AI artwork** -- when a build needs imagery no photo exists for yet (flyer art, custom icons), generate it in place through the proxy's image lane; real local photos still come first, and community members are covered by the same daily budget as chat
- **Shareable build reports** -- opt-in and consent-first: after a build settles, you can send stewards a report of how it actually went (timeline, chat, your feedback, an optional screenshot of the running app) — with a preview of exactly what's sent, and nothing assembled until you say yes
- **Notepad & Project Story** -- a Notepad tab for timestamped notes as the tool meets the street (ideas, neighbors' words, what happened); "Draft Story" synthesizes a first-person Project Story from everything the project remembers — notes, chat, build timeline, lineage — that you can edit and offer to the commons as a story contribution, whether or not the tool itself is shared
- **Build-ready notification** -- one browser notification, ever: your first build finishing while you're in another tab
- **Image input** -- attach or paste a sketch, screenshot, or mockup and the AI builds from it (works with Claude and Gemini vision)
- **Targeted edits** -- the AI sees your current files and makes surgical SEARCH/REPLACE changes instead of rewriting whole files (faster, cheaper, safer on big projects)
- **Auto-fix** -- when a fresh build throws an error in the preview, the exact error goes back to the AI for one automatic repair pass (bounded — it can never loop); if anything's left, "Ask AI to fix it" is one click, no copy-pasting stack traces
- **Security scan on publish** -- publishing runs a deterministic scan for leaked API keys and secret values in your files; findings are shown with file and line and a "let me fix it first" path (publishing anyway stays possible — it's your call, made informed)
- **Remix** -- pull any public GitHub repo into the builder as a starting point, with lineage recorded (and a friendly explanation — not an error — for server-rendered apps the browser can't preview)
- **Point at it** -- toggle select mode in the preview, click any element in your running app, and the chat is prefilled with what you pointed at — describe the change in plain words, no selectors or code-speak
- **Edit text without AI** -- point at a piece of copy and, when it lives at exactly one place in the source, a small editor opens right there: change the wording and save — instant, free, checkpointed like any AI change (ambiguous text falls back to the AI path automatically)
- **Version history** -- every AI change is a restorable checkpoint; walk back a bad stretch (or forward again) from the chat
- **Delete a file** -- hover any file in the Files tab and remove it, with one confirm step. Deletion is human-only on purpose: the AI writes and edits files, it never removes one. A checkpoint is taken first (so it's restorable from version history), and when a repo is connected the deletion travels there on the next sync instead of quietly living on in the repo
- **Network Activity feed** -- see what other builders are shipping across the ecosystem, pulled live from [updates.relationaltechproject.org](https://updates.relationaltechproject.org)
- **Publish to Commons** -- export your project as a zip with a `.reltech.yml` manifest, push to GitHub, and the [network watcher](https://github.com/The-Relational-Technology-Project/watcher) discovers it automatically
- **Community Hosting** -- one-click free hosting from RTP (3 sites per builder, no platform accounts or tokens) with privacy-friendly visit counts; Netlify/Vercel still available for bigger needs
- **My Sites dashboard** -- your live community-hosted sites on the home screen: views, weekly activity, neighbor notes, site health, version history, and take-down — the "is it alive?" surface for showing your neighborhood what the work is worth
- **Neighbor notes** -- every community-hosted site gets a built-in "leave a note" widget (no accounts, no tracking); notes flow back to your dashboard, so building *with* neighbors has a return channel (opt out per site with `<meta name="rb-feedback" content="off">`)
- **Site health** -- published sites carry a tiny error beacon (messages only, nothing about visitors); errors neighbors hit show on your dashboard, and when a site is really hurting you get one plain-language email with what broke and the two ways to fix it — at most one every three days per site (opt out with `<meta name="rb-monitor" content="off">`)
- **Published versions & rollback** -- every republish keeps the outgoing version (newest five), and any of them restores to the live address in one tap — with the current version snapshotted first, so a rollback is never a one-way door. Republishing is atomic: a failed upload can no longer leave a live site empty
- **Deploy to Netlify/Vercel** -- deploy directly from the builder with a personal access token
- **Code sync with any forge** -- connect a repo on GitHub, GitLab, or a community's own Forgejo/Gitea instance; after that the sync runs itself: changes push automatically once they settle, outside commits pull back in with a checkpoint and a plain-language summary in chat, and a README introducing the project is written on connect if it doesn't have one
- **RAG-powered context** -- AI responses informed by the most relevant KB tools, stories, and network activity for each message
- **Share preview links** -- generate a shareable link (hosted on community infrastructure, 30-day lifespan) that anyone can open — no signup needed, perfect for sharing with neighbors
- **Service integrations** -- connect Supabase, Neon, Resend, and Firecrawl in the Services tab; the AI knows what's connected and generates code that uses it (secrets only ever reach deploy platforms)
- **Environment variables** -- add API keys and config in the Env panel; public vars are injected into the live preview, secret vars are only sent to deploy platforms
- **Custom domains** -- attach your own domain (e.g. myapp.ourneighborhood.org) when deploying to Netlify or Vercel, with DNS setup instructions
- **Resizable panels** -- drag dividers to resize the chat, preview, and knowledge panels
- **Session persistence** -- your chat and project files survive page refreshes via localStorage (and the cloud when signed in)
- **Model-agnostic** -- latest models from Anthropic (Claude Opus 5 by default, plus Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5), Google (Gemini 3.5), OpenAI (GPT-5.5), Together AI, OpenRouter, or any OpenAI-compatible endpoint

## Guiding Principles

This project is guided by the core principles of the [Relational Technology Project](https://github.com/The-Relational-Technology-Project):

- **Technology is a trojan horse for community building** -- it enters daily life through practical needs while opening space for deeper connection
- **The 90/10 principle** -- 90% of the work is community presence and relationship-building; 10% is building technology. AI makes the 10% more accessible but must never eat into the 90%
- **River, garden, commons** -- RTP is the river carrying stories and tools across local gardens, while each garden is tended by those who live there
- **Agency, belonging, trust** -- every build should nurture these three dimensions of healthy relational soil
- **The practice cycle** -- observe, invite, relate, build, share — how we build matters more than what we build
- **Open source and remixing** -- scale deep in place and spread horizontally, neighborhood to neighborhood, through remixing rather than replication

## Open and Accessible

A neighborhood builder should be able to visit a URL and start building without signing up for anything or entering a credit card. Today that's real: invited builders sign in with a magic link and build free on Claude Opus 5 through RTP's community access — no API key, no billing, generous daily budgets, because early adopters deserve great experiences. Anyone can also bring their own API keys for Claude, Gemini, OpenAI, or other providers, and an RTP-hosted open-source model tier remains on the roadmap.

## Architecture

```
Chat Panel          |  Preview Sandbox        |  Knowledge / Files / Network
                    |  (esbuild bundler for   |
                    |  framework apps,        |
                    |  Sandpack for tools)    |
               Orchestration Layer
     (model router, RAG context injection, project state)
                    |
               Provider Layer
     (RTP-hosted vLLM | Claude BYOK | OpenAI BYOK | OpenRouter)
                    |
     ┌──────────────┼──────────────┬────────────────────┐
  Supabase          |         Forge sync          Network Watcher
  (KB, hosting,  Deploy      (GitHub/GitLab/     (updates.relational
   cloud data) (Netlify/Vercel)  Forgejo)        techproject.org)
```

## Tech Stack

- **Framework:** Vite + React + TypeScript
- **UI:** Tailwind CSS v4 + shadcn/ui
- **State:** Zustand (persisted to localStorage)
- **Preview:** two engines, routed by project shape — an in-browser esbuild-wasm bundler for framework apps (bare imports pinned to esm.sh, Tailwind v4 browser JIT; the same bundle powers publishing) and Sandpack (CodeSandbox runtime, Apache 2.0) for simple tools
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

In production, LLM API calls route through a Supabase Edge Function (`supabase/functions/llm-proxy`) to avoid CORS issues and keep API keys server-side. The proxy accepts OpenAI-compatible requests and routes them per provider (Anthropic gets a format translation; Gemini, OpenAI, OpenRouter, and other OpenAI-compatible endpoints pass through). It also gates community access (allowlist + daily budgets), serves the image-generation lane, and fails community builds over to a non-Anthropic model during outages.

```bash
# Deploy the proxy (requires Supabase CLI)
supabase functions deploy llm-proxy --no-verify-jwt

# Set the proxy URL in your .env
VITE_LLM_PROXY_URL=https://YOUR_PROJECT.supabase.co/functions/v1/llm-proxy
```

Without a proxy URL, Claude falls back to direct browser-to-Anthropic calls (fine for local development with BYOK).

### API Keys

To use cloud models, click **Settings** in the toolbar and enter your API key:

- **Claude** -- get a key at [console.anthropic.com](https://console.anthropic.com) (Opus 5, Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5)
- **Google Gemini** -- get a key at [aistudio.google.com](https://aistudio.google.com/apikey) (Gemini 3.5 Flash, 3.1 Pro)
- **OpenAI** -- get a key at [platform.openai.com](https://platform.openai.com)
- **Together AI** -- get a key at [api.together.ai](https://api.together.ai)
- **OpenRouter** -- get a key at [openrouter.ai](https://openrouter.ai)

## Project Structure

```
src/
  components/         React components
    Chat/             Chat interface (panel, messages, input, plan/build toggle)
    ui/               shadcn/ui primitives
  providers/          LLM provider abstraction (Claude, Gemini, OpenAI, Together, OpenRouter, RTP)
  store/              Zustand stores (provider, chat, project, github, deploy, env, knowledge, auth, cloud, community)
  project/            Virtual file system, code extractor, publish builds, deploys, GitHub API, security scan
  preview/            Preview engines: kind detection, esbuild-wasm bundler, element inspector
  kit/                RB component kit: shadcn-aligned sources merged into projects at bundle/export time
  knowledge/          Supabase client (RTS Studio KB, read-only), RTP principles, context builder, quality review
  cloud/              Builder backend client, auto-save + realtime sync
  report/             Build event log + opt-in build reports
  integrations/       Service catalog (Supabase, Neon, Resend, Firecrawl)
supabase/
  functions/          Edge functions: llm-proxy (model routing, community gating), community
                      hosting + cloud data, build reports, account request/steward flows
  migrations/         Builder backend schema (accounts, projects, collaboration, community cloud)
bench/                Model bench: one frozen build task run through the real production
                      pipeline, behind every model-choice decision (see bench/README.md)
docs/                 Roadmap, runbooks, strategy notes, and working plans
```

## Cloud Projects & Collaboration

Sign in with an email magic link (no passwords) to save projects to the cloud.
From the **Projects** dialog you can invite a collaborator by email — when they
sign in with that address the project appears in their list, and edits sync
live between everyone via Supabase Realtime (last save wins per project).
Everything still works signed-out in local-only mode.

Setting up the backend takes about five minutes — see [DEPLOY.md](DEPLOY.md).

## Code Sync

Click **Sync** in the toolbar to connect a repository on GitHub, GitLab, or a
community's own Forgejo/Gitea instance:

1. Enter a Personal Access Token for your forge (`repo` scope or equivalent)
2. Select an existing repo or create a new one (GitHub repos auto-add the
   `relational-tech` topic); a README introducing the project is written on
   connect if the project doesn't have one
3. From then on the sync runs itself: changes push automatically ~6 seconds
   after they settle (never mid-generation, never an unchanged tree), and
   commits made outside the Builder are pulled back in — checkpoint first,
   with a plain-language summary in chat. When you have unpushed local edits,
   bringing in remote changes becomes your call via a banner instead of a
   background task.

Tokens are saved to localStorage. Pushes are atomic multi-file commits on
every forge (GitHub's Git Data API; GitLab's and Forgejo's commit endpoints).

## Publishing & Deploying

When your project is ready to share, click **Publish** in the toolbar. You have four options:

- **Community hosting** -- one click, free, no platform accounts: your site goes live at `relationalbuilder.org/s/{name}/` with neighbor notes, view counts, site health, and version rollback built in
- **Download** -- get a zip file with all project files, a `.reltech.yml` manifest, and a README
- **Netlify** -- deploy directly to Netlify with a personal access token ([get one here](https://app.netlify.com/user/applications#personal-access-tokens))
- **Vercel** -- deploy directly to Vercel with an access token ([get one here](https://vercel.com/account/tokens))

Both Netlify and Vercel deploys support **custom domains** — enter your domain (e.g. `myapp.ourneighborhood.org`) and the builder will register it with the platform and show you the DNS records to add at your registrar. SSL is automatic.

To join the relational tech network, push your code to GitHub and add the `relational-tech` topic. The [network watcher](https://github.com/The-Relational-Technology-Project/watcher) scans for this topic twice daily and your project will appear on [updates.relationaltechproject.org](https://updates.relationaltechproject.org).

## Sharing Previews

Click **Share → Share preview** to generate a preview link hosted on RTP community infrastructure (the same place published sites live). You get a clean, neighbor-friendly URL (`/s/p-{id}/`) showing just the running app — no signup, no code, no IDE. Share it via text or email.

Preview links are unlisted, don't count against your 3 community-hosted sites, and expire after 30 days. When something's ready for a permanent home, use **Share → Publish** instead.

Public environment variables are included in shared previews. Secret variables are never shared.

## Environment Variables

The **Env** tab in the right panel lets you manage API keys and config:

- **Public vars** (e.g. `SUPABASE_URL`, `SUPABASE_ANON_KEY`) -- injected into the live preview and shared preview links. Safe for client-side use (protected by RLS).
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
