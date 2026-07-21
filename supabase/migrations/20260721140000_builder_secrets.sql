-- Builder-level secrets: management credentials a builder connects once and
-- uses across projects (first: a Supabase personal access token, so the
-- Builder can apply migrations and deploy functions to THEIR projects).
--
-- Keyed by builder email, not app — a PAT spans every project the builder
-- owns. Same trust model as app_secrets: RLS on, no policies, service-role
-- only, values write-only from the client.

create table if not exists public.builder_secrets (
  builder_email text not null,
  service text not null,
  secret text not null,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz,
  primary key (builder_email, service)
);

alter table public.builder_secrets enable row level security;

drop trigger if exists on_builder_secret_updated on public.builder_secrets;
create trigger on_builder_secret_updated
  before update on public.builder_secrets
  for each row execute function public.touch_app_document();
