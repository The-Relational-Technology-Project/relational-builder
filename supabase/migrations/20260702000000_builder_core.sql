-- Relational Builder — core schema for accounts, cloud projects, and collaboration
-- Runs against the dedicated Builder Supabase project (NOT the RTS Studio KB project).
--
-- Apply: paste into the Supabase SQL editor, or `supabase db push` with the CLI.

-- ── Profiles ─────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Users see and edit only their own profile. Collaborator identity is
-- surfaced via project_members.email, so no cross-user profile reads needed.
create policy "profiles: read own" on public.profiles
  for select using (id = auth.uid());
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid());

-- ── Projects ─────────────────────────────────────────────────────────

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  name text not null default 'Untitled project',
  -- Serialized workspace: VirtualFS entries, chat messages, mode, lineage
  files jsonb not null default '[]'::jsonb,
  chat jsonb not null default '[]'::jsonb,
  mode text not null default 'build' check (mode in ('plan', 'build')),
  lineage jsonb,
  updated_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── Members (invite by email) ────────────────────────────────────────

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  role text not null default 'editor' check (role in ('editor')),
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (project_id, email)
);

create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_email_idx on public.project_members (lower(email));

-- ── Membership check (security definer avoids RLS recursion) ─────────

create or replace function public.is_project_member(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.project_members m
    where m.project_id = p_id
      and (
        m.user_id = auth.uid()
        or lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  );
$$;

-- ── RLS: projects ────────────────────────────────────────────────────

alter table public.projects enable row level security;

create policy "projects: owner or member can read" on public.projects
  for select using (owner_id = auth.uid() or public.is_project_member(id));

create policy "projects: owner can insert" on public.projects
  for insert with check (owner_id = auth.uid());

create policy "projects: owner or member can update" on public.projects
  for update using (owner_id = auth.uid() or public.is_project_member(id));

create policy "projects: owner can delete" on public.projects
  for delete using (owner_id = auth.uid());

-- ── RLS: project_members ─────────────────────────────────────────────

alter table public.project_members enable row level security;

-- Owner and fellow members can see the member list; invitees see their own row.
create policy "members: visible to project circle" on public.project_members
  for select using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
    or public.is_project_member(project_id)
  );

create policy "members: owner can invite" on public.project_members
  for insert with check (
    exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

create policy "members: owner removes, member leaves" on public.project_members
  for delete using (
    user_id = auth.uid()
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or exists (
      select 1 from public.projects p
      where p.id = project_id and p.owner_id = auth.uid()
    )
  );

-- Invitee can claim their row (link user_id after signing in)
create policy "members: invitee claims row" on public.project_members
  for update
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (user_id = auth.uid());

-- ── Triggers ─────────────────────────────────────────────────────────

-- New auth user → profile row + link any pending invites for that email
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;

  update public.project_members
  set user_id = new.id
  where user_id is null and lower(email) = lower(new.email);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- New invite → link user_id immediately if that email already has an account
create or replace function public.link_member_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is null then
    select id into new.user_id
    from public.profiles
    where lower(email) = lower(new.email)
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists on_member_invited on public.project_members;
create trigger on_member_invited
  before insert on public.project_members
  for each row execute function public.link_member_user();

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_project_updated on public.projects;
create trigger on_project_updated
  before update on public.projects
  for each row execute function public.touch_updated_at();

-- ── Realtime ─────────────────────────────────────────────────────────
-- Collaborators receive project updates live (RLS is enforced on the stream).

alter publication supabase_realtime add table public.projects;
