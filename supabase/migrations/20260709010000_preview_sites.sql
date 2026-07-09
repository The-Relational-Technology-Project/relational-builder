-- Preview links come home. Shareable previews used to ride on CodeSandbox's
-- anonymous define API, whose {id}.csb.app links stopped serving apps.
-- Previews now live on the same community hosting as published sites —
-- unlisted, outside the per-builder site cap, and expiring on their own.

alter table public.community_sites
  add column if not exists kind text not null default 'site',
  add column if not exists expires_at timestamptz;

alter table public.community_sites
  drop constraint if exists community_sites_kind_check;
alter table public.community_sites
  add constraint community_sites_kind_check check (kind in ('site', 'preview'));

create index if not exists community_sites_kind_idx
  on public.community_sites (kind, owner_email);
