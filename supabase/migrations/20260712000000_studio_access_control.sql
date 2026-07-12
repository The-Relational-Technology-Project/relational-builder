-- Studios grow doors and shelves: a studio can be GATED (membership needs a
-- Studio Admin's approval) and can keep a PRIVATE LIBRARY (principles,
-- examples, prompts) that only approved members see — in the gallery and in
-- the AI's context while they build. Items stay studio-private until a
-- Studio Admin explicitly shares them with the broader commons.
--
-- Built for the Thread.org Relational Tech Service Year fellows (Baltimore):
-- their principles and examples live behind the Thread Studio door until
-- they're ready to offer some of them to every builder.
--
-- Studio identity (label, color) stays in the KB project's `studios` table;
-- access + membership + the private library are Builder-account data, here.

-- ── Studio settings: which studios are gated ─────────────────────────

create table if not exists public.studio_settings (
  studio_slug text primary key,
  access text not null default 'open' check (access in ('open', 'gated')),
  updated_at timestamptz not null default now(),
  updated_by text
);

alter table public.studio_settings enable row level security;

-- Whether a studio is gated is public knowledge (the join button needs it
-- before membership exists); changing it is steward work (service role only).
drop policy if exists "studio settings are public" on public.studio_settings;
create policy "studio settings are public" on public.studio_settings
  for select using (true);

-- Thread Studio opens gated: its library is for approved fellows first.
insert into public.studio_settings (studio_slug, access)
  values ('thread', 'gated')
  on conflict (studio_slug) do nothing;

-- ── Memberships gain a role and an approval state ─────────────────────

alter table public.studio_memberships
  add column if not exists role text not null default 'member'
    check (role in ('member', 'admin')),
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved'));

-- ── Access checks (security definer avoids RLS recursion) ─────────────

create or replace function public.is_gated_studio(slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.studio_settings s
    where s.studio_slug = slug and s.access = 'gated'
  );
$$;

create or replace function public.is_approved_studio_member(slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.studio_memberships m
    where m.studio_slug = slug
      and m.user_id = auth.uid()
      and m.status = 'approved'
  );
$$;

create or replace function public.is_studio_admin(slug text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.studio_memberships m
    where m.studio_slug = slug
      and m.user_id = auth.uid()
      and m.status = 'approved'
      and m.role = 'admin'
  );
$$;

-- ── Membership RLS, now approval-aware ─────────────────────────────────

-- Approved membership stays community-visible (display names only). Pending
-- requests are between the requester and the studio's admins.
drop policy if exists "memberships visible to builders" on public.studio_memberships;
create policy "memberships visible to builders" on public.studio_memberships
  for select using (
    auth.uid() is not null
    and (
      status = 'approved'
      or user_id = auth.uid()
      or public.is_studio_admin(studio_slug)
    )
  );

-- Joining an open studio is immediate; joining a gated studio files a
-- request. Either way you arrive as a plain member — admin is granted by
-- the steward (service role), never self-assigned.
drop policy if exists "join studios" on public.studio_memberships;
create policy "join studios" on public.studio_memberships
  for insert with check (
    auth.uid() = user_id
    and role = 'member'
    and status = (case when public.is_gated_studio(studio_slug)
                  then 'pending' else 'approved' end)
  );

-- Studio admins decide requests (pending → approved). The with-check pins
-- the updated row to role = 'member', so approval can never double as a
-- promotion — admin still only arrives via the steward.
drop policy if exists "admins decide membership" on public.studio_memberships;
create policy "admins decide membership" on public.studio_memberships
  for update
  using (public.is_studio_admin(studio_slug))
  with check (public.is_studio_admin(studio_slug) and role = 'member');

-- Leaving (or withdrawing a request) is yours; removing a member is the
-- studio admin's.
drop policy if exists "leave studios" on public.studio_memberships;
create policy "leave studios" on public.studio_memberships
  for delete using (
    auth.uid() = user_id or public.is_studio_admin(studio_slug)
  );

-- ── The studio's private library ───────────────────────────────────────

create table if not exists public.studio_library_items (
  id uuid primary key default gen_random_uuid(),
  studio_slug text not null,
  kind text not null check (kind in ('principle', 'example', 'story', 'prompt', 'tool', 'recipe')),
  title text not null,
  summary text,
  body text,
  url text,
  attribution text,
  tags text[] not null default '{}',
  -- 'studio' = members only; 'shared' = offered to every signed-in builder.
  -- Sharing is one-way and explicit — a Studio Admin's deliberate act.
  visibility text not null default 'studio' check (visibility in ('studio', 'shared')),
  -- Set when the item was also submitted to the RT Commons review queue
  commons_submitted_at timestamptz,
  sort_order int not null default 100,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists studio_library_items_slug_idx
  on public.studio_library_items (studio_slug, kind, sort_order, created_at);

alter table public.studio_library_items enable row level security;

-- Approved members read their studio's shelf; everyone signed in reads what
-- a studio has explicitly shared. Nothing here is visible signed out.
drop policy if exists "studio items readable" on public.studio_library_items;
create policy "studio items readable" on public.studio_library_items
  for select using (
    public.is_approved_studio_member(studio_slug)
    or (auth.uid() is not null and visibility = 'shared')
  );

drop policy if exists "admins add items" on public.studio_library_items;
create policy "admins add items" on public.studio_library_items
  for insert with check (public.is_studio_admin(studio_slug));

drop policy if exists "admins edit items" on public.studio_library_items;
create policy "admins edit items" on public.studio_library_items
  for update
  using (public.is_studio_admin(studio_slug))
  with check (public.is_studio_admin(studio_slug));

drop policy if exists "admins remove items" on public.studio_library_items;
create policy "admins remove items" on public.studio_library_items
  for delete using (public.is_studio_admin(studio_slug));

create or replace function public.touch_studio_library_item()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists studio_library_items_touch on public.studio_library_items;
create trigger studio_library_items_touch
  before update on public.studio_library_items
  for each row execute function public.touch_studio_library_item();
