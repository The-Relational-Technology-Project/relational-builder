-- Custom addresses for community-hosted sites.
--
-- A neighborhood tool deserves a neighborhood address: a builder points a
-- domain they own (bought anywhere, or one they already had) at their site,
-- and it serves there with everything community hosting adds: neighbor
-- notes, the error beacon, versions, view counts.
--
-- The community owns the domain and its DNS. We only remember which site a
-- hostname answers for. The `site-domains` function manages rows (and the
-- matching entry on the hosting front); the `site` function reads them to
-- resolve a hostname to a site. See docs/CUSTOM-DOMAINS.md.
--
-- One row per site: `domain` is the address people use; `also` is its
-- www/bare twin, which redirects to it (null for other subdomains).

create table if not exists public.site_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null unique references public.community_sites (id) on delete cascade,
  domain text not null unique,
  also text unique,
  -- pending: waiting on the builder's DNS · live: serving
  status text not null default 'pending' check (status in ('pending', 'live')),
  created_at timestamptz not null default now(),
  verified_at timestamptz
);

-- Service role only (the two functions); no policies on purpose
alter table public.site_domains enable row level security;
