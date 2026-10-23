-- What a builder's place already has, in their own words: the people,
-- groups, gatherings, and physical spaces that hold it together. Sits beside
-- local_tech_ecosystem (the digital layer) as context for every build chat.
-- Replaces "dreams" as the profile's forward-looking question: what to build
-- is asked fresh on the start screen each time, never carried over.

alter table public.profiles
  add column if not exists neighborhood_assets text;

-- The sign-up form asks where you're from (not what you want to build); the
-- answer carries into the profile at first sign-in so onboarding opens with
-- it already filled in, instead of asking a second time. Only fills a blank.
create or replace function public.carry_request_neighborhood()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  place text;
begin
  if coalesce(trim(new.neighborhood), '') = '' then
    select neighborhood into place
    from public.account_requests
    where lower(email) = lower(coalesce(new.email, ''))
      and coalesce(trim(neighborhood), '') <> ''
    order by created_at desc
    limit 1;
    if place is not null then
      new.neighborhood := place;
    end if;
  end if;
  return new;
end;
$$;

-- handle_new_user upserts profiles (insert … on conflict do update), so a
-- BEFORE INSERT trigger fires exactly once, at first sign-in.
drop trigger if exists profiles_carry_request_neighborhood on public.profiles;
create trigger profiles_carry_request_neighborhood
  before insert on public.profiles
  for each row execute function public.carry_request_neighborhood();
