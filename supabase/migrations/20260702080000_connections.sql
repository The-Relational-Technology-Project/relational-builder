-- Making the Builder relational: builders can opt into being findable and
-- reachable by other builders in the pilot. Everything is opt-in and
-- transparent — nothing is shown unless a builder turns it on, and email
-- addresses are only ever revealed through double-opt-in intros.

alter table public.profiles
  add column if not exists open_to_connecting boolean not null default false,
  add column if not exists connect_note text,
  add column if not exists cal_link text,
  add column if not exists allow_requests boolean not null default false;

-- Double-opt-in connection requests: A asks, B gets an email with
-- accept/decline links, acceptance sends both parties an intro email.
create table if not exists public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  from_email text not null,
  from_name text,
  to_email text not null,
  message text,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  token text not null unique,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

create index if not exists connection_requests_from_idx
  on public.connection_requests (lower(from_email), created_at desc);

-- Service-role only (the connect edge function); no client policies.
alter table public.connection_requests enable row level security;
