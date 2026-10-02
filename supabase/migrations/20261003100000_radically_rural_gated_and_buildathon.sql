-- Close the Radically Rural door, and open one code that walks through it
-- (Oct 3 2026).
--
-- The studio opened with access 'open' on the reasoning that the models are
-- public knowledge and the point is to spread them. That still holds for
-- the SHELF, but membership is a different question now that members can
-- contribute: an open studio means anyone signed in can file offers into
-- the gallery, and a studio admin at a conference should not be triaging
-- strangers. Gated it is.
--
-- Gated normally means everyone waits at the door for an admin click, which
-- is exactly the wrong experience for a room of 500 people. The event code
-- is the way through: claim_studio_intent (20260909120000) approves studio
-- membership OUTRIGHT when the account request's code carries that same
-- studio, gated or not. So:
--
--   RURAL  → account + approved Radically Rural membership, in one step
--   ?studio=radically-rural with no code → waits for a Studio Admin
--
-- Radically Rural 2026 runs October 6-8 in Keene, NH. Per the dates-and-
-- archive rule (20260922180000) the code stays live 60 days past the event
-- date, so the room can keep pinning and remixing after everyone goes home.

update public.studio_settings
  set access = 'gated', updated_at = now(), updated_by = 'radically-rural-2026'
  where studio_slug = 'radically-rural';

-- `name` is the only free text an event code carries — it shows up as
-- "You're in <name>" on the join banner and as "<name> Gallery" on the
-- event shelf, so it has to read as both.
insert into public.event_codes
  (code, name, active, event_date, expires_at, created_by, studio_slug, studio_label)
values (
  'RURAL',
  'Radically Rural 2026 Buildathon — Keene, NH',
  true,
  date '2026-10-08',
  (date '2026-10-08' + 61) at time zone 'utc',
  'deborah@relationaltechproject.org',
  'radically-rural',
  'Radically Rural'
)
on conflict (code) do update set
  name = excluded.name,
  active = true,
  archived_at = null,
  event_date = excluded.event_date,
  expires_at = excluded.expires_at,
  studio_slug = excluded.studio_slug,
  studio_label = excluded.studio_label;
