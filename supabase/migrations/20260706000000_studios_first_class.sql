-- Studios become first-class: builders BELONG to studios (not just build
-- inside their frame), and each studio has a lightweight activity stream —
-- joins, shared prompts, published builds — that members see on their home.
--
-- Studio configs themselves stay in the KB project's `studios` table; what
-- lives here is the relationship between builders and studios, which is
-- Builder-account data.

create table if not exists public.studio_memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  studio_slug text not null,
  studio_label text not null,
  display_name text,
  joined_at timestamptz not null default now(),
  primary key (user_id, studio_slug)
);

create index if not exists studio_memberships_slug_idx
  on public.studio_memberships (studio_slug, joined_at desc);

alter table public.studio_memberships enable row level security;

-- Studios are communities, not private lists: any signed-in builder can see
-- who's in a studio (display names only — emails never leave auth).
drop policy if exists "memberships visible to builders" on public.studio_memberships;
create policy "memberships visible to builders" on public.studio_memberships
  for select using (auth.uid() is not null);

drop policy if exists "join studios" on public.studio_memberships;
create policy "join studios" on public.studio_memberships
  for insert with check (auth.uid() = user_id);

drop policy if exists "leave studios" on public.studio_memberships;
create policy "leave studios" on public.studio_memberships
  for delete using (auth.uid() = user_id);

-- The studio's pulse: small, append-only events members see on their home.
create table if not exists public.studio_activity (
  id uuid primary key default gen_random_uuid(),
  studio_slug text not null,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_name text,
  kind text not null check (kind in ('join', 'share', 'publish')),
  title text,
  url text,
  created_at timestamptz not null default now()
);

create index if not exists studio_activity_slug_idx
  on public.studio_activity (studio_slug, created_at desc);

alter table public.studio_activity enable row level security;

drop policy if exists "activity visible to builders" on public.studio_activity;
create policy "activity visible to builders" on public.studio_activity
  for select using (auth.uid() is not null);

-- Builders write their own activity; nothing is editable or deletable from
-- the client (append-only keeps the stream honest; moderation via dashboard).
drop policy if exists "record own activity" on public.studio_activity;
create policy "record own activity" on public.studio_activity
  for insert with check (auth.uid() = actor_id);
