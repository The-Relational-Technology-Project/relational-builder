-- The demo wall, for teams.
--
-- A build-a-thon project is a team's: four people on four accounts, one
-- shared project. The wall keyed each entry by (owner, project name), so
-- when two teammates both clicked Share Live the room saw two cards, each
-- credited to one person, each removable only by its pinner. Now an entry
-- remembers the project it came from: re-pinning by anyone on the team
-- replaces the team's card, and anyone on the team can take it down.
--
-- project_id is nullable: decks from a device-local (never saved) project
-- keep the old per-person key.

alter table public.event_showcase
  add column if not exists project_id uuid references public.projects (id) on delete set null;

create index if not exists event_showcase_project_idx on public.event_showcase (project_id);

-- One card per project per event, whoever pinned it. Delete-then-insert
-- from two devices at once can't double up.
create unique index if not exists event_showcase_project_key
  on public.event_showcase (event_code, project_id)
  where project_id is not null;

grant select (project_id) on public.event_showcase to anon, authenticated;
grant insert (project_id) on public.event_showcase to authenticated;

-- Insert still demands owner_id = auth.uid() and event participation; on
-- top of that the project named must be one the pinner can read (their own
-- or one they're a member of), so nobody pins someone else's project.
drop policy if exists "showcase: participants pin their own" on public.event_showcase;
create policy "showcase: participants pin their own"
  on public.event_showcase for insert
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and upper(coalesce(p.event_code, '')) = upper(event_showcase.event_code)
    )
    and (
      project_id is null
      or exists (
        select 1 from public.projects pr
        where pr.id = event_showcase.project_id
          and (pr.owner_id = auth.uid() or public.is_project_member(pr.id))
      )
    )
  );

-- The whole team can take the team's card down
drop policy if exists "showcase: own rows removable" on public.event_showcase;
create policy "showcase: own rows removable"
  on public.event_showcase for delete
  using (
    owner_id = auth.uid()
    or (
      project_id is not null
      and exists (
        select 1 from public.projects pr
        where pr.id = event_showcase.project_id
          and (pr.owner_id = auth.uid() or public.is_project_member(pr.id))
      )
    )
  );

-- The presentation RPC hands project_id out too (the shelf uses it to
-- decide who gets a remove button). Return shape changes → replace.
drop function if exists public.event_showcase_for(text);

create or replace function public.event_showcase_for(p_code text)
returns table (
  id uuid,
  event_name text,
  owner_id uuid,
  project_id uuid,
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
  select s.id, s.event_name, s.owner_id, s.project_id, s.builder_name, s.project_name,
         s.one_liner, s.screenshot_url, s.deck_url, s.demo_url,
         s.contact_label, s.contact_value, s.created_at
  from public.event_showcase s
  where upper(s.event_code) = upper(trim(coalesce(p_code, '')))
  order by s.created_at asc;
$$;

revoke all on function public.event_showcase_for(text) from public;
grant execute on function public.event_showcase_for(text) to anon, authenticated;
