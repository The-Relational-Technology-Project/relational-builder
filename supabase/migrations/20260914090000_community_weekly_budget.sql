-- Community plan, September 2026: weekly token budgets and a shared
-- storage pool for Community Cloud.
--
-- Tokens: the daily budget (5M/day, resetting at midnight UTC) becomes a
-- weekly one — 20M per calendar week starting Monday 00:00 UTC. Same
-- expected spend, but a workshop day or a long weekend build no longer
-- hits a wall, and the reset moment is one people can actually plan
-- around. Every existing row scales ×4 so per-member overrides keep
-- their ratio to the default (a doubled member stays doubled: 40M).
--
-- Storage: Community Cloud's 100MB-per-app cap becomes 200MB shared
-- across every backend a builder owns (the app-data function enforces it
-- via cloud_builder_bytes). Apps per builder and sites per builder both
-- go 3 → 10 in the edge functions.

alter table public.community_members
  rename column daily_token_budget to weekly_token_budget;

alter table public.community_members
  alter column weekly_token_budget set default 20000000;

update public.community_members
set weekly_token_budget = weekly_token_budget * 4;

comment on column public.community_members.weekly_token_budget is
  'All token traffic (input, output, cache writes, cache reads) allowed per UTC calendar week (Monday start). Default 20M; per-member overrides welcome.';

-- Bytes stored across every backend with the same owner as the given app.
create or replace function public.cloud_builder_bytes(p_app_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(pg_column_size(d.data))::bigint, 0)
  from app_documents d
  join cloud_apps a on a.id = d.app_id
  where lower(a.owner_email) = (
    select lower(owner_email) from cloud_apps where id = p_app_id
  );
$$;

revoke execute on function public.cloud_builder_bytes(uuid) from public;
revoke execute on function public.cloud_builder_bytes(uuid) from anon;
revoke execute on function public.cloud_builder_bytes(uuid) from authenticated;
