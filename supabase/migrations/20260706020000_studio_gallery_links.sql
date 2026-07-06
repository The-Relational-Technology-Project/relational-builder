-- Studio-scoped gallery highlighting: which Studio Gallery tools belong to
-- which studios. The tools themselves live in the RT Studio KB project (a
-- separate Supabase account we can't migrate), so the link lives here in the
-- Builder backend, curated by the steward in the super admin dashboard.
--
-- When RT Studio later grows native studio tagging (tags like `studio:rt`
-- on tools rows), the gallery merges both sources — this table is the
-- steward-curated half, not a cache.

create table if not exists public.studio_gallery_links (
  studio_slug text not null,
  tool_id text not null,
  tool_name text,
  added_by text,
  created_at timestamptz not null default now(),
  primary key (studio_slug, tool_id)
);

alter table public.studio_gallery_links enable row level security;

-- Curation metadata is public by design: the gallery highlights studio tools
-- for everyone browsing, signed in or not. Writes go through the
-- admin-requests edge function (service role) only.
drop policy if exists "gallery links are public" on public.studio_gallery_links;
create policy "gallery links are public" on public.studio_gallery_links
  for select using (true);
