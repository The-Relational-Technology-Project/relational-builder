-- Site health: published tools report their own runtime errors.
--
-- Until now, once a site was published RB was blind — a broken tool showed
-- up only when a neighbor complained in person. Served sites now carry a
-- tiny error beacon (same injection pattern as the neighbor-note widget)
-- that posts runtime errors back; they land here, deduplicated by
-- signature per day, and surface on the builder's dashboard.
--
-- Privacy: error messages only — no visitor identity, no cookies, nothing
-- about who was using the page when it broke.
--
-- Abuse bounds: signatures are capped per site per day; the serving
-- function additionally rate-limits the endpoint.

create table if not exists public.site_errors (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.community_sites (id) on delete cascade,
  day date not null default current_date,
  signature text not null,
  message text not null,
  count integer not null default 1,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  unique (site_id, day, signature)
);

create index if not exists site_errors_lookup_idx
  on public.site_errors (site_id, day desc);

alter table public.site_errors enable row level security;

-- Record one error occurrence: bump the day's counter for this signature,
-- or open a new row — but never more than 50 distinct signatures per site
-- per day, so a pathological page can't grow the table without bound.
create or replace function public.record_site_error(
  p_site_id uuid,
  p_signature text,
  p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  distinct_today integer;
begin
  update public.site_errors
     set count = count + 1, last_seen = now()
   where site_id = p_site_id and day = current_date and signature = p_signature;
  if found then
    return;
  end if;

  select count(*) into distinct_today
    from public.site_errors
   where site_id = p_site_id and day = current_date;
  if distinct_today >= 50 then
    return;
  end if;

  insert into public.site_errors (site_id, day, signature, message)
  values (p_site_id, current_date, p_signature, left(p_message, 1000))
  on conflict (site_id, day, signature)
  do update set count = public.site_errors.count + 1, last_seen = now();
end;
$$;

-- Housekeeping: errors older than 30 days age out with the daily backup
-- sweep (piggybacks the same cron cadence; separate job for clarity).
create or replace function public.prune_site_errors()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.site_errors where day < current_date - 30;
$$;

select cron.schedule(
  'prune-site-errors',
  '50 8 * * *',
  $$select public.prune_site_errors()$$
);
