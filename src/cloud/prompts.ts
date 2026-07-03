import { builderClient } from '@/cloud/builder-client';

/**
 * Prompts are first-class citizens — the artifact that actually spreads.
 * A build prompt is a self-contained prompt that recreates an app; shared
 * ones travel by link and re-root in a new place with new models and
 * local aesthetics. Think of this as the seed library.
 */

export interface BuildPrompt {
  id: string;
  project_id: string | null;
  title: string;
  body: string;
  is_shared: boolean;
  share_slug: string | null;
  lineage: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function client() {
  if (!builderClient) throw new Error('Prompts need the cloud backend configured');
  return builderClient;
}

export async function listMyPrompts(): Promise<BuildPrompt[]> {
  const { data, error } = await client()
    .from('prompts')
    .select('id, project_id, title, body, is_shared, share_slug, lineage, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BuildPrompt[];
}

export async function getPromptForProject(projectId: string): Promise<BuildPrompt | null> {
  const { data } = await client()
    .from('prompts')
    .select('id, project_id, title, body, is_shared, share_slug, lineage, created_at, updated_at')
    .eq('project_id', projectId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as BuildPrompt | null) ?? null;
}

export async function savePrompt(input: {
  id?: string;
  project_id?: string | null;
  title: string;
  body: string;
  lineage?: Record<string, unknown> | null;
}): Promise<BuildPrompt> {
  const c = client();
  const { data: session } = await c.auth.getUser();
  const owner_id = session.user?.id;
  if (!owner_id) throw new Error('Sign in to save prompts');

  if (input.id) {
    const { data, error } = await c
      .from('prompts')
      .update({ title: input.title, body: input.body, lineage: input.lineage ?? undefined })
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as BuildPrompt;
  }
  const { data, error } = await c
    .from('prompts')
    .insert({
      owner_id,
      project_id: input.project_id ?? null,
      title: input.title,
      body: input.body,
      lineage: input.lineage ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as BuildPrompt;
}

/** Share: mint a slug once, flip the flag, return the remix link */
export async function sharePrompt(prompt: BuildPrompt): Promise<{ slug: string; url: string }> {
  const slug =
    prompt.share_slug ??
    crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const { error } = await client()
    .from('prompts')
    .update({ is_shared: true, share_slug: slug })
    .eq('id', prompt.id);
  if (error) throw new Error(error.message);
  return { slug, url: promptShareUrl(slug) };
}

export async function unsharePrompt(id: string): Promise<void> {
  const { error } = await client().from('prompts').update({ is_shared: false }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePrompt(id: string): Promise<void> {
  const { error } = await client().from('prompts').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function promptShareUrl(slug: string): string {
  return `${window.location.origin}/?prompt=${slug}`;
}

/**
 * ?prompt=<slug> deep link: a shared prompt arrives ready to send — the
 * composer is prefilled and the grown-from lineage is recorded, so credit
 * travels with the new version the way it does for remixes and plans.
 */
export async function handlePromptDeepLink(): Promise<void> {
  const slug = new URLSearchParams(window.location.search).get('prompt');
  if (!slug) return;
  const prompt = await fetchSharedPrompt(slug);
  // Tidy the URL either way so refreshes don't re-trigger
  const url = new URL(window.location.href);
  url.searchParams.delete('prompt');
  window.history.replaceState({}, '', url.toString());
  if (!prompt) return;

  // Arriving by prompt link means "grow this" — start a fresh project so
  // whatever was open keeps its own history and lineage
  const { useChatStore } = await import('@/store/chat-store');
  const { useProjectStore } = await import('@/store/project-store');
  const { useCloudStore } = await import('@/store/cloud-store');
  const { useEnvStore } = await import('@/store/env-store');
  useCloudStore.getState().closeProject();
  useChatStore.getState().clearMessages();
  useProjectStore.getState().clearProject();
  useEnvStore.getState().clearAll();

  useChatStore.getState().setDraftMessage(prompt.body);
  useProjectStore.getState().setLineage({
    source: 'prompt',
    promptSlug: slug,
    promptTitle: prompt.title,
    importedAt: new Date().toISOString(),
  });
}

/** Anyone (signed in or not) can fetch a shared prompt by its slug */
export async function fetchSharedPrompt(slug: string): Promise<BuildPrompt | null> {
  if (!builderClient) return null;
  const clean = slug.trim();
  if (!clean) return null;
  const { data } = await builderClient
    .from('prompts')
    .select('id, project_id, title, body, is_shared, share_slug, lineage, created_at, updated_at')
    .eq('share_slug', clean)
    .eq('is_shared', true)
    .maybeSingle();
  return (data as BuildPrompt | null) ?? null;
}
