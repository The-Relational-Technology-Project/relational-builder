-- Public builder profiles, phase 3 (docs/BUILDER-PROFILES.md): findable.
--
-- community_sites has no public read policy (the site function reads with
-- the service role), so the sitemap needs a definer RPC that lists only
-- what is already public by the builder's own choice: the address and
-- last-updated date of every published builder page. Nothing else.

create or replace function public.public_builder_pages()
returns table (slug text, updated_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select slug, updated_at
  from public.community_sites
  where kind = 'profile'
  order by updated_at desc;
$$;

revoke all on function public.public_builder_pages() from public;
grant execute on function public.public_builder_pages() to anon, authenticated;
