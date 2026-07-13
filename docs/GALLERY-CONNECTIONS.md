# Gallery Connections & Local Stories

Cross-references between gallery entries — a story that features a tool, a
recipe that pairs with a neighboring practice — plus stories as a first-class
gallery category.

## Why

Entries always referenced each other in free text (the Connection
Infrastructure recipe names People's Supper; field-guide stories name the
tools they grew from), but nothing linked them: the gallery couldn't show
"where else this shows up," and the AI literally couldn't see it — chat
context carries only title + kind + a ~200-char summary per retrieved item,
never the body where those references live.

## The pieces

**`gallery_references` table** (Builder backend,
`supabase/migrations/20260713000000_gallery_references.sql`). The entries
live across three Supabase projects — KB `tools`/`stories` (RT Studio),
`commons_items` (RT Commons), `studio_library_items` (Builder) — and only the
Builder backend is ours to migrate. So links are rows here, addressing
entries by `(source, id)`:

| source | id | entry |
|---|---|---|
| `kb_tool` | uuid | KB `tools` row |
| `kb_story` | uuid | KB `stories` row |
| `commons` | slug | `commons_items` row |
| `studio` | uuid | `studio_library_items` row |

Each row is one directed link (`from` references `to`) with denormalized
titles/kinds (no cross-DB joins at read time), a `relation`
(`mentions | used_in | paired_with | related`), an optional `note` ("worked
well for listening sessions"), and a `status` (`suggested | confirmed`).
Reads are public (RLS `select using (true)`, like `studio_gallery_links`);
writes go through the `admin-requests` edge function (`reference_add`,
`reference_set_status`, `reference_remove`) or the suggest script.

**Code map:**

- `src/knowledge/gallery-references.ts` — types + pure direction-aware
  helpers (`connectionsFor`, `connectionIndex`); one row reads from both
  ends ("mentions" ↔ "mentioned in").
- `src/cloud/gallery-references.ts` — fetch + session cache
  (`loadGalleryReferences`) + steward write wrappers.
- `src/knowledge/context-builder.ts` — `galleryReferences` option; the
  commons/tools/stories prompt formatters append a `Connections:` line
  (max 3 per item, note capped at 140 chars) so the AI can say "it worked
  really well in X" / "it pairs with Y."
- `src/components/GalleryConnections.tsx` — the Connections block in every
  detail dialog, with click-through to the other entry. For the steward the
  block is also the curation surface: remove a wrong link or add a missing
  one (with relation + note) right where the connection is seen in context.
- `src/components/StewardPage.tsx` → Connections tab — the bulk view: the
  full list with suggested links sorted first, confirm/remove, manual add.
- `scripts/suggest-gallery-references.mjs` — scans entry bodies (and the
  civic-media `metadata.building_from` lists) for other entries' titles and
  writes `suggested` rows. Idempotent; `--dry-run` prints without writing.

**Local Stories** — a new top-level gallery category aggregating every story
source: the commons field-guide stories (`commons_items` `kind='story'`, which
also stay on the Civic Media shelf), the KB `stories` table (previously
visible only in the Knowledge Base panel), and studio stories shared beyond
their walls. KB stories get their own card + reader dialog in
`CommonsGallery.tsx` (`KBStoryCard` / `KBStoryDetailDialog`).

## Operating it

Turned on 2026-07-13: migration applied, `admin-requests` v17 deployed, and
the first scan's 569 links seeded and bulk-confirmed (a 569-row review queue
wasn't a realistic ask — the scan is conservative, and corrections happen in
context instead).

Ongoing care:

- **Correct in context** — the steward sees remove (×) and "Add" controls in
  every entry's Connections block in the gallery. Spot a wrong link while
  browsing, remove it there; know a pairing, add it there with a note — the
  note is what turns a bare link into "it worked really well in this
  context" in chat.
- **Re-scan after new content lands**:
  `BUILDER_SUPABASE_URL=… BUILDER_SERVICE_ROLE_KEY=… node scripts/suggest-gallery-references.mjs`
  (`--dry-run` first to eyeball). New matches arrive as `suggested` — they
  show in the gallery and AI context immediately, marked "suggested", and
  queue at the top of **Steward → Connections** for confirm/remove.
