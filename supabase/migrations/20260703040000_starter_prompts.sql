-- Prompt-level remixing for Studio starters. Instead of pulling a Studio
-- tool's full framework code (which the in-browser preview can't run and
-- which clones one place's implementation), we distill a place-adaptable
-- build prompt from the tool and start fresh from it — truer to the
-- prompt-as-seed model. This is a shared, self-warming cache: the first
-- builder to pick a starter distills it, everyone after gets it instantly.

create table if not exists public.starter_prompts (
  tool_key text primary key,      -- the tool's github_url (stable id)
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.starter_prompts enable row level security;

-- Public seeds: anyone (incl. signed-out) may read the cache
drop policy if exists "starter prompts public read" on public.starter_prompts;
create policy "starter prompts public read" on public.starter_prompts
  for select using (true);

-- Only signed-in (invited) builders may warm the cache; the primary key +
-- ignoreDuplicates means first write wins and later ones no-op, so a cached
-- starter can't be overwritten/poisoned.
drop policy if exists "starter prompts warm" on public.starter_prompts;
create policy "starter prompts warm" on public.starter_prompts
  for insert with check (auth.uid() is not null);
