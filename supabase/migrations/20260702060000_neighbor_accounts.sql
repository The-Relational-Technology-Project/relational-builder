-- Neighbor accounts for Community Cloud apps.
-- Built apps can now let neighbors sign in with an emailed code — no
-- passwords, no OAuth setup, nothing for the builder to configure. Members
-- own their posts (creator-only edits) and apps can mark documents
-- members-only. Everything still flows through the app-data edge function
-- with the service role; no client policies.

create table if not exists public.app_members (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  email text not null,
  name text,
  created_at timestamptz not null default now()
);

create unique index if not exists app_members_app_email_idx
  on public.app_members (app_id, lower(email));

create table if not exists public.app_login_codes (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  email text not null,
  name text,
  code text not null,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists app_login_codes_lookup_idx
  on public.app_login_codes (app_id, lower(email), created_at desc);

create table if not exists public.app_sessions (
  token text primary key,
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  member_id uuid not null references public.app_members (id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists app_sessions_member_idx on public.app_sessions (member_id);

-- Documents gain authorship + visibility
alter table public.app_documents
  add column if not exists member_id uuid references public.app_members (id) on delete set null,
  add column if not exists member_name text,
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'members'));

alter table public.app_members enable row level security;
alter table public.app_login_codes enable row level security;
alter table public.app_sessions enable row level security;
