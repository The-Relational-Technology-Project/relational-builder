-- The studio doorway: one link does the whole walk. A fellow invited by a
-- Thread steward opens ?studio=thread, requests an account there, and the
-- studio travels with the request — when their account is approved and they
-- first sign in, their request to join the studio is filed automatically.
-- One approval on each side (steward lets them into the Builder, Studio
-- Admin lets them into the studio), zero coordination in between.

alter table public.account_requests
  add column if not exists studio_slug text,
  add column if not exists studio_label text;

-- First sign-in creates the profile row (handle_new_user); this trigger
-- claims any studio intent the account request carried. Security definer:
-- the brand-new user is inserting their own membership, exactly what the
-- "join studios" policy would allow them to do by hand a click later.
create or replace function public.claim_studio_intent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  select studio_slug, studio_label into req
  from public.account_requests
  where lower(email) = lower(coalesce(new.email, ''))
    and studio_slug is not null
  order by created_at desc
  limit 1;

  if req.studio_slug is not null then
    insert into public.studio_memberships
      (user_id, studio_slug, studio_label, display_name, role, status)
    values (
      new.id,
      req.studio_slug,
      coalesce(req.studio_label, req.studio_slug),
      new.display_name,
      'member',
      case when public.is_gated_studio(req.studio_slug)
           then 'pending' else 'approved' end
    )
    on conflict (user_id, studio_slug) do nothing;
  end if;

  return new;
end;
$$;

-- handle_new_user upserts profiles (insert … on conflict do update), so an
-- AFTER INSERT trigger fires exactly once, at first sign-in.
drop trigger if exists profiles_claim_studio_intent on public.profiles;
create trigger profiles_claim_studio_intent
  after insert on public.profiles
  for each row execute function public.claim_studio_intent();
