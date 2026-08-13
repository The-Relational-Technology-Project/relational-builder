-- Backfill referral / event attribution that the door missed.
--
-- The profile trigger (assign_referral_fields) stamps referred_by_code and
-- event_code from the joiner's account request — but request-account used to
-- create the auth user (and therefore the profile) BEFORE writing the code
-- onto the request row, so every ?ref= join was stamped null. The function
-- now writes the row first; this migration recovers the joins already missed.

-- 1. Typed / ?ref= referral codes: the most recent request carrying a code
update public.profiles p
set referred_by_code = sub.referral_code
from (
  select distinct on (lower(email)) lower(email) as email, referral_code
  from public.account_requests
  where referral_code is not null
  order by lower(email), created_at desc
) sub
where p.referred_by_code is null
  and lower(coalesce(p.email, '')) = sub.email;

-- 2. Event codes: same recovery for the participant tag
update public.profiles p
set event_code = sub.event_code
from (
  select distinct on (lower(email)) lower(email) as email, event_code
  from public.account_requests
  where event_code is not null
  order by lower(email), created_at desc
) sub
where p.event_code is null
  and lower(coalesce(p.email, '')) = sub.email;

-- 3. Project invitations: the trigger's fallback (earliest invitation gets
-- the credit) only ever ran for profiles created after 2026-08-08 — credit
-- the earlier ones too. Only invitations that predate the profile count:
-- an invite sent to someone already inside didn't open any door.
update public.profiles p
set referred_by_code = sub.referral_code
from (
  select distinct on (lower(pm.email))
         lower(pm.email) as email, ip.referral_code, pm.created_at
  from public.project_members pm
  join public.profiles ip on ip.id = pm.invited_by
  where ip.referral_code is not null
  order by lower(pm.email), pm.created_at asc
) sub
where p.referred_by_code is null
  and lower(coalesce(p.email, '')) = sub.email
  and sub.created_at <= p.created_at;
