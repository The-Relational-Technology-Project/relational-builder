-- Neighbor feedback for Community Hosting sites.
-- Every hosted site gets a built-in "leave a note" widget (injected by the
-- `site` edge function) so neighbors can respond without accounts or
-- analytics. Notes flow back to the builder's dashboard — the return
-- channel for building *with* neighbors, not just for them.

create table if not exists public.site_feedback (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.community_sites (id) on delete cascade,
  name text,
  message text not null,
  created_at timestamptz not null default now()
);

create index if not exists site_feedback_site_idx
  on public.site_feedback (site_id, created_at desc);

-- RLS on, no client policies: writes via the `site` function (service role),
-- reads via `publish-site` (service role, owner-gated).
alter table public.site_feedback enable row level security;
