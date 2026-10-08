-- Studio Admin cohort view (Oct 8 2026, for the BLOOM studio demo).
--
-- A Studio Admin running a cohort of civic hosts wants one table: who is in
-- the studio, where they are, what they built inside the studio frame, which
-- shelf item it grew from, where it is published, and what they have offered
-- back that is still waiting. Projects and profiles are RLS-locked to their
-- owners, so the join can only exist behind a definer function, admin-only,
-- same pattern as studio_roster.
--
-- One row per (member, project). A member with no studio-framed project
-- still gets one row with null project fields, so the roster is complete.
-- A project counts as the studio's when its lineage names the studio or
-- grew from one of the studio's shelf items. The published link is matched
-- by owner email + site name, since community_sites carries no project id.

create or replace function public.studio_cohort(p_slug text)
returns table (
  user_id uuid,
  display_name text,
  email text,
  place text,
  role text,
  status text,
  joined_at timestamptz,
  project_id uuid,
  project_name text,
  project_updated_at timestamptz,
  grew_from_item_id uuid,
  grew_from_title text,
  published_slug text,
  pending_offers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with members as (
    select
      m.user_id,
      coalesce(
        nullif(trim(p.display_name), ''),
        nullif(trim(p.full_name), ''),
        nullif(trim(m.display_name), '')
      ) as display_name,
      p.email,
      nullif(trim(p.neighborhood), '') as place,
      m.role::text as role,
      m.status::text as status,
      m.joined_at
    from public.studio_memberships m
    left join public.profiles p on p.id = m.user_id
    where public.is_studio_admin(p_slug)
      and m.studio_slug = p_slug
  ),
  studio_projects as (
    select
      pr.id,
      pr.owner_id,
      pr.name,
      pr.updated_at,
      nullif(pr.lineage ->> 'studioItemId', '')::uuid as grew_from_item_id
    from public.projects pr
    where pr.owner_id in (select user_id from members)
      and coalesce(pr.lineage ->> 'source', '') <> 'builder-profile'
      and (
        pr.lineage ->> 'studioSlug' = p_slug
        or exists (
          select 1 from public.studio_library_items li
          where li.studio_slug = p_slug
            and li.id::text = pr.lineage ->> 'studioItemId'
        )
      )
  )
  select
    mem.user_id,
    mem.display_name,
    mem.email,
    mem.place,
    mem.role,
    mem.status,
    mem.joined_at,
    sp.id as project_id,
    sp.name as project_name,
    sp.updated_at as project_updated_at,
    sp.grew_from_item_id,
    li.title as grew_from_title,
    (
      select cs.slug from public.community_sites cs
      where lower(cs.owner_email) = lower(mem.email)
        and cs.kind = 'site'
        and lower(cs.name) = lower(sp.name)
      order by cs.updated_at desc
      limit 1
    ) as published_slug,
    (
      select count(*) from public.studio_library_items o
      where o.studio_slug = p_slug
        and o.created_by = mem.user_id
        and o.status = 'pending'
    ) as pending_offers
  from members mem
  left join studio_projects sp on sp.owner_id = mem.user_id
  left join public.studio_library_items li on li.id = sp.grew_from_item_id
  order by mem.joined_at desc, sp.updated_at desc nulls last;
$$;

revoke all on function public.studio_cohort(text) from public;
grant execute on function public.studio_cohort(text) to authenticated;
