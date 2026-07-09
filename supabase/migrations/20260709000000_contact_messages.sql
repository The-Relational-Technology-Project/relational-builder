-- A simple front-door contact form (linked from the landing footer): the
-- message lands here as the durable record, and the steward gets an email
-- copy. No account needed to write to us — that's the point.

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text,
  email text,
  neighborhood text,
  message text not null,
  created_at timestamptz not null default now()
);

-- Service-role only (the contact edge function); senders aren't signed in,
-- so there are no client policies at all.
alter table public.contact_messages enable row level security;
