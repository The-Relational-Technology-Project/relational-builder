-- A way to reach the builder, on the demo wall and in the deck.
--
-- At a buildathon the deck is how a project meets the room, and the room
-- often wants to follow up: "can I use this on my block?", "want to build
-- the next piece together?". Until now a wall entry carried the builder's
-- name and nothing to act on. This adds one optional contact method, as the
-- builder chooses to give it: a label (Email, Phone, Website, or their own
-- word) and the value. Both are opt-in in Share Live and empty by default;
-- an unlisted deck and a room's wall are still public enough that nothing
-- should land there unasked.
--
-- Same shape as the rest of the row: participants read it, the presentation
-- RPC hands it out with the code, event_code stays server-side.

alter table public.event_showcase
  add column if not exists contact_label text,
  add column if not exists contact_value text;

grant select (contact_label, contact_value) on public.event_showcase to anon, authenticated;
grant insert (contact_label, contact_value) on public.event_showcase to authenticated;

-- The return shape changes, so the function is replaced rather than altered
drop function if exists public.event_showcase_for(text);

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
  contact_label text,
  contact_value text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.event_name, s.owner_id, s.builder_name, s.project_name,
         s.one_liner, s.screenshot_url, s.deck_url, s.demo_url,
         s.contact_label, s.contact_value, s.created_at
  from public.event_showcase s
  where upper(s.event_code) = upper(trim(coalesce(p_code, '')))
  order by s.created_at asc;
$$;

revoke all on function public.event_showcase_for(text) from public;
grant execute on function public.event_showcase_for(text) to anon, authenticated;
