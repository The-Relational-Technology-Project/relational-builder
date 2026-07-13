-- Gallery connections: cross-references between commons entries — a story
-- that features a tool, a recipe that pairs with a neighboring practice, a
-- worksheet built from a field example. The entries themselves live across
-- three backends (the RT Studio KB's tools/stories, the RT Commons'
-- commons_items, and this backend's studio_library_items), two of which we
-- can't migrate — so the links live here, addressed by (source, id) pairs
-- with titles denormalized for display and AI context without cross-DB joins.
--
-- Bidirectional by construction: one row serves both entries; readers query
-- both directions. Links arrive two ways — the suggest script scans entry
-- bodies for other entries' names (status 'suggested'), and the steward
-- confirms, edits, or adds by hand.

create table if not exists public.gallery_references (
  id uuid primary key default gen_random_uuid(),
  -- The entry making the reference (a story that names a tool, etc.)
  from_source text not null check (from_source in ('kb_tool', 'kb_story', 'commons', 'studio')),
  from_id text not null,      -- uuid (kb_tool/kb_story/studio) or slug (commons)
  from_title text not null,   -- denormalized: display + prompt without cross-DB reads
  from_kind text,             -- 'tool' | 'story' | 'recipe' | 'worksheet' | ...
  -- The entry being referenced
  to_source text not null check (to_source in ('kb_tool', 'kb_story', 'commons', 'studio')),
  to_id text not null,
  to_title text not null,
  to_kind text,
  -- How they relate: from mentions/used_in/paired_with/related to
  relation text not null default 'mentions'
    check (relation in ('mentions', 'used_in', 'paired_with', 'related')),
  -- Why the pairing mattered ("worked well for listening sessions")
  note text,
  -- suggested = auto-detected by the scan, awaiting a steward's eye
  status text not null default 'confirmed' check (status in ('suggested', 'confirmed')),
  created_by text,
  created_at timestamptz not null default now(),
  unique (from_source, from_id, to_source, to_id)
);

create index if not exists gallery_references_from_idx
  on public.gallery_references (from_source, from_id);
create index if not exists gallery_references_to_idx
  on public.gallery_references (to_source, to_id);

alter table public.gallery_references enable row level security;

-- Connections are public by design, like studio_gallery_links: the gallery
-- shows them to everyone browsing and the AI context reads them without
-- auth. Writes go through the admin-requests edge function (service role)
-- and the suggest script only.
drop policy if exists "gallery references are public" on public.gallery_references;
create policy "gallery references are public" on public.gallery_references
  for select using (true);
