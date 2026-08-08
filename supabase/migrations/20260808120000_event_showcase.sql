-- Event showcase: the demo wall. When an event participant makes a Share
-- Live deck, they can pin it here — screenshot, one-liner, and links to the
-- slides and the running app — and the Gallery shows the room what the room
-- built. Rows are public (that's the point of a wall); the event CODE on a
-- row is not, since a live code is a key to the door. Column-level grants
-- keep it server-side while everything else reads anonymously.

create table if not exists public.event_showcase (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  -- Denormalized so the public wall never has to touch event_codes
  event_name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  builder_name text,
  project_name text not null,
  one_liner text,
  screenshot_url text,
  deck_url text not null,
  demo_url text,
  created_at timestamptz not null default now(),
  -- Re-sharing the same project replaces its wall entry (client deletes
  -- then inserts; the constraint keeps concurrent shares from doubling up)
  unique (event_code, owner_id, project_name)
);

alter table public.event_showcase enable row level security;

-- The wall is public — anyone browsing the Gallery sees it
create policy "showcase: public read"
  on public.event_showcase for select
  using (true);

-- Only a participant of the event can pin to its wall, and only as
-- themselves. The profiles subquery runs under own-row RLS, which is
-- exactly the row it needs.
create policy "showcase: participants pin their own"
  on public.event_showcase for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.event_code, '')) = upper(event_showcase.event_code)
    )
  );

create policy "showcase: own rows removable"
  on public.event_showcase for delete
  using (owner_id = auth.uid());

-- Column-level privileges: everything is readable EXCEPT event_code (a live
-- key), which clients may write on insert but never read back. owner_id
-- stays readable so a builder can spot and remove their own entries.
revoke all on public.event_showcase from anon, authenticated;
grant select (id, event_name, owner_id, builder_name, project_name, one_liner,
              screenshot_url, deck_url, demo_url, created_at)
  on public.event_showcase to anon, authenticated;
grant insert (event_code, event_name, owner_id, builder_name, project_name,
              one_liner, screenshot_url, deck_url, demo_url)
  on public.event_showcase to authenticated;
grant delete on public.event_showcase to authenticated;

-- ── Which event am I part of? ────────────────────────────────────────
-- event_codes is service-role only (codes are keys), and profiles carries
-- just the raw code — this hands the signed-in builder their own event's
-- name without opening either table.

create or replace function public.my_event()
returns table (code text, name text)
language sql
stable
security definer
set search_path = public
as $$
  select e.code, e.name
  from public.profiles p
  join public.event_codes e on upper(e.code) = upper(p.event_code)
  where p.id = auth.uid();
$$;

revoke all on function public.my_event() from public;
grant execute on function public.my_event() to authenticated;
