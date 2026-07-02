-- A builder's personal mini design system — their palette, type, and
-- feel, in their own words. Woven into every build so new apps carry the
-- builder's and the place's aesthetic (never a platform-wide house style).

alter table public.profiles
  add column if not exists design_system text;
