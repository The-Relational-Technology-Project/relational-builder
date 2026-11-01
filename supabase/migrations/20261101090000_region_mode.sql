-- Regional mode on the builder profile (docs/REGIONAL-MODE.md).
-- 'global' is today's behaviour; 'eu' ranks EU-run services first, swaps
-- Google Fonts for Bunny Fonts in every preview and publish, and tells the
-- model. Owner-only read/update is already enforced by the profiles RLS.
alter table public.profiles
  add column if not exists region_mode text not null default 'global';

alter table public.profiles
  drop constraint if exists profiles_region_mode_check;
alter table public.profiles
  add constraint profiles_region_mode_check check (region_mode in ('global', 'eu'));
