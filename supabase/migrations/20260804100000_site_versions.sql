-- Published sites get a memory: versions + rollback + atomic republish.
--
-- Until now a republish was PATCH + DELETE + bulk INSERT from the edge
-- function — three requests with no transaction, so a failure after the
-- delete left a live site empty, and there was no way back to yesterday's
-- version at all. Now:
--
--   * publish_site_files() replaces a site's files in ONE transaction,
--     snapshotting the outgoing version first;
--   * snapshots keep the newest 5 per site (sites cap at 4MB, so worst
--     case ~20MB per site);
--   * restore_site_version() rolls a live site back to a snapshot — and
--     snapshots the current version first, so a rollback is undoable.
--
-- Access: RLS on, no policies — service role (publish-site function) only.

create table if not exists public.site_versions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.community_sites (id) on delete cascade,
  taken_at timestamptz not null default now(),
  label text,
  file_count integer not null default 0,
  bytes integer not null default 0,
  files jsonb not null
);

create index if not exists site_versions_lookup_idx
  on public.site_versions (site_id, taken_at desc);

alter table public.site_versions enable row level security;

-- Snapshot a site's current files. Returns the version id, or null when the
-- site has no files yet (first publish).
create or replace function public.snapshot_site_version(p_site_id uuid, p_label text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.site_versions (site_id, label, file_count, bytes, files)
  select p_site_id, p_label, count(*),
         coalesce(sum(octet_length(content)), 0)::integer,
         jsonb_agg(jsonb_build_object('path', path, 'content', content, 'content_type', content_type))
    from public.site_files
   where site_id = p_site_id
  having count(*) > 0
  returning id into new_id;

  if new_id is not null then
    delete from public.site_versions
     where site_id = p_site_id
       and id not in (
         select id from public.site_versions
          where site_id = p_site_id
          order by taken_at desc
          limit 5
       );
  end if;

  return new_id;
end;
$$;

-- Replace a site's files atomically. The whole body is one transaction:
-- a failure anywhere rolls everything back, so a live site can never be
-- left half-published or empty.
create or replace function public.publish_site_files(
  p_site_id uuid,
  p_files jsonb,
  p_snapshot boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted integer;
begin
  if p_snapshot then
    perform public.snapshot_site_version(p_site_id, 'before republish');
  end if;

  delete from public.site_files where site_id = p_site_id;

  insert into public.site_files (site_id, path, content, content_type)
  select p_site_id,
         f->>'path',
         f->>'content',
         coalesce(f->>'content_type', 'text/plain; charset=utf-8')
    from jsonb_array_elements(p_files) f;
  get diagnostics inserted = row_count;

  update public.community_sites set updated_at = now() where id = p_site_id;

  return jsonb_build_object('ok', true, 'files', inserted);
end;
$$;

-- Roll a live site back to a snapshot. Snapshots the current version first,
-- so "restore" is never a one-way door.
create or replace function public.restore_site_version(p_site_id uuid, p_version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v record;
  inserted integer;
begin
  select * into v from public.site_versions
   where id = p_version_id and site_id = p_site_id;
  if not found then
    return jsonb_build_object('error', 'Version not found');
  end if;

  perform public.snapshot_site_version(p_site_id, 'before restore');

  delete from public.site_files where site_id = p_site_id;

  insert into public.site_files (site_id, path, content, content_type)
  select p_site_id,
         f->>'path',
         f->>'content',
         coalesce(f->>'content_type', 'text/plain; charset=utf-8')
    from jsonb_array_elements(v.files) f;
  get diagnostics inserted = row_count;

  update public.community_sites set updated_at = now() where id = p_site_id;

  return jsonb_build_object('ok', true, 'files', inserted, 'from', v.taken_at);
end;
$$;
