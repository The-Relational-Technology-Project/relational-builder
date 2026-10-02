-- Radically Rural studio (Oct 2 2026). A studio for the Radically Rural
-- network — the small-town vitality network started by the Hannah Grimes
-- Center and The Keene Sentinel — whose whole habit is finding what works
-- in one town and moving it to the next. Its models become shelf items:
-- examples a builder can read, and remix into a tool for their own town.
--
-- Identity (label, color, tagline, principles) rides in the Builder repo's
-- BUILTIN_STUDIOS, same as Responsive Cities, until the KB project's
-- multi-tenant studio columns land. What lives here is the door and the
-- first Studio Admin.
--
-- Open door: anyone signed in can join and see the shelf. The models are
-- public knowledge already; the point is to spread them, not gate them.

insert into public.studio_settings (studio_slug, access)
  values ('radically-rural', 'open')
  on conflict (studio_slug) do nothing;

-- Seat the studio's first admin. The admin role only ever comes from the
-- steward (an invite seats a plain member), so it is set here by email
-- against an existing profile. If she has not signed in yet this is a
-- no-op and the insert below needs re-running once she has.
insert into public.studio_memberships (user_id, studio_slug, studio_label, display_name, role, status)
select
  p.id,
  'radically-rural',
  'Radically Rural',
  coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.full_name), '')),
  'admin',
  'approved'
from public.profiles p
where lower(p.email) = 'deborah@relationaltechproject.org'
on conflict (user_id, studio_slug) do update
  set role = 'admin', status = 'approved';
