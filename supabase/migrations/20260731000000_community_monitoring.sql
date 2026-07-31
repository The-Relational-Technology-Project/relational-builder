-- Community plan monitoring & alerts (July 31 2026).
--
-- Three pieces:
--   1. Cache-aware metering — community_usage grows cache-token columns so
--      the daily spend *estimate* can price cache writes (1.25x) and cache
--      reads (0.1x) correctly instead of treating everything as full-price
--      input. The budget gate is unchanged (still input+output).
--   2. Monitoring state — monitor_alerts dedupes sent emails (one $5 alert
--      per day, cooldowns for infra alerts); monitor_infra_samples records
--      pressure-signal snapshots so a tier-bump recommendation requires
--      *sustained* pressure, not one hot sample.
--   3. Scheduling — pg_cron + pg_net invoke the community-monitor edge
--      function every 15 minutes with a shared secret held in Vault.
--
-- The literal '{{MONITOR_CRON_SECRET}}' below is a placeholder: at apply
-- time it is substituted with the generated secret that is also set as the
-- community-monitor function's MONITOR_CRON_SECRET env secret.
-- (Applied to texakzqqenzpxawktbgx via management API on 2026-07-31.)

-- ── 1. Cache-aware metering ─────────────────────────────────────────────

alter table public.community_usage
  add column if not exists cache_creation_tokens bigint not null default 0,
  add column if not exists cache_read_tokens bigint not null default 0;

-- New params require a new signature; drop the old 3-arg version so the
-- defaulted 5-arg version is the only one (old proxy deploys calling with
-- 3 args still resolve against the defaults).
drop function if exists public.increment_community_usage(text, bigint, bigint);

create or replace function public.increment_community_usage(
  p_email text,
  p_input bigint,
  p_output bigint,
  p_cache_write bigint default 0,
  p_cache_read bigint default 0
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.community_usage
    (email, day, requests, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
  values (lower(p_email), current_date, 1, p_input, p_output, p_cache_write, p_cache_read)
  on conflict (email, day) do update set
    requests = community_usage.requests + 1,
    input_tokens = community_usage.input_tokens + excluded.input_tokens,
    output_tokens = community_usage.output_tokens + excluded.output_tokens,
    cache_creation_tokens = community_usage.cache_creation_tokens + excluded.cache_creation_tokens,
    cache_read_tokens = community_usage.cache_read_tokens + excluded.cache_read_tokens;
$$;

revoke execute on function public.increment_community_usage from public, anon, authenticated;

-- ── 2. Monitoring state ─────────────────────────────────────────────────
-- Service-role only (RLS on, no policies) — same trust model as app_secrets.

create table if not exists public.monitor_alerts (
  alert_key text primary key,
  sent_at timestamptz not null default now(),
  detail jsonb
);

create table if not exists public.monitor_infra_samples (
  at timestamptz not null default now(),
  signals text[] not null,
  stats jsonb
);

create index if not exists monitor_infra_samples_at_idx
  on public.monitor_infra_samples (at desc);

alter table public.monitor_alerts enable row level security;
alter table public.monitor_infra_samples enable row level security;

-- Database-side health numbers the edge function can't see through PostgREST.
create or replace function public.monitor_db_stats()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'connections', (select count(*) from pg_stat_activity),
    'max_connections', (select setting::int from pg_settings where name = 'max_connections'),
    'cache_hit_ratio', (
      select round(sum(blks_hit)::numeric / greatest(sum(blks_hit) + sum(blks_read), 1), 4)
      from pg_stat_database
    )
  );
$$;

revoke execute on function public.monitor_db_stats from public, anon, authenticated;

-- ── 3. Scheduling ───────────────────────────────────────────────────────

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Shared secret the cron caller presents to the edge function; lives in
-- Vault so the cron job definition never contains the plaintext.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'monitor_cron_secret') then
    perform vault.create_secret('{{MONITOR_CRON_SECRET}}', 'monitor_cron_secret');
  end if;
end $$;

-- Every 15 minutes. cron.schedule upserts by job name, so re-applying this
-- migration replaces rather than duplicates the job.
select cron.schedule(
  'community-monitor',
  '*/15 * * * *',
  $CRON$
  select net.http_post(
    url := 'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/community-monitor',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-monitor-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'monitor_cron_secret')
    ),
    body := '{}'::jsonb
  )
  $CRON$
);
