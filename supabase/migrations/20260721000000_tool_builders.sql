-- Builders behind the tools: associates a builder account with a KB gallery
-- tool, so a tool in the commons carries the human to talk to about it —
-- people inspired by a tool can reach its builder through Relational Builder
-- (consent-gated: contact affordances only appear when that builder's
-- connection settings are open).
--
-- The KB `tools` table lives in a different Supabase project, so tool_id is
-- a plain uuid with the tool's name denormalized beside it. builder_name is
-- likewise denormalized: profiles are RLS-private, and the association (who
-- grew this tool) is public information the builder opted into by being
-- credited — while HOW to reach them stays behind the connect function's
-- consent checks.

create table public.tool_builders (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null,
  tool_name text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  builder_name text,
  role text not null default 'primary builder',
  created_at timestamptz not null default now(),
  unique (tool_id, user_id)
);

alter table public.tool_builders enable row level security;

-- Anyone may see who built what; writes are curation — service role only
-- (steward), same posture as gallery_references.
create policy "tool_builders_read" on public.tool_builders
  for select using (true);

-- Seed: Josh Nesbit as primary builder of the founding relational tech tools.
-- No-ops cleanly in environments where the profile doesn't exist.
insert into public.tool_builders (tool_id, tool_name, user_id, builder_name)
select t.tool_id, t.tool_name, p.id, 'Josh Nesbit'
from (
  values
    ('c7391ea9-c94a-43b7-ab84-6817213f179b'::uuid, 'Hyperlocal Neighbor Hub'),
    ('0277b36f-422a-4a62-931a-9298dd7aceab'::uuid, 'Our Neighborhood Today'),
    ('dcb4d804-a256-4402-b785-00dabbf9635c'::uuid, 'Local Supplies Sharing'),
    ('12850b59-a867-46fe-8235-4382b7d558a0'::uuid, 'Neighbor Story Sharing'),
    ('187fd801-37fc-47c3-bacd-eb8930707c54'::uuid, 'Community Apps Dashboard'),
    ('50dbf81f-63d6-43f5-8804-d84656b7f4e3'::uuid, 'Block Party Organizing'),
    ('509aadbc-4521-4f3a-87e3-cefbea414581'::uuid, 'Neighborhood Connector Site'),
    ('3b9ae654-96b8-4430-90d6-d1e50c6d19cf'::uuid, 'Neighborhood API'),
    ('062b3b52-a60f-4be7-acb9-6fea4c7e99cf'::uuid, 'Neighborhood History (and Future) Walking App')
) as t(tool_id, tool_name)
cross join (
  select id from public.profiles where lower(email) = 'joshuanesbit@gmail.com'
) as p
on conflict (tool_id, user_id) do nothing;
