-- Join an event from an existing account, and read one event's demo wall.
--
-- Until now the only way onto an event was the door: request-account stamped
-- event_code on the account request, and the profile's BEFORE INSERT trigger
-- copied it across exactly once. A builder who already had an account and
-- scanned the room key was stashed a code the app never spent — they could
-- not join, could not pin to the wall, and never counted as "joined".
--
-- join_event(code) closes that: a signed-in builder hands the app a live
-- event code, the code goes on their profile, and the code's studio (if any)
-- seats them the same way the door does — approved outright, gated or not,
-- because the key vouches. Re-joining the same event is a no-op; joining a
-- different one moves them (a profile carries one event at a time, and the
-- showcase insert policy keys on it).
--
-- event_showcase_for(code) is the room's own view of the wall: every deck
-- pinned to that event, oldest first — publish order — for the presentation
-- page a steward projects. The rows are already public; what the code buys
-- is the grouping, since event_code itself is never readable by clients.

create or replace function public.join_event(p_code text)
returns table (code text, name text, studio_slug text, studio_label text)
language plpgsql
volatile
security definer
set search_path = public
as $$
-- The output columns double as PL/pgSQL variables; the table columns win
-- wherever a name (studio_slug in the insert) could mean either
#variable_conflict use_column
declare
  ev record;
  me record;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join an event' using errcode = '42501';
  end if;

  select e.code, e.name, e.studio_slug, e.studio_label
    into ev
  from public.event_codes e
  where upper(e.code) = upper(trim(coalesce(p_code, '')))
    and e.active
    and (e.expires_at is null or e.expires_at > now())
  limit 1;

  -- Not an event code (a builder's personal code lands here too), or one
  -- that has been turned off or lapsed: nothing to join
  if ev.code is null then
    return;
  end if;

  select p.display_name, p.full_name into me
  from public.profiles p
  where p.id = auth.uid();

  update public.profiles p
  set event_code = ev.code
  where p.id = auth.uid()
    and (p.event_code is null or upper(p.event_code) <> upper(ev.code));

  if ev.studio_slug is not null then
    insert into public.studio_memberships
      (user_id, studio_slug, studio_label, display_name, role, status)
    values (
      auth.uid(),
      ev.studio_slug,
      coalesce(ev.studio_label, ev.studio_slug),
      coalesce(me.display_name, me.full_name),
      'member',
      'approved'
    )
    on conflict (user_id, studio_slug) do update
      set status = 'approved'
      where public.studio_memberships.status = 'pending';
  end if;

  return query select ev.code, ev.name, ev.studio_slug, ev.studio_label;
end;
$$;

revoke all on function public.join_event(text) from public;
grant execute on function public.join_event(text) to authenticated;

create or replace function public.event_showcase_for(p_code text)
returns table (
  id uuid,
  event_name text,
  owner_id uuid,
  builder_name text,
  project_name text,
  one_liner text,
  screenshot_url text,
  deck_url text,
  demo_url text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.event_name, s.owner_id, s.builder_name, s.project_name,
         s.one_liner, s.screenshot_url, s.deck_url, s.demo_url, s.created_at
  from public.event_showcase s
  where upper(s.event_code) = upper(trim(coalesce(p_code, '')))
  order by s.created_at asc;
$$;

revoke all on function public.event_showcase_for(text) from public;
grant execute on function public.event_showcase_for(text) to anon, authenticated;

-- The name on the room key, for a presentation page opened cold (the wall
-- rows carry event_name too, but an event with no decks yet still has a name)
create or replace function public.event_name_for(p_code text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select e.name
  from public.event_codes e
  where upper(e.code) = upper(trim(coalesce(p_code, '')))
  limit 1;
$$;

revoke all on function public.event_name_for(text) from public;
grant execute on function public.event_name_for(text) to anon, authenticated;
