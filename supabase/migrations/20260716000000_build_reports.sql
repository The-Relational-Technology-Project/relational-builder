-- Opt-in build reports: when a builder finishes a project's first build and
-- says yes, the build's story — chat log, error/continuation timeline, a
-- summary of what was created, and optional feedback — lands here as the
-- durable record, with an email copy to the stewards. Nothing is written
-- without that explicit yes; the consent timestamp rides with the row.

create table if not exists public.build_reports (
  id uuid primary key default gen_random_uuid(),
  -- Cloud project id when there is one; local-only projects report null
  project_id uuid,
  project_name text,
  -- One-paragraph AI-written description of what was built (best-effort)
  summary text,
  -- The conversation as shown in the builder's own review step:
  -- [{ role, content, label?, at, attachmentCount? }]
  chat jsonb not null default '[]'::jsonb,
  -- Structured build timeline: [{ at, type, detail? }] — build_start,
  -- reply_cut_off, auto_continuation, preview_error, auto_error_fix,
  -- quality_review_fix, build_ready, …
  events jsonb not null default '[]'::jsonb,
  -- Lightweight shape of the result: [{ path, chars }]
  files jsonb not null default '[]'::jsonb,
  -- Optional answers to the three experience questions
  feedback jsonb,
  provider text,
  model text,
  -- Only present when the builder said "okay to follow up" and typed one
  follow_up_email text,
  consent_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- Service-role only (the build-report edge function). Builders may not be
-- signed in at all, and reports are read by stewards out-of-band — so there
-- are no client policies: RLS on with none defined denies everything.
alter table public.build_reports enable row level security;
