-- Public builder profiles (September 2026; docs/BUILDER-PROFILES.md).
--
-- A builder's public page is an ordinary project (lineage.source =
-- 'builder-profile'), built with the Builder itself and published on
-- Community Hosting under kind 'profile'. The site's slug IS the handle:
-- relationalbuilder.org/b/{handle}/. Unpublishing deletes the row, which
-- releases the handle. Three things need the database:
--
--   1. community_sites accepts kind 'profile'
--   2. one profile project per builder (what the llm-proxy's budget
--      exemption is keyed on, so the exemption is bounded by construction)
--   3. a definer RPC that counts the commons items a builder drew on across
--      every project's chat, so the seed doesn't download every chat

alter table public.community_sites
  drop constraint if exists community_sites_kind_check;
alter table public.community_sites
  add constraint community_sites_kind_check check (kind in ('site', 'preview', 'profile'));

create unique index if not exists projects_one_profile_per_owner
  on public.projects (owner_id)
  where (lineage ->> 'source') = 'builder-profile';

-- Items from the commons and studio libraries this builder drew on, across
-- every project they own: kind + distinct count. Own-row RLS on projects
-- would allow the client to do this itself, but only by pulling every chat.
create or replace function public.my_commons_ref_counts()
returns table (source text, kind text, items bigint)
language sql
stable
security definer
set search_path = public
as $$
  select 'commons' as source, r ->> 'kind' as kind, count(distinct r ->> 'slug') as items
  from public.projects p,
       jsonb_array_elements(case when jsonb_typeof(p.chat) = 'array' then p.chat else '[]'::jsonb end) m,
       jsonb_array_elements(case when jsonb_typeof(m -> 'commonsRefs') = 'array' then m -> 'commonsRefs' else '[]'::jsonb end) r
  where p.owner_id = auth.uid()
    and coalesce((p.lineage ->> 'source'), '') <> 'builder-profile'
  group by r ->> 'kind'
  union all
  select 'studio', r ->> 'kind', count(distinct r ->> 'id')
  from public.projects p,
       jsonb_array_elements(case when jsonb_typeof(p.chat) = 'array' then p.chat else '[]'::jsonb end) m,
       jsonb_array_elements(case when jsonb_typeof(m -> 'studioRefs') = 'array' then m -> 'studioRefs' else '[]'::jsonb end) r
  where p.owner_id = auth.uid()
    and coalesce((p.lineage ->> 'source'), '') <> 'builder-profile'
  group by r ->> 'kind';
$$;

revoke all on function public.my_commons_ref_counts() from public;
grant execute on function public.my_commons_ref_counts() to authenticated;
