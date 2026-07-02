-- Community Cloud: zero-setup shared data for built apps.
-- Apps built in Relational Builder get a scoped document store without the
-- builder creating their own backend. All access flows through the app-data
-- edge function with the service role — no client policies at all.
--
-- Data model is public-by-design: anything an app stores here is readable
-- by anyone who has the app (the keys ship in the page). Right for community
-- boards, calendars, signups — never for secrets or private data.

create table if not exists public.cloud_apps (
  id uuid primary key default gen_random_uuid(),
  app_key text not null,
  name text not null default 'Untitled app',
  owner_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.app_documents (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references public.cloud_apps (id) on delete cascade,
  collection text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_documents_lookup_idx
  on public.app_documents (app_id, collection, created_at desc);

-- RLS on, no policies: only the service role (edge function) touches these.
alter table public.cloud_apps enable row level security;
alter table public.app_documents enable row level security;

create or replace function public.touch_app_document()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_app_document_updated on public.app_documents;
create trigger on_app_document_updated
  before update on public.app_documents
  for each row execute function public.touch_app_document();
