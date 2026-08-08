-- Event codes: a steward-minted invite code for a whole room.
--
-- At the door it behaves exactly like a builder's referral code (?ref=CODE
-- auto-approves the account), but it belongs to an event, not a person —
-- and everyone who joins through it gets the code stamped on their profile,
-- so the Builder knows who was in the room together: the steward can count
-- the room, and connection suggestions can favor people from the same event.
--
-- Also in this migration: project invitations start counting as referrals.
-- When an invited collaborator's profile is created and no referral code
-- explains their arrival, the inviter's own code is stamped as
-- referred_by_code — my_referral_stats() then counts them without changes.

create table if not exists public.event_codes (
  code text primary key,
  name text not null,
  active boolean not null default true,
  -- After this moment the code stops opening the door (null = no expiry).
  -- Deactivating is instant and reversible; expiry is for set-and-forget.
  expires_at timestamptz,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Steward-only, via the admin-requests function's service role. RLS on with
-- no policies keeps every client key out, same stance as account_requests.
alter table public.event_codes enable row level security;

alter table public.profiles
  -- The event this builder joined through — the participant tag
  add column if not exists event_code text;

alter table public.account_requests
  -- Set only when the server validated the code against a live event
  add column if not exists event_code text;

-- ── One namespace at the door ────────────────────────────────────────
-- A code typed into the request form is looked up as a builder's first,
-- then as an event's, so freshly minted builder codes must steer around
-- event codes too.

create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  new_code text;
begin
  loop
    new_code := '';
    for i in 1..6 loop
      new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = new_code)
      and not exists (select 1 from public.event_codes where code = new_code);
  end loop;
  return new_code;
end;
$$;

-- ── Assignment + attribution at profile creation ─────────────────────
-- Extends the referral trigger with two new stamps:
--   event_code       — from the account request the event code approved
--   referred_by_code — falls back to the inviter's code when a project
--                      invitation (not a typed code) is what got them in

create or replace function public.assign_referral_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  via text;
begin
  if new.referral_code is null then
    new.referral_code := public.generate_referral_code();
  end if;

  if new.referred_by_code is null then
    select referral_code into via
    from public.account_requests
    where lower(email) = lower(coalesce(new.email, ''))
      and referral_code is not null
    order by created_at desc
    limit 1;
    if via is not null then
      new.referred_by_code := via;
    end if;
  end if;

  -- A project invitation is a referral in everything but the typing: the
  -- inviter vouched, the invitee arrived. Earliest invitation gets the
  -- credit — that's the one that actually opened the door.
  if new.referred_by_code is null then
    select ip.referral_code into via
    from public.project_members pm
    join public.profiles ip on ip.id = pm.invited_by
    where lower(pm.email) = lower(coalesce(new.email, ''))
      and ip.referral_code is not null
    order by pm.created_at asc
    limit 1;
    if via is not null then
      new.referred_by_code := via;
    end if;
  end if;

  if new.event_code is null then
    select event_code into via
    from public.account_requests
    where lower(email) = lower(coalesce(new.email, ''))
      and event_code is not null
    order by created_at desc
    limit 1;
    if via is not null then
      new.event_code := via;
    end if;
  end if;

  return new;
end;
$$;
