-- An event code can carry a studio (Sep 9 2026). A build-a-thon run by a
-- studio wants its room to land INSIDE that studio, not just in the Builder:
-- the code now names the studio, and joining through it vouches for studio
-- membership the same way it vouches for the account — no Studio Admin
-- click per person at the door.
--
-- Mechanics: request-account copies the code's studio onto the account
-- request (studio_slug/label, alongside event_code); claim_studio_intent
-- below then files the membership at first sign-in as it always has, but
-- approves it outright when the request's event code carries that same
-- studio — even for a gated studio. A studio arrived at through a plain
-- ?studio= doorway (no vouching code) still waits at the door as before.

alter table public.event_codes
  add column if not exists studio_slug text,
  add column if not exists studio_label text;

create or replace function public.claim_studio_intent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  vouched boolean := false;
begin
  select studio_slug, studio_label, event_code into req
  from public.account_requests
  where lower(email) = lower(coalesce(new.email, ''))
    and studio_slug is not null
  order by created_at desc
  limit 1;

  if req.studio_slug is not null then
    -- A live event code that names this studio is the stewards' standing
    -- invitation: whoever holds the key is in.
    if req.event_code is not null then
      select exists (
        select 1 from public.event_codes e
        where upper(e.code) = upper(req.event_code)
          and lower(e.studio_slug) = lower(req.studio_slug)
      ) into vouched;
    end if;

    insert into public.studio_memberships
      (user_id, studio_slug, studio_label, display_name, role, status)
    values (
      new.id,
      req.studio_slug,
      coalesce(req.studio_label, req.studio_slug),
      new.display_name,
      'member',
      case when public.is_gated_studio(req.studio_slug) and not vouched
           then 'pending' else 'approved' end
    )
    on conflict (user_id, studio_slug) do nothing;
  end if;

  return new;
end;
$$;
