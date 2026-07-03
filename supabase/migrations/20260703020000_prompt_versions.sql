-- Git-for-prompts, part two: history and credit.
-- Every save of a prompt keeps a version snapshot (the trail of how a seed
-- evolved), and shared prompts carry their author's chosen display name —
-- sharing to the network is consent to be credited, same as the commons.

alter table public.prompts
  add column if not exists author_name text;

create table if not exists public.prompt_versions (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references public.prompts (id) on delete cascade,
  owner_id uuid not null references auth.users (id) on delete cascade,
  version int not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique (prompt_id, version)
);

create index if not exists prompt_versions_prompt_idx
  on public.prompt_versions (prompt_id, version desc);

alter table public.prompt_versions enable row level security;

drop policy if exists "prompt versions owner select" on public.prompt_versions;
create policy "prompt versions owner select" on public.prompt_versions
  for select using (auth.uid() = owner_id);

drop policy if exists "prompt versions owner insert" on public.prompt_versions;
create policy "prompt versions owner insert" on public.prompt_versions
  for insert with check (auth.uid() = owner_id);

drop policy if exists "prompt versions owner delete" on public.prompt_versions;
create policy "prompt versions owner delete" on public.prompt_versions
  for delete using (auth.uid() = owner_id);
