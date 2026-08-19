-- Per-model usage metering (Aug 19 2026).
--
-- The community-monitor spend estimate priced everything at Opus-class rates
-- because community_usage carries no model column — fine while Opus was the
-- only real pick, but a 2x understatement whenever a builder picks Fable 5
-- ($10/$50 per MTok vs Opus's $5/$25). The llm-proxy now records a
-- per-(email, day, model) breakdown alongside the aggregate, so projections
-- and alerts price Fable sessions at Fable rates. The aggregate table and
-- the budget gate (input+output vs daily_token_budget) are unchanged.
-- (Applied to texakzqqenzpxawktbgx via management API on 2026-08-19.)

create table if not exists public.community_usage_models (
  email text not null,
  day date not null default current_date,
  model text not null,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  cache_creation_tokens bigint not null default 0,
  cache_read_tokens bigint not null default 0,
  primary key (email, day, model)
);

alter table public.community_usage_models enable row level security;

-- Same visibility as community_usage: members can see their own rows. All
-- writes happen via the service role from the llm-proxy.
create policy "community: see own model usage" on public.community_usage_models
  for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- New param requires a new signature; drop the 5-arg version so the
-- defaulted 6-arg version is the only one (older proxy deploys still calling
-- with 5 args resolve against the default and simply skip the breakdown).
drop function if exists public.increment_community_usage(text, bigint, bigint, bigint, bigint);

create or replace function public.increment_community_usage(
  p_email text,
  p_input bigint,
  p_output bigint,
  p_cache_write bigint default 0,
  p_cache_read bigint default 0,
  p_model text default null
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

  insert into public.community_usage_models
    (email, day, model, requests, input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens)
  select lower(p_email), current_date, p_model, 1, p_input, p_output, p_cache_write, p_cache_read
  where p_model is not null and p_model <> ''
  on conflict (email, day, model) do update set
    requests = community_usage_models.requests + 1,
    input_tokens = community_usage_models.input_tokens + excluded.input_tokens,
    output_tokens = community_usage_models.output_tokens + excluded.output_tokens,
    cache_creation_tokens = community_usage_models.cache_creation_tokens + excluded.cache_creation_tokens,
    cache_read_tokens = community_usage_models.cache_read_tokens + excluded.cache_read_tokens;
$$;

revoke execute on function public.increment_community_usage from public, anon, authenticated;
