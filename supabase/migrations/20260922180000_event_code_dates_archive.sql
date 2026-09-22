-- Event codes: the date is context, not a deadline — and codes can be
-- archived when an event is done.
--
-- A code used to carry expires_at as its last working day, which made a
-- one-day build-a-thon's code lapse at midnight. But the room keeps using
-- it: the event shelf in the Gallery, the presentation page, a late joiner
-- pinning their deck the next week. So the steward now records the event's
-- DATE, and the code stays open for 60 days past it. A code with no date is
-- open until a steward turns it off or archives it. expires_at stays as the
-- single thing the door and join_event check; it is derived from the date.
--
-- archived_at takes finished events off the working list without losing
-- the profiles that carry the code (the shelf keeps grouping by it).

alter table public.event_codes
  add column if not exists event_date date,
  add column if not exists archived_at timestamptz;

-- Existing codes: the old last-day became the event date; the door stays
-- open 60 days past it, per the new rule
update public.event_codes
set event_date = (expires_at at time zone 'utc')::date,
    expires_at = ((expires_at at time zone 'utc')::date + 61) at time zone 'utc'
where expires_at is not null and event_date is null;

-- ACC is an evergreen invite: no date, no expiry, back on
update public.event_codes
set event_date = null, expires_at = null, active = true
where code = 'ACC';

-- TEST was created for Sep 22; its expiry was stored as local midnight,
-- which reads as the 23rd in UTC
update public.event_codes
set event_date = date '2026-09-22', expires_at = (date '2026-09-22' + 61) at time zone 'utc'
where code = 'TEST';
