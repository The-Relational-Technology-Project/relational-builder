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
- **Live preview** -- see your app running in real time as the AI generates it (powered by Sandpack)
- **RTP Knowledge Base** -- browse 20+ community tools and 45+ stories from the relational tech network, all injected into the AI's context
- **Network Activity feed** -- see what other builders are shipping across the ecosystem, pulled live from [updates.relationaltechproject.org](https://updates.relationaltechproject.org)
- **Publish to Commons** -- export your project as a zip with a `.reltech.yml` manifest, push to GitHub, and the [network watcher](https://github.com/The-Relational-Technology-Project/watcher) discovers it automatically
- **Resizable panels** -- drag dividers to resize the chat, preview, and knowledge panels
- **Session persistence** -- your chat and project files survive page refreshes via localStorage
- **Model-agnostic** -- works with Claude, OpenAI, OpenRouter, or any OpenAI-compatible endpoint

## Guiding Principles

This project is guided by the five core principles of the [Relational Technology Project](https://github.com/The-Relational-Technology-Project):

- **Technology built by the people it serves** -- community members shape the tools, not outside developers
- **River, not gardener** -- technology should flow like infrastructure, not require constant tending
- **Relationships first** -- connection between people is the goal; technology is just the means
- **Asset-based** -- start from what a community already has, not what it lacks
- **Speed of trust** -- move at the pace relationships allow; don't rush adoption

## Open and Accessible

A neighborhood builder should be able to visit a URL and start building without signing up for anything or entering a credit card. The default experience will run on an RTP-hosted open-source model -- no API keys required. Users who want higher-quality output can bring their own API keys for Claude, OpenAI, or other providers.

## Architecture

```
Chat Panel          |  Preview Sandbox   |  Knowledge / Files / Network
                    |  (Sandpack)        |
               Orchestration Layer
     (model router, RTP context injection, project state)
                    |
               Provider Layer
     (RTP-hosted vLLM | Claude BYOK | OpenAI BYOK | OpenRouter)
                    |
             Supabase Backend              Network Watcher
     (RTP library, tools, stories)    (updates.relationaltechproject.org)
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

# Start the dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start building.

### API Keys

To use cloud models, click **Settings** in the toolbar and enter your API key:

- **Claude** -- get a key at [console.anthropic.com](https://console.anthropic.com)
- **OpenAI** -- get a key at [platform.openai.com](https://platform.openai.com)
- **OpenRouter** -- get a key at [openrouter.ai](https://openrouter.ai)

## Project Structure

```
src/
  components/         React components
    Chat/             Chat interface (panel, messages, input)
    KnowledgeBase/    KB panel, tool/story cards, network feed
    ui/               shadcn/ui primitives
  providers/          LLM provider abstraction
  store/              Zustand stores (provider, chat, project)
  project/            Virtual file system, code extractor, export
  knowledge/          Supabase client, RTP principles, context builder
```

## Publishing to the Commons

When your project is ready to share:

1. Click **Publish** in the toolbar
2. Name your project and download the zip
3. Push the contents to a new GitHub repository
4. Add the `relational-tech` topic to your repo

The [network watcher](https://github.com/The-Relational-Technology-Project/watcher) scans for repos with this topic twice daily. Your project will appear on [updates.relationaltechproject.org](https://updates.relationaltechproject.org) and become visible to other builders in the network.

The zip includes a `.reltech.yml` manifest that configures how the watcher tracks your project.

## Related Projects

- [RTS Studio](https://github.com/The-Relational-Technology-Project/rtstudio) -- the knowledge base and community platform
- [Relational Tech Watcher](https://github.com/The-Relational-Technology-Project/watcher) -- the network activity feed
- [Relational Technology Project](https://github.com/The-Relational-Technology-Project) -- the parent organization

## License

MIT
