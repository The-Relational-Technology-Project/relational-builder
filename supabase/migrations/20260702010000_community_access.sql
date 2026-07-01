-- Community access (Tier 3): RTP-subsidized Claude for invited builders.
-- The shared Anthropic key lives ONLY as an edge-function secret
-- (ANTHROPIC_COMMUNITY_KEY); these tables gate who may use it and how much.

create table if not exists public.community_members (
  email text primary key,
  note text,
  -- Combined input+output tokens per day. 750k ≈ a generous evening of
  -- building on Claude Sonnet 5 for roughly $3-6 at intro pricing.
  daily_token_budget bigint not null default 750000,
  created_at timestamptz not null default now()
);

create table if not exists public.community_usage (
  email text not null,
  day date not null default current_date,
  requests integer not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (email, day)
);

alter table public.community_members enable row level security;
alter table public.community_usage enable row level security;

-- Members can see their own membership + usage (for the "community access
-- active" badge and budget meter). All writes happen via the service role
-- from the llm-proxy — no client write policies at all.
create policy "community: see own membership" on public.community_members
  for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create policy "community: see own usage" on public.community_usage
  for select using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Atomic usage increment, called by the proxy with the service role.
create or replace function public.increment_community_usage(
  p_email text,
  p_input bigint,
  p_output bigint
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.community_usage (email, day, requests, input_tokens, output_tokens)
  values (lower(p_email), current_date, 1, p_input, p_output)
  on conflict (email, day) do update set
    requests = community_usage.requests + 1,
    input_tokens = community_usage.input_tokens + excluded.input_tokens,
    output_tokens = community_usage.output_tokens + excluded.output_tokens;
$$;

-- Lock the function down to the service role
revoke execute on function public.increment_community_usage from public, anon, authenticated;

-- Invite builders by inserting rows, e.g.:
--   insert into public.community_members (email, note) values
--     ('builder@example.org', 'Sunset pilot cohort, July 2026');
