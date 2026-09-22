-- The demo wall is the room's, not the world's. It used to sit at the top
-- of the public Commons shelf for anyone browsing; now each event's wall is
-- its own gallery shelf, shown only to that event's participants. The read
-- policy follows: a row is visible to people whose profile carries the same
-- event code (and always to its owner, so they can take it down).
--
-- The presentation page (/show/CODE) keeps working for a projector laptop
-- that isn't signed in: event_showcase_for() is security definer and holds
-- the code, which is the key.

drop policy if exists "showcase: public read" on public.event_showcase;

create policy "showcase: participants read their event"
  on public.event_showcase for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.event_code, '')) = upper(event_showcase.event_code)
    )
  );
