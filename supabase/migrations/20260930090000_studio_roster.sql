-- Studio Admin roster shows who people are (Sep 30 2026). The Members tab
-- read studio_memberships directly, and the name there is a snapshot taken
-- when the person first knocked or was seated — usually before they had
-- filled in a profile, so most rows read "A builder". Profiles are readable
-- only by their owner, so the admin also couldn't see an email to tell
-- people apart, including whoever is waiting at the door.
--
-- This reader returns the roster joined to live profiles: the current
-- display name (falling back to full name, then the join-time snapshot)
-- and the email. Admin-only, checked inside the function, same shape as
-- event_participants.

create or replace function public.studio_roster(p_slug text)
returns table (
  user_id uuid,
  studio_slug text,
  studio_label text,
  display_name text,
  email text,
  joined_at timestamptz,
  role text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.user_id,
    m.studio_slug,
    m.studio_label,
    coalesce(
      nullif(trim(p.display_name), ''),
      nullif(trim(p.full_name), ''),
      nullif(trim(m.display_name), '')
    ) as display_name,
    p.email,
    m.joined_at,
    m.role::text,
    m.status::text
  from public.studio_memberships m
  left join public.profiles p on p.id = m.user_id
  where public.is_studio_admin(p_slug)
    and m.studio_slug = p_slug
  order by m.joined_at desc;
$$;

revoke all on function public.studio_roster(text) from public;
grant execute on function public.studio_roster(text) to authenticated;
