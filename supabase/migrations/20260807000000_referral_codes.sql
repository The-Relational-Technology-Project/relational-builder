-- Referral codes: every approved builder carries a personal invite code.
-- A friend who signs up with it gets in without waiting on the steward —
-- the code is the vouch, and the magic-link email is the confirmation
-- (sign-in OTPs only ever go to the address itself). The steward still
-- sees every referred join in the request history and gets an FYI email.
--
-- Codes are uppercase, from an alphabet with no lookalikes (no 0/O/1/I/L),
-- so they survive being read aloud at a block party.

alter table public.profiles
  add column if not exists referral_code text,
  -- The code this builder joined through, stamped at first sign-in —
  -- what "N builders joined through your code" counts.
  add column if not exists referred_by_code text;

create unique index if not exists profiles_referral_code_key
  on public.profiles (referral_code);

alter table public.account_requests
  -- Set only when the server validated the code against a real builder;
  -- an unrecognized code is never stored (the request just goes to the
  -- steward the usual way).
  add column if not exists referral_code text;

-- ── Code generation ──────────────────────────────────────────────────

create or replace function public.generate_referral_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  return code;
end;
$$;

-- ── Assignment + attribution at profile creation ─────────────────────
-- handle_new_user inserts the profiles row at first sign-in (on conflict
-- do update), so a BEFORE INSERT trigger runs exactly once per builder.

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

  return new;
end;
$$;

drop trigger if exists profiles_assign_referral on public.profiles;
create trigger profiles_assign_referral
  before insert on public.profiles
  for each row execute function public.assign_referral_fields();

-- ── Backfill: every existing builder gets a code ─────────────────────

update public.profiles
set referral_code = public.generate_referral_code()
where referral_code is null;

-- The steward's own code stays simple enough to say out loud
update public.profiles
set referral_code = 'JOSH'
where lower(email) = 'joshuanesbit@gmail.com'
  and not exists (select 1 from public.profiles where referral_code = 'JOSH');

-- ── Stats: how many builders joined through my code ──────────────────
-- profiles RLS is own-row-only, so the count lives behind a definer RPC:
-- it answers only for the caller, and only with a number.

create or replace function public.my_referral_stats()
returns table (referral_code text, joined_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select p.referral_code,
         (select count(*)
            from public.profiles j
           where j.referred_by_code is not null
             and upper(j.referred_by_code) = upper(p.referral_code))
  from public.profiles p
  where p.id = auth.uid();
$$;

revoke all on function public.my_referral_stats() from public;
grant execute on function public.my_referral_stats() to authenticated;
