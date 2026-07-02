-- Community Cloud admin: stats for the builder-facing Cloud dashboard.
-- SECURITY DEFINER functions callable only by service_role (via the
-- app-data edge function) — clients never touch these tables directly.

create or replace function public.cloud_apps_overview(p_owner_email text)
returns table (
  app_id uuid,
  name text,
  app_key text,
  created_at timestamptz,
  doc_count bigint,
  bytes bigint,
  member_count bigint
)
language sql
security definer
set search_path = public
as $$
  select
    a.id,
    a.name,
    a.app_key,
    a.created_at,
    (select count(*) from app_documents d where d.app_id = a.id),
    coalesce((select sum(pg_column_size(d.data))::bigint from app_documents d where d.app_id = a.id), 0),
    (select count(*) from app_members m where m.app_id = a.id)
  from cloud_apps a
  where lower(a.owner_email) = lower(p_owner_email)
  order by a.created_at asc;
$$;

create or replace function public.cloud_app_collections(p_app_id uuid)
returns table (
  collection text,
  doc_count bigint,
  bytes bigint,
  last_activity timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    d.collection,
    count(*),
    sum(pg_column_size(d.data))::bigint,
    max(greatest(d.created_at, d.updated_at))
  from app_documents d
  where d.app_id = p_app_id
  group by d.collection
  order by max(greatest(d.created_at, d.updated_at)) desc;
$$;

create or replace function public.cloud_app_bytes(p_app_id uuid)
returns bigint
language sql
security definer
set search_path = public
as $$
  select coalesce(sum(pg_column_size(d.data))::bigint, 0)
  from app_documents d
  where d.app_id = p_app_id;
$$;

revoke execute on function public.cloud_apps_overview(text) from public;
revoke execute on function public.cloud_apps_overview(text) from anon;
revoke execute on function public.cloud_apps_overview(text) from authenticated;
revoke execute on function public.cloud_app_collections(uuid) from public;
revoke execute on function public.cloud_app_collections(uuid) from anon;
revoke execute on function public.cloud_app_collections(uuid) from authenticated;
revoke execute on function public.cloud_app_bytes(uuid) from public;
revoke execute on function public.cloud_app_bytes(uuid) from anon;
revoke execute on function public.cloud_app_bytes(uuid) from authenticated;
