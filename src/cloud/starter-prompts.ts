import { builderClient } from '@/cloud/builder-client';

/**
 * The shared, self-warming cache of Studio-starter build prompts. The first
 * builder to pick a starter distills it (see distillStarterPrompt) and warms
 * the cache; everyone after reads it instantly. Public-read, signed-in-write,
 * first-write-wins (primary key + ignoreDuplicates) so a starter can't be
 * overwritten.
 */

export interface StarterPrompt {
  tool_key: string;
  title: string;
  body: string;
}

export async function getCachedStarter(toolKey: string): Promise<StarterPrompt | null> {
  if (!builderClient) return null;
  const { data } = await builderClient
    .from('starter_prompts')
    .select('tool_key, title, body')
    .eq('tool_key', toolKey)
    .maybeSingle();
  return (data as StarterPrompt | null) ?? null;
}

export async function cacheStarter(prompt: StarterPrompt): Promise<void> {
  if (!builderClient) return;
  // First write wins; later ones no-op. Best-effort — a failed cache write
  // must never block the builder from starting.
  await builderClient
    .from('starter_prompts')
    .upsert(prompt, { onConflict: 'tool_key', ignoreDuplicates: true });
}
