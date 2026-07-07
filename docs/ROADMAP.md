# Relational Builder — Roadmap

*How two June 2026 RTP briefs reshape the Builder's build plan. Written July 2, 2026.*

Two internal docs sit behind this roadmap (see `internal reference docs/`):

1. **"We can build what we need"** — the case for the *local relational
   technologist* (LRT): a paid neighborhood role, one builder per ~100
   neighbors, sustained by a resourcing loop (neighborhood ≈50% + local
   government ≈25% + nation ≈25%, primed by philanthropy).
2. **"From one Studio to many"** — the multi-tenant RT Studio design brief:
   each Studio is a config record + local commons on one shared codebase;
   builder-sovereign identity; three commons tiers (global / studio-local /
   builder-personal).

Neither doc asks for copy changes here. Both change what the Builder *is for*:

> The Builder is the production tool of a new occupation. Its job is not just
> "generate an app" — it is to help a technologist **build with neighbors,
> keep tools alive, and show the value** that closes the resourcing loop.

## What that means, feature by feature

### 1. Evidence of value (the resourcing loop needs receipts)

The loop closes only if a technologist can show their neighborhood and city
what the work is worth: needs met close to home, tools still alive a year on,
real use. Today we count site views but show them only once, at publish time.

- **My Sites dashboard** — every community-hosted site a builder runs, with
  view counts, last-published date, links, and delete. The "is it alive?"
  surface. *(shipping now)*
- **Neighbor feedback loop** — a lightweight, no-login way for neighbors to
  leave a note on a hosted site, flowing back to the builder's dashboard.
  Co-creation at the 1:100 ratio needs a return channel that isn't
  "install analytics." *(shipping now)*
- Later: a shareable "tool health" snapshot (uses, feedback, uptime, lineage)
  a technologist can put in front of a library, school, or funder.

### 2. Studio-aware building (the medium-term bridge)

Studio and Builder stay separate sites and experiences. The bridge is the
same seam the multi-tenant Studio defines: **a Studio = base principles
(locked) + appended principles + a local commons**. The Builder should be
able to *build inside that frame* without becoming the Studio:

- **Studio context** — arrive via link (`?studio=thread`) or pick a Studio;
  the Builder fetches that Studio's config, layers its appended principles on
  top of the base RTP principles in the AI's context, and records the Studio
  in `.reltech.yml` lineage. *(shipping now, tolerant of the multi-tenant
  schema not being applied yet — falls back gracefully)*
- When the multi-tenant schema lands: scope commons retrieval to
  global + that Studio's local commons (never another Studio's), matching the
  Sidekick scope rule in the design brief.
- Later, if/when identities merge: the Builder's cloud projects surface in
  the Studio's builder-home "Made" tab. Until then `.reltech.yml` lineage +
  share links are the interchange format. **We keep builder-sovereignty on
  our side too: projects export cleanly, no lock-in.**

### 3. The practice cycle in the product (not as copy)

The spiral — observe, invite, relate, build, share — is already half-present
(Plan mode ≈ dream/relate; Publish + commons submit ≈ share). Gaps worth
building, later:

- **Invite/share-with-neighbors moments** built into the flow (share preview
  → collect reactions → fold back into the plan), so the 90/10 balance tilts
  toward the relationship work.
- **"Built with" credits** — neighbors who co-created, named in the manifest
  and on the hosted site. Provenance is for people, not just code.

### 4. What we deliberately do NOT build

- **Payments/invoicing for builds** (the "$1k per meaningful build" stream) —
  premature; keep it out of the tool until the cohort experiment tests it.
- **Merging Builder + Studio** into one app — the briefs keep them distinct
  (Studio = commons + Sidekick + plans; Builder = production tool). The seam
  is config + lineage, not a shared codebase.
- **A Studios marketplace inside the Builder** — mirror of the design brief's
  "avoid" list.

## Sequence

| Phase | Work | Status |
|---|---|---|
| Now | My Sites dashboard + neighbor feedback + studio-aware seam | shipped July 2 |
| Next | Bounded auto-fix (one automatic error→fix pass after builds); publish-time security scan (secret/PII patterns + AI access-rules review); asset uploads for Community Hosting (real local photos in built apps — today images ride as external URLs or data-URIs) | queued |
| Next | Tool-health snapshot; built-with credits; studio-scoped retrieval once multi-tenant schema is applied | after multi-tenant Studio ships |
| Later | MCP client support — let builders bring the tools their community already uses (Sheets, Airtable, calendars) into builds, with Dyad's consent-taxonomy pattern for approving what the AI may touch; RTP's own commons MCP server is the natural first connection | design when pilot demand appears |
| Later | Identity bridge (Builder projects in Studio personal library); export/graduation UI parity | when Studios are live at relationaltechstudio.org |

Standing priorities unchanged: keep the free tier real (community access,
Community Cloud + Hosting), keep quality closing on Lovable/Dyad, and keep
everything exportable — no enclosure, including by us.

## Added July 3 (overnight session)

- **Per-project environment variables** — env vars (service keys, Community
  Cloud attachment) are still global localStorage. Tonight's fix: New Project
  clears them, so backends and keys stop silently following you into fresh
  projects. The real design is env scoped to the project record — needs a
  decision on whether secrets sync to cloud projects (they currently never
  leave the browser except at deploy time) and what invited editors see.

- **Agents position (asked July 2, answered July 3)** — Lovable and Claude
  Code lean on multi-agent orchestration; we deliberately don't. At pilot
  scale the wins come from two bounded passes, both shipped: auto-fix (one
  error→fix pass when a build throws) and the quality review (one background
  Haiku read of every normal build against the person's request; confident
  defects queue exactly one fix send through the same no-loop machinery;
  silence when solid). Full orchestration — parallel specialists, verify
  loops with browser automation — costs multiples per build in tokens and
  latency and needs server-side infrastructure; revisit only if quality
  gaps persist that these two passes can't close.

- **Prompts as first-class (started July 3)** — prompts table + distiller +
  share links + dashboard shipped; the prompt now travels in .reltech.yml.
  Next moves when ready: shared prompts on builder directory cards (the
  "prompts travel with profiles" half), a commons prompt library (Studio
  sync like tools/build plans — the real "GitHub for prompts"), prompt
  versions (a prompt evolves as the app does; keep the trail), and
  screenshots alongside prompts in the gallery (needs a preview-capture
  path; Sandpack iframes are cross-origin).

- **Show consequences, not fine print (July 4 audit)** — the tiny-text audit
  (docs/TINY-TEXT-AUDIT.md) found ~10 places where a muted explainer papers
  over UI that should speak for itself. The pattern for fixes: inline state
  feedback where the choice is made — "1 of 3 free sites" badges on Publish,
  per-variable public/secret consequences in Env, a live "Saved · synced"
  indicator on cloud projects, one-click "Ask AI to fix it" per security
  finding. Two copy-level wins shipped July 4; the structural ones are queued
  here.

- **Smart model throttling (July 4; shipped July 7)** — Opus 4.8 is the
  default for free community builds with a 5M/day budget, on the belief that
  early adopters deserve the best experience. The step-down logic shipped
  July 7: on the community key, Opus 4.8 handles planning + the first build
  of a project, then edits default to Sonnet 5 — announced with a Builder
  note in the chat, never switched silently. A model picked in the picker is
  pinned for that project (fresh projects get fresh defaults). Still open if
  cost pressure grows: step down only after a builder's Nth build of the day
  (the proxy already knows per-member usage).
