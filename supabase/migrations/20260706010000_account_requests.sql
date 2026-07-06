-- Anyone can ask to join: the passcode → sign-in → magic-link dance confused
-- testers, so the front door becomes "request an account". Requests land
-- here, the steward gets an email, and approval (via the super admin
-- dashboard) creates community membership — after which sign-in is just the
-- magic link.

create table if not exists public.account_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  name text,
  neighborhood text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by text
);

-- One live request per address
create unique index if not exists account_requests_email_idx
  on public.account_requests (lower(email));

-- Service-role only (the request-account and admin-requests edge functions);
-- requesters aren't signed in yet, so there are no client policies at all.
alter table public.account_requests enable row level security;
