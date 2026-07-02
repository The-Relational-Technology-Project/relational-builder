-- Builder profiles grounded in place (mirrors RT Studio's onboarding).
-- The place a builder tends — and what they dream of building there —
-- becomes context for every build chat.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists neighborhood text,
  add column if not exists neighborhood_description text,
  add column if not exists dreams text,
  add column if not exists tech_familiarity text,
  add column if not exists ai_coding_experience text,
  add column if not exists email_opt_in boolean,
  add column if not exists profile_completed boolean not null default false;
