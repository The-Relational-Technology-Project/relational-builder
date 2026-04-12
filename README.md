# Relational Builder

An open-source, web-based app builder for relational technology -- tools that strengthen neighborhood connection, mutual aid, civic information, and local resilience.

## What This Is

Relational Builder combines three things that don't yet exist together:

1. **A builder interface** where you describe what you want and AI generates working code
2. **The Relational Tech Studio knowledge base** -- principles, patterns, tools, and real stories from community builders -- woven into the AI's context so every build is relational tech aware
3. **A commons loop** where finished builds flow back into the library as tagged examples, growing the knowledge base for the next builder

## Guiding Principles

This project is guided by the five core principles of the [Relational Technology Project](https://github.com/The-Relational-Technology-Project):

- Technology built by the people it serves
- River, not gardener
- Relationships first
- Asset-based
- Speed of trust

## Open and Accessible

A neighborhood builder should be able to visit a URL and start building without signing up for anything or entering a credit card. The default experience runs on an RTP-hosted open-source model -- no API keys required. Users who want higher-quality output can bring their own API keys for Claude, OpenAI, or other providers.

## Tech Stack

- **Vite + React + TypeScript** -- fast, modern frontend
- **Tailwind + shadcn/ui** -- clean component library
- **Supabase** -- knowledge base backend (shared with RTS Studio)
- **Model-agnostic provider layer** -- supports self-hosted open-source models, Claude, OpenAI, and more

Provider abstraction inspired by [Dyad](https://github.com/dyad-sh/dyad) (Apache 2.0).

## Status

Early development. See the [Relational Technology Project](https://github.com/The-Relational-Technology-Project) for related work including [RTS Studio](https://github.com/The-Relational-Technology-Project/rtstudio).

## License

MIT
