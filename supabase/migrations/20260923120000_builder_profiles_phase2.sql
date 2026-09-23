-- Public builder profiles, phase 2 (docs/BUILDER-PROFILES.md).
--
--   1. commons_contributions: what a builder has given back. submitToCommons
--      posts to the Commons project and, until now, the Builder database
--      kept nothing — so "contributed back: 2 tools, 1 story" had no source.
--      The client inserts a row after a successful submission; the seed
--      counts them by type. Own rows only.
--   2. my_project_technologies(): the technologies a builder's projects
--      actually use, read from the files themselves (bare imports in code,
--      Tailwind in CSS, Community Cloud and serverless markers), counted per
--      project. Server-side so the seed doesn't download every project.

create table if not exists public.commons_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  contribution_type text not null,
  title text not null,
  source_url text,
  studio_slug text,
  -- The id the Commons project handed back, when it did
  contribution_id text,
  submitted_at timestamptz not null default now()
);

create index if not exists commons_contributions_user_idx
  on public.commons_contributions (user_id, submitted_at desc);

alter table public.commons_contributions enable row level security;

create policy "contributions: read own" on public.commons_contributions
  for select using (user_id = auth.uid());
create policy "contributions: add own" on public.commons_contributions
  for insert with check (user_id = auth.uid());

create or replace function public.my_project_technologies()
returns table (spec text, projects bigint)
language sql
stable
security definer
set search_path = public
as $$
  with own as (
    select p.id, f ->> 'path' as path, coalesce(f ->> 'content', '') as content
    from public.projects p,
         jsonb_array_elements(case when jsonb_typeof(p.files) = 'array' then p.files else '[]'::jsonb end) f
    where p.owner_id = auth.uid()
      and coalesce(p.lineage ->> 'source', '') <> 'builder-profile'
  ),
  imports as (
    select o.id, m[1] as spec
    from own o,
         regexp_matches(o.content, '(?:from|import)\s*[''"]((?:@[a-z0-9-]+/)?[a-z][a-z0-9.-]*)(?:/[^''"]*)?[''"]', 'g') m
    where o.path ~* '\.(tsx?|jsx?|mjs)$'
  ),
  markers as (
    select id, 'tailwindcss' as spec from own where path ~* '\.css$' and content like '%tailwindcss%'
    union all
    select id, 'community-cloud' from own where content like '%/app-data%' or content like '%app-capabilities%'
    union all
    select id, 'serverless' from own where path ~* '^/?api/.*\.[jt]s$'
  )
  select u.spec, count(distinct u.id)
  from (select * from imports union all select * from markers) u
  group by u.spec;
$$;

revoke all on function public.my_project_technologies() from public;
grant execute on function public.my_project_technologies() to authenticated;
