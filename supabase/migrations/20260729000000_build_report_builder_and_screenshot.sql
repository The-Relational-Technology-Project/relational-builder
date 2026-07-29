-- Build reports grow an identity and a picture. The consent card now asks
-- who's building (name + email, optional — the email doubles as the
-- follow-up contact, superseding follow_up_email) and offers a separately
-- ticked box to include a snapshot of the running app. The snapshot lands
-- here as a JPEG data URL and rides the steward email as an attachment.
-- Same consent shape as everything else on the card: nothing is stored
-- without the builder's explicit yes.

alter table public.build_reports
  add column if not exists builder_name text,
  add column if not exists builder_email text,
  add column if not exists screenshot text;
