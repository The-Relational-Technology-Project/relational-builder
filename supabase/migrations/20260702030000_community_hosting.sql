-- Community Hosting: RTP-hosted deployment for built apps.
-- Each builder gets a few free sites (like Lovable Cloud, paid by RTP for
-- the pilot, moving toward shared community infrastructure). Sites are
-- static files served by the `site` edge function, which also counts
-- visits — giving builders simple analytics for free.

create table if not exists public.community_sites (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  owner_email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists community_sites_owner_idx on public.community_sites (lower(owner_email));

create table if not exists public.site_files (
  site_id uuid not null references public.community_sites (id) on delete cascade,
  path text not null,
  content text not null,
  content_type text not null default 'text/plain',
  updated_at timestamptz not null default now(),
  primary key (site_id, path)
);

create table if not exists public.site_stats (
  site_id uuid not null references public.community_sites (id) on delete cascade,
  day date not null default current_date,
  views bigint not null default 0,
  primary key (site_id, day)
);

-- RLS on, no client policies: all access via edge functions (service role)
alter table public.community_sites enable row level security;
alter table public.site_files enable row level security;
alter table public.site_stats enable row level security;

create or replace function public.increment_site_views(p_site_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.site_stats (site_id, day, views)
  values (p_site_id, current_date, 1)
  on conflict (site_id, day) do update set views = site_stats.views + 1;
$$;

revoke execute on function public.increment_site_views from public, anon, authenticated;
