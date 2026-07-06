# Global Commons Strategy — Confirmed Picture

*Written 2026-07-06, confirming the architecture as it stands (see the
system diagram in the RTP infra notes) and where it's headed.*

## What feeds the commons today

Three tributaries, one river:

1. **Watcher (via GitHub).** Builder repos carrying `.reltech.yml` (v2
   lineage) are discovered by the watcher cron, which writes manifest
   entries into the **global commons DB** and the network feed
   (feed.json + RSS → the Builder's Network panel and prompt context).
   This is the *code-and-lineage* tributary: anything published as a
   repo joins the commons automatically.

2. **RTP website Supabase (the broader commons).** The commons project
   (`commons_items`, ~363 items) holds the wider library — neighboring
   recipes, references, frameworks, methodologies — searched by the
   Builder's hybrid semantic + full-text `search-commons` function on
   every message. This is the *knowledge* tributary and the canonical
   retrieval source at build time.

3. **RT Studio DB.** Tools (27, with lineage + remix tiers), stories,
   prompts, studios, and build plans — read live by the Builder (shared
   Supabase project, read-only client) and synced daily into the global
   commons via `sync-studio-library`. This is the *curated gallery*
   tributary.

## Confirmations and direction

- **The strategy is sound: one commons, many doors.** Watcher for code,
  the commons DB for knowledge, Studio for curation. The Builder already
  treats `commons_items` as the primary retrieval source with the Studio
  KB as fallback — keep that ordering.
- **RT Studio absorption is underway.** As of today the Builder has its
  own Studio Gallery (full cards, screenshots, lineage, hosted links,
  recipes) reading the same tables RT Studio writes. Full transfer means:
  (a) keep the `tools`/`prompts`/`stories` tables as the system of record
  (or migrate them into the commons project later — the Builder's queries
  isolate this behind `knowledge/queries.ts`), (b) move the
  contribution → review → promote flow into the Builder's steward
  tooling (the new super admin dashboard is the natural home), and
  (c) retire RT Studio's front end once the gallery + review flow both
  live here.
- **New kinds are cheap to add.** `commons_items.kind` already spans
  tool/story/prompt/recipe/reference/framework/methodology. Civic
  practices and local news / civic media practices should land as new
  kinds (e.g. `civic-practice`, `media-practice`) in the same table —
  retrieval, embedding, and the Builder's context-weaving all work
  unchanged the moment the rows exist.
- **The one gap in the diagram** (marked missing): Lovable remixes and
  email-interest signals from "beyond the sensors" don't reach the
  Watcher. Lowest-effort fix: a tiny web form (or the account-request
  pattern) that writes a `commons_items` row + notifies the steward,
  rather than trying to instrument platforms we don't control.

## Practical next steps

1. Add the new kinds to the commons ingest + a couple of seed rows, and
   confirm `search-commons` returns them (no Builder changes needed).
2. Wire studio slugs into commons rows where relevant so studio frames
   can highlight *their* library subset in retrieval and the gallery.
3. When RT Studio's review queue moves here, reuse the super admin
   dashboard pattern (edge function + steward email) shipped today.
