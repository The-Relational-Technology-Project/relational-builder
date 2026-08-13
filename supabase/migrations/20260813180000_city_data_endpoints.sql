-- Live civic data MCP endpoints, one row per city (currently provided by
-- the Responsive Cities Network). Rows are provisioned by stewards via the
-- Management API — deliberately never seeded from this repo — and read by
-- signed-in builders so live city data can ride into plans, chat, and
-- generated apps (src/knowledge/civic-data.ts).
create table if not exists public.city_data_endpoints (
  slug text primary key,
  city text not null,
  kind text not null default 'arcgis',
  mcp_url text not null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.city_data_endpoints enable row level security;

drop policy if exists "Signed-in builders read active endpoints" on public.city_data_endpoints;
create policy "Signed-in builders read active endpoints"
  on public.city_data_endpoints for select
  to authenticated
  using (active);
