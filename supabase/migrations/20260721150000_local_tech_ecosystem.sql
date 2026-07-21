-- The builder's local tech ecosystem — the tools, platforms, and community
-- software already running in their place, in their own words. Woven into
-- plan and build chats so new tools are designed to occupy a real niche:
-- linking to what exists, sharing data with it, never duplicating it.

alter table public.profiles
  add column if not exists local_tech_ecosystem text;
