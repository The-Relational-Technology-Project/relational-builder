-- Event Admins: a host who can run the room without a Steward.
--
-- A steward names admins for an event by email, on the Codes tab. An admin
-- gets the Event Admin page: the room key and presentation links, who has
-- joined, add a builder by email (stamped without scanning), remove
-- someone, take a deck off the shelf, and turn the code on or off. Minting,
-- dating and archiving codes stay with stewards.
--
-- Keyed on email rather than user id so a steward can name someone before
-- they have an account; the role attaches the moment they sign in with that
-- address. Writes to this table are steward acts (service role, via
-- admin-requests); the client reads only its own rows, to know which pages
-- to offer. Everything an admin does goes through the security-definer
-- functions below, each of which checks is_event_admin() first.

create table if not exists public.event_admins (
  code text not null references public.event_codes (code) on delete cascade,
  email text not null,
  added_by text not null,
  created_at timestamptz not null default now(),
  primary key (code, email)
);

alter table public.event_admins enable row level security;

create policy "event_admins: see your own standing"
  on public.event_admins for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

create or replace function public.is_event_admin(p_code text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.event_admins a
    where upper(a.code) = upper(trim(coalesce(p_code, '')))
      and lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

revoke all on function public.is_event_admin(text) from public;
grant execute on function public.is_event_admin(text) to authenticated;

-- The events I administer, with the room count — the Event Admin page's
-- picker and header
create or replace function public.my_admin_events()
returns table (
  code text,
  name text,
  active boolean,
  event_date date,
  expires_at timestamptz,
  archived_at timestamptz,
  studio_slug text,
  studio_label text,
  joined bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select e.code, e.name, e.active, e.event_date, e.expires_at, e.archived_at,
         e.studio_slug, e.studio_label,
         (select count(*) from public.profiles p where upper(p.event_code) = upper(e.code)) as joined
  from public.event_codes e
  join public.event_admins a on upper(a.code) = upper(e.code)
  where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  order by e.created_at desc;
$$;

revoke all on function public.my_admin_events() from public;
grant execute on function public.my_admin_events() to authenticated;

-- Who is in the room. Profiles are own-row RLS, so this is the one place
-- an admin sees other people's names and addresses — only for their event.
create or replace function public.event_participants(p_code text)
returns table (id uuid, email text, display_name text, full_name text, neighborhood text, joined_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.display_name, p.full_name, p.neighborhood, p.created_at
  from public.profiles p
  where public.is_event_admin(p_code)
    and upper(p.event_code) = upper(trim(coalesce(p_code, '')))
  order by p.created_at desc;
$$;

revoke all on function public.event_participants(text) from public;
grant execute on function public.event_participants(text) to authenticated;

-- Add a builder by email: same stamp and studio seat as scanning the key.
-- Returns false when no account carries that address yet — the admin is
-- told to hand them the room key instead.
create or replace function public.event_add_participant(p_code text, p_email text)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  ev record;
  who record;
begin
  if not public.is_event_admin(p_code) then
    raise exception 'Not an admin of this event' using errcode = '42501';
  end if;
  select e.code, e.studio_slug, e.studio_label into ev
  from public.event_codes e
  where upper(e.code) = upper(trim(coalesce(p_code, '')))
  limit 1;
  if ev.code is null then
    return false;
  end if;
  select p.id, p.display_name, p.full_name into who
  from public.profiles p
  where lower(p.email) = lower(trim(coalesce(p_email, '')))
  limit 1;
  if who.id is null then
    return false;
  end if;
  update public.profiles p set event_code = ev.code where p.id = who.id;
  if ev.studio_slug is not null then
    insert into public.studio_memberships
      (user_id, studio_slug, studio_label, display_name, role, status)
    values (who.id, ev.studio_slug, coalesce(ev.studio_label, ev.studio_slug),
            coalesce(who.display_name, who.full_name), 'member', 'approved')
    on conflict (user_id, studio_slug) do update
      set status = 'approved'
      where public.studio_memberships.status = 'pending';
  end if;
  return true;
end;
$$;

revoke all on function public.event_add_participant(text, text) from public;
grant execute on function public.event_add_participant(text, text) to authenticated;

-- Remove someone from the room: the stamp comes off and their decks leave
-- the shelf. Their account and studio membership are untouched.
create or replace function public.event_remove_participant(p_code text, p_user_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  n integer;
begin
  if not public.is_event_admin(p_code) then
    raise exception 'Not an admin of this event' using errcode = '42501';
  end if;
  update public.profiles p set event_code = null
  where p.id = p_user_id
    and upper(p.event_code) = upper(trim(coalesce(p_code, '')));
  get diagnostics n = row_count;
  delete from public.event_showcase s
  where s.owner_id = p_user_id
    and upper(s.event_code) = upper(trim(coalesce(p_code, '')));
  return n > 0;
end;
$$;

revoke all on function public.event_remove_participant(text, uuid) from public;
grant execute on function public.event_remove_participant(text, uuid) to authenticated;

-- Turn the key on or off from the room. Archiving stays a steward act.
create or replace function public.event_set_active(p_code text, p_active boolean)
returns boolean
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_event_admin(p_code) then
    raise exception 'Not an admin of this event' using errcode = '42501';
  end if;
  update public.event_codes e set active = p_active
  where upper(e.code) = upper(trim(coalesce(p_code, '')))
    and e.archived_at is null;
  return found;
end;
$$;

revoke all on function public.event_set_active(text, boolean) from public;
grant execute on function public.event_set_active(text, boolean) to authenticated;

-- The host curates the wall: an admin can take any deck off their event's
-- shelf, not just their own
drop policy if exists "showcase: own rows removable" on public.event_showcase;
create policy "showcase: own rows or your event's removable"
  on public.event_showcase for delete
  using (owner_id = auth.uid() or public.is_event_admin(event_code));

-- Admins see their event's shelf even if they never joined as a participant
drop policy if exists "showcase: participants read their event" on public.event_showcase;
create policy "showcase: participants and admins read their event"
  on public.event_showcase for select
  using (
    owner_id = auth.uid()
    or public.is_event_admin(event_code)
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.event_code, '')) = upper(event_showcase.event_code)
    )
  );
