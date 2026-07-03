-- Prompts as first-class citizens. The prompt is the artifact that spreads:
-- more portable than code, it re-roots in a new place with the latest
-- models and local aesthetics. Every project can carry a "prompt to build
-- this"; sharing one gives anyone a seed to grow their own version.

create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null default 'Untitled prompt',
  body text not null,
  is_shared boolean not null default false,
  share_slug text unique,
  -- Where this prompt grew: studio, project name, model, source prompt
  lineage jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists prompts_owner_idx
  on public.prompts (owner_id, updated_at desc);
create index if not exists prompts_project_idx
  on public.prompts (project_id);

alter table public.prompts enable row level security;

-- Owners manage their own prompts
drop policy if exists "prompts owner select" on public.prompts;
create policy "prompts owner select" on public.prompts
  for select using (auth.uid() = owner_id);

drop policy if exists "prompts owner insert" on public.prompts;
create policy "prompts owner insert" on public.prompts
  for insert with check (auth.uid() = owner_id);

drop policy if exists "prompts owner update" on public.prompts;
create policy "prompts owner update" on public.prompts
  for update using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

drop policy if exists "prompts owner delete" on public.prompts;
create policy "prompts owner delete" on public.prompts
  for delete using (auth.uid() = owner_id);

-- Shared prompts are readable by anyone (including signed-out remixers)
drop policy if exists "prompts shared read" on public.prompts;
create policy "prompts shared read" on public.prompts
  for select using (is_shared = true);

drop trigger if exists on_prompt_updated on public.prompts;
create trigger on_prompt_updated
  before update on public.prompts
  for each row execute function public.touch_updated_at();
