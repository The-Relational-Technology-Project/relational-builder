-- Instrumenting the silent failures.
--
-- Leslie's report: "I typed a new request and tried to submit it, but nothing
-- happened... I ended up trying three times before it went through." That is a
-- measurable event, and it was invisible — the builder who writes an email is
-- the rare one, so the only honest way to know how common it is, is to count
-- it.
--
-- Deliberately narrow. This is not analytics: no page views, no funnels, no
-- content. Each row is one moment where a person acted and the app did not
-- visibly respond. The `kind` set is small and each entry has a fix that would
-- take it to zero — which is the point. If a kind can't be driven to zero by
-- fixing something, it doesn't belong here.

create table if not exists public.friction_events (
  id          bigserial primary key,
  email       text        not null,
  kind        text        not null,
  -- Coarse context only (e.g. how many seconds the person waited before
  -- re-submitting). Never message text — what someone types while confused is
  -- theirs, and we do not need it to count the confusion.
  detail      jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists friction_events_day_kind_idx
  on public.friction_events (created_at desc, kind);

alter table public.friction_events enable row level security;

-- A signed-in builder may record their own friction and read their own back.
-- Nobody reads anyone else's through this path; aggregates are the service
-- role's job (the community monitor).
drop policy if exists friction_events_insert_own on public.friction_events;
create policy friction_events_insert_own
  on public.friction_events for insert to authenticated
  with check (email = auth.jwt() ->> 'email');

drop policy if exists friction_events_select_own on public.friction_events;
create policy friction_events_select_own
  on public.friction_events for select to authenticated
  using (email = auth.jwt() ->> 'email');

comment on table public.friction_events is
  'Moments where a builder acted and the app did not visibly respond. Each kind should be drivable to zero; see src/report/friction.ts.';
