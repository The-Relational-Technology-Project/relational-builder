-- An event's inspiration shelf (Oct 6 2026).
--
-- The event gallery used to be the demo wall alone: the decks a room pins
-- with Share Live. A host wanted the Sunset Build-a-thon shelf to also hold
-- the neighborhood's own working tools — the real outersunset.* sites, as
-- themselves, not the generic commons cards they inspired — so builders in
-- the room have something concrete to look at before they start.
--
-- These rows are that shelf. They are curated by hand (a steward seeds
-- them; nothing in the app writes here yet), read by event code the same
-- way the demo wall is (event_shelf_items_for mirrors event_showcase_for:
-- public by code, because a live code is already the key to the room), and
-- rendered BELOW the decks in the gallery. The presentation page never reads
-- them: /show/CODE is the decks and only the decks.

create table if not exists public.event_shelf_items (
  id uuid primary key default gen_random_uuid(),
  event_code text not null,
  title text not null,
  summary text,
  -- Longer note, markdown: what the thing is and how it works where it lives
  body text,
  -- Screenshot of the live site, hosted on the public studio-library bucket
  image_url text,
  site_url text,
  repo_url text,
  -- Where it lives and who keeps it, in one line
  attribution text,
  tags text[] not null default '{}',
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

create index if not exists event_shelf_items_code_idx
  on public.event_shelf_items (upper(event_code), sort_order, created_at);

-- No client policies: reads go through the function below, writes are a
-- steward's (service role) act for now.
alter table public.event_shelf_items enable row level security;

create or replace function public.event_shelf_items_for(p_code text)
returns table (
  id uuid,
  title text,
  summary text,
  body text,
  image_url text,
  site_url text,
  repo_url text,
  attribution text,
  tags text[],
  sort_order int
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.title, i.summary, i.body, i.image_url, i.site_url, i.repo_url,
         i.attribution, i.tags, i.sort_order
  from public.event_shelf_items i
  where upper(i.event_code) = upper(trim(coalesce(p_code, '')))
  order by i.sort_order asc, i.created_at asc;
$$;

revoke all on function public.event_shelf_items_for(text) from public;
grant execute on function public.event_shelf_items_for(text) to anon, authenticated;
