-- Places for the gallery, and event galleries that last (Oct 22 2026).
--
-- 1. A location on the Builder's own shelves. The commons carries one in
--    metadata.location (see src/knowledge/geo.ts for the shape: lat, lng,
--    label, precision, basis, also[]); studio library items and event codes
--    get a column of the same shape. The gallery's Nearby filter reads them
--    all the same way. An event's location stands in for every build pinned
--    to its wall and every item on its inspiration shelf.
--
-- 2. Event galleries persist. A profile carries ONE event code at a time
--    (joining another event moves you, because the wall's insert policy keys
--    on it), so a builder who went to two build days lost the first room's
--    shelf, and an archived event vanished from its hosts' list. The room's
--    gallery is worth keeping the way a studio's is: event_participations
--    remembers every event a person has joined, filled by a trigger on the
--    profile's event_code (the door, join_event, and the steward's hand-add
--    all go through that column) and backfilled from today's profiles.
--    my_events() lists them all — current or not, archived or not — with the
--    event's place, so the gallery can offer each as a shelf of its own.

alter table public.studio_library_items
  add column if not exists location jsonb;

alter table public.event_codes
  add column if not exists location jsonb;

-- --- Every event a person has been part of ---

create table if not exists public.event_participations (
  user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  joined_at timestamptz not null default now(),
  primary key (user_id, code)
);

alter table public.event_participations enable row level security;

drop policy if exists "participations: own rows" on public.event_participations;
create policy "participations: own rows"
  on public.event_participations for select
  to authenticated
  using (user_id = auth.uid());

-- The profile's event_code is the one door everything comes through
create or replace function public.remember_event_participation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.event_code is not null and trim(new.event_code) <> '' then
    insert into public.event_participations (user_id, code)
    values (new.id, upper(trim(new.event_code)))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_remember_event on public.profiles;
create trigger profiles_remember_event
  after insert or update of event_code on public.profiles
  for each row execute function public.remember_event_participation();

insert into public.event_participations (user_id, code, joined_at)
select p.id, upper(trim(p.event_code)), coalesce(p.created_at, now())
from public.profiles p
where p.event_code is not null and trim(p.event_code) <> ''
on conflict do nothing;

-- --- The events a builder can open as galleries ---

create or replace function public.my_events()
returns table (
  code text,
  name text,
  studio_slug text,
  event_date date,
  archived_at timestamptz,
  location jsonb,
  current boolean,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select e.code, e.name, e.studio_slug, e.event_date, e.archived_at, e.location,
         upper(coalesce(p.event_code, '')) = upper(e.code) as current,
         x.joined_at
  from public.event_participations x
  join public.event_codes e on upper(e.code) = upper(x.code)
  left join public.profiles p on p.id = x.user_id
  where x.user_id = auth.uid()
  order by x.joined_at desc;
$$;

revoke all on function public.my_events() from public;
grant execute on function public.my_events() to authenticated;

-- The host's list carries the place too, and keeps archived events: a
-- finished room's gallery is still the host's to open. (A new output column
-- means drop-and-create; the grant is restated below.)
drop function if exists public.my_admin_events();
create function public.my_admin_events()
returns table (
  code text,
  name text,
  active boolean,
  event_date date,
  expires_at timestamptz,
  archived_at timestamptz,
  studio_slug text,
  studio_label text,
  joined bigint,
  location jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select e.code, e.name, e.active, e.event_date, e.expires_at, e.archived_at,
         e.studio_slug, e.studio_label,
         (select count(*) from public.profiles p where upper(p.event_code) = upper(e.code)) as joined,
         e.location
  from public.event_codes e
  join public.event_admins a on upper(a.code) = upper(e.code)
  where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by e.created_at desc;
$$;

revoke all on function public.my_admin_events() from public;
grant execute on function public.my_admin_events() to authenticated;

-- The event's place, for a shelf opened by code (the /show page, the gallery)
create or replace function public.event_location_for(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select e.location
  from public.event_codes e
  where upper(e.code) = upper(trim(coalesce(p_code, '')))
  limit 1;
$$;

revoke all on function public.event_location_for(text) from public;
grant execute on function public.event_location_for(text) to anon, authenticated;
