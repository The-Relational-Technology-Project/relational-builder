-- Community Cloud backups: neighbors' data can survive a mistake.
--
-- A lending library or RSVP board holds real people's records; until now a
-- stray delete (or a bad restore of the app's code) was unrecoverable. A
-- daily pg_cron job snapshots each backend's documents + members into a
-- backup row — but only when something actually changed since the last
-- snapshot, so quiet apps cost one row total, not one per day.
--
-- Retention: the newest 14 snapshots per app. Oversized payloads (>20MB)
-- record a marker row instead of data, so the Cloud tab can say "use
-- Download data" rather than silently skipping.
--
-- Access: RLS on, no policies — service role (app-data edge function) only,
-- like every other Community Cloud table.

create table if not exists public.app_backend_backups (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  taken_at timestamptz not null default now(),
  /** 'daily' from cron, 'pre_restore' safety snapshots taken before a restore */
  reason text not null default 'daily',
  doc_count integer not null default 0,
  member_count integer not null default 0,
  latest_activity timestamptz,
  bytes integer not null default 0,
  payload jsonb,
  skipped_reason text
);

create index if not exists app_backend_backups_lookup_idx
  on public.app_backend_backups (app_id, taken_at desc);

alter table public.app_backend_backups enable row level security;

-- Snapshot one app's data. Used by the daily sweep AND as the pre-restore
-- safety net. Returns the new backup id (or null when there was nothing to
-- snapshot).
create or replace function public.take_app_backend_backup(p_app_id uuid, p_reason text default 'daily')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  d_count integer;
  m_count integer;
  latest timestamptz;
  pay jsonb;
  sz integer;
  new_id uuid;
begin
  select count(*), max(updated_at) into d_count, latest
    from public.app_documents where app_id = p_app_id;
  select count(*) into m_count from public.app_members where app_id = p_app_id;
  if d_count = 0 and m_count = 0 then
    return null;
  end if;

  pay := jsonb_build_object(
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'collection', collection, 'data', data,
        'member_id', member_id, 'member_name', member_name,
        'visibility', visibility, 'created_at', created_at, 'updated_at', updated_at
      ) order by created_at)
      from public.app_documents where app_id = p_app_id
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'name', name, 'created_at', created_at
      ) order by created_at)
      from public.app_members where app_id = p_app_id
    ), '[]'::jsonb)
  );
  sz := octet_length(pay::text);

  if sz > 20 * 1024 * 1024 then
    insert into public.app_backend_backups
      (app_id, reason, doc_count, member_count, latest_activity, bytes, payload, skipped_reason)
    values (p_app_id, p_reason, d_count, m_count, latest, sz, null, 'too_large')
    returning id into new_id;
  else
    insert into public.app_backend_backups
      (app_id, reason, doc_count, member_count, latest_activity, bytes, payload)
    values (p_app_id, p_reason, d_count, m_count, latest, sz, pay)
    returning id into new_id;
  end if;

  -- Retention: newest 14 per app
  delete from public.app_backend_backups
   where app_id = p_app_id
     and id not in (
       select id from public.app_backend_backups
        where app_id = p_app_id
        order by taken_at desc
        limit 14
     );

  return new_id;
end;
$$;

-- The daily sweep: snapshot every backend whose data changed since its last
-- snapshot. Change = doc count, member count, or latest updated_at moved.
create or replace function public.take_app_backend_backups()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  a record;
  d_count integer;
  m_count integer;
  latest timestamptz;
  last_backup record;
  taken integer := 0;
begin
  for a in select id from public.cloud_apps loop
    select count(*), max(updated_at) into d_count, latest
      from public.app_documents where app_id = a.id;
    select count(*) into m_count from public.app_members where app_id = a.id;
    if d_count = 0 and m_count = 0 then
      continue;
    end if;

    select doc_count, member_count, latest_activity into last_backup
      from public.app_backend_backups
     where app_id = a.id
     order by taken_at desc
     limit 1;

    if found
       and last_backup.doc_count = d_count
       and last_backup.member_count = m_count
       and last_backup.latest_activity is not distinct from latest then
      continue;
    end if;

    perform public.take_app_backend_backup(a.id, 'daily');
    taken := taken + 1;
  end loop;
  return taken;
end;
$$;

-- Restore documents (and missing members) from a backup, atomically.
-- Semantics chosen for safety with live neighbors:
--   * members are UPSERTED by id (current members and their sessions are
--     never deleted — a restore must not sign anyone out);
--   * documents are REPLACED wholesale with the backup's set;
--   * a 'pre_restore' snapshot is taken first, so a restore is itself
--     undoable.
create or replace function public.restore_app_backend_backup(p_app_id uuid, p_backup_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  restored_docs integer := 0;
  restored_members integer := 0;
begin
  select * into b from public.app_backend_backups
   where id = p_backup_id and app_id = p_app_id;
  if not found then
    return jsonb_build_object('error', 'Backup not found');
  end if;
  if b.payload is null then
    return jsonb_build_object('error', 'This backup has no data (it was too large to store)');
  end if;

  perform public.take_app_backend_backup(p_app_id, 'pre_restore');

  insert into public.app_members (id, app_id, email, name, created_at)
  select (m->>'id')::uuid, p_app_id, m->>'email', m->>'name',
         coalesce((m->>'created_at')::timestamptz, now())
    from jsonb_array_elements(b.payload->'members') m
  -- No target: absorbs both PK collisions (member still exists) and the
  -- unique (app_id, lower(email)) index (same neighbor, new account row)
  on conflict do nothing;
  get diagnostics restored_members = row_count;

  delete from public.app_documents where app_id = p_app_id;

  insert into public.app_documents
    (id, app_id, collection, data, member_id, member_name, visibility, created_at, updated_at)
  select
    (d->>'id')::uuid,
    p_app_id,
    d->>'collection',
    coalesce(d->'data', '{}'::jsonb),
    -- Only point at members that exist after the upsert above
    case when exists (select 1 from public.app_members am where am.id = (d->>'member_id')::uuid)
         then (d->>'member_id')::uuid end,
    d->>'member_name',
    coalesce(d->>'visibility', 'public'),
    coalesce((d->>'created_at')::timestamptz, now()),
    coalesce((d->>'updated_at')::timestamptz, now())
    from jsonb_array_elements(b.payload->'documents') d;
  get diagnostics restored_docs = row_count;

  return jsonb_build_object('ok', true, 'documents', restored_docs, 'members_added', restored_members);
end;
$$;

-- Daily at 08:40 UTC — before most US community activity, after Europe's
-- morning. cron.schedule upserts by job name, so re-applying is safe.
select cron.schedule(
  'app-backend-backups',
  '40 8 * * *',
  $$select public.take_app_backend_backups()$$
);
