-- Which community plan a builder chose (src/cloud/community-plans.ts):
-- 'open-weight' or 'frontier'. Null until they choose, so the default can
-- change without rewriting anyone's row. Owner-only read/update is already
-- enforced by the profiles RLS.
alter table public.profiles
  add column if not exists community_plan text;

alter table public.profiles
  drop constraint if exists profiles_community_plan_check;
alter table public.profiles
  add constraint profiles_community_plan_check
  check (community_plan is null or community_plan in ('open-weight', 'frontier'));
