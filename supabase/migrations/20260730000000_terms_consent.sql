-- Transparent consent: onboarding now asks builders to read and agree to
-- the Privacy & Terms (#privacy) before completing their profile. The
-- timestamp records when they agreed — null for profiles completed before
-- this step existed.

alter table public.profiles
  add column if not exists terms_accepted_at timestamptz;
