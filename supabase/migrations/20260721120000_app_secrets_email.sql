-- App capability secrets + email: the first managed capability for built apps.
--
-- Builders paste their own service keys (Resend first) once in the Services
-- tab; the key is vaulted here and only ever used server-side by the
-- app-capabilities edge function. The generated app calls the function with
-- its public app_id/app_key — the secret never reaches a browser, a preview,
-- or the app's shipped code.
--
-- Same trust model as the rest of Community Cloud: RLS on, no policies —
-- only the service role (edge functions) touches these tables. Secrets are
-- write-only from the builder's side: set, replace, delete — never read back.

create table if not exists public.app_secrets (
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  service text not null,
  secret text not null,
  -- Non-secret settings the builder may edit: from_name, from_email,
  -- members_only_send (require a signed-in neighbor to send)
  config jsonb not null default '{}'::jsonb,
  daily_cap int not null default 200,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (app_id, service)
);

-- One row per app+service+day; the RPC below bumps and returns the count so
-- the edge function checks the daily cap and records the send in one call.
create table if not exists public.app_capability_usage (
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  service text not null,
  day date not null,
  count int not null default 0,
  primary key (app_id, service, day)
);

-- Builder-visible send history (Cloud tab); one row per recipient.
create table if not exists public.app_email_log (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  recipient text not null,
  subject text,
  status text not null,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists app_email_log_lookup_idx
  on public.app_email_log (app_id, created_at desc);

alter table public.app_secrets enable row level security;
alter table public.app_capability_usage enable row level security;
alter table public.app_email_log enable row level security;

drop trigger if exists on_app_secret_updated on public.app_secrets;
create trigger on_app_secret_updated
  before update on public.app_secrets
  for each row execute function public.touch_app_document();

create or replace function public.increment_capability_usage(
  p_app_id uuid,
  p_service text
)
returns int
language sql
security definer
set search_path = public
as $$
  insert into public.app_capability_usage (app_id, service, day, count)
  values (p_app_id, p_service, current_date, 1)
  on conflict (app_id, service, day) do update set
    count = app_capability_usage.count + 1
  returning count;
$$;

revoke execute on function public.increment_capability_usage from public, anon, authenticated;
