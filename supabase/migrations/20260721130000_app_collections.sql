-- Typed collections: optional declarative schemas for Community Cloud data.
--
-- A collection spec declares fields (type, required, unique, maxLength) plus
-- write rules. The app-data function validates create/update against it and
-- powers a typed `query` action. Collections without a spec keep working
-- exactly as before — schemas are opt-in structure, not a gate.
--
-- Same trust model as everything else here: RLS on, no policies; only the
-- service role (edge functions) reads or writes these rows.

create table if not exists public.app_collections (
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  name text not null,
  spec jsonb not null default '{}'::jsonb,
  version int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (app_id, name)
);

alter table public.app_collections enable row level security;

drop trigger if exists on_app_collection_updated on public.app_collections;
create trigger on_app_collection_updated
  before update on public.app_collections
  for each row execute function public.touch_app_document();
