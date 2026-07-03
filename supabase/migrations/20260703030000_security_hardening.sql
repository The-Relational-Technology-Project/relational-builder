-- Pre-pilot security hardening (2026-07-03).

-- 1) Neighbor sign-in codes: cap wrong guesses per code so a 6-digit code
--    can't be brute-forced. The app-data edge function increments this on
--    each wrong guess and burns the code past MAX_VERIFY_ATTEMPTS.
alter table public.app_login_codes
  add column if not exists attempts int not null default 0;

-- 2) Shared prompts: the "shared read" RLS policy makes is_shared rows
--    readable by the anon key (intended, for remixing) — but RLS gates
--    rows, not columns, so owner_id (a stable auth.users UUID) was exposed.
--    Column-level privileges keep owner_id server-side while leaving the
--    remixable fields public. authenticated owners never need owner_id
--    client-side either (their own policies evaluate it server-side).
revoke select on public.prompts from anon;
revoke select on public.prompts from authenticated;
grant select (id, project_id, title, body, is_shared, share_slug, author_name, lineage, created_at, updated_at)
  on public.prompts to anon;
grant select (id, project_id, title, body, is_shared, share_slug, author_name, lineage, created_at, updated_at)
  on public.prompts to authenticated;

-- 3) profiles UPDATE: add the missing WITH CHECK so a row's id can't be
--    repointed during an update (defense-in-depth; the client never writes id).
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
