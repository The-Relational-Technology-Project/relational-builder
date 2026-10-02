-- my_event() learns which studio its code belongs to (Oct 3 2026).
--
-- The gallery now shows a room's freshly shared builds at the top of the
-- shelf, and that section has to land in the right place: on the gallery of
-- the studio the event belongs to, and nowhere else. my_admin_events
-- already returns studio_slug; my_event did not, so the client had no way
-- to tell whether the viewer's event belonged to the shelf they were
-- looking at.
--
-- Return type changes, so the old function is dropped first.

drop function if exists public.my_event();

create or replace function public.my_event()
returns table (code text, name text, studio_slug text)
language sql
stable
security definer
set search_path = public
as $$
  select e.code, e.name, e.studio_slug
  from public.profiles p
  join public.event_codes e on upper(e.code) = upper(p.event_code)
  where p.id = auth.uid();
$$;

revoke all on function public.my_event() from public;
grant execute on function public.my_event() to authenticated;
