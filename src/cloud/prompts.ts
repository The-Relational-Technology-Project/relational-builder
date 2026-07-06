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
  author_name: string | null;
  lineage: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface PromptVersion {
  id: string;
  version: number;
  title: string;
  body: string;
  created_at: string;
}

/** A prompt in the network library — someone else's shared seed */
export interface NetworkPrompt {
  title: string;
  body: string;
  share_slug: string;
  author_name: string | null;
  updated_at: string;
}

function client() {
  if (!builderClient) throw new Error('Prompts need the cloud backend configured');
  return builderClient;
}

export async function listMyPrompts(): Promise<BuildPrompt[]> {
  const { data, error } = await client()
    .from('prompts')
    .select('id, project_id, title, body, is_shared, share_slug, author_name, lineage, created_at, updated_at')
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as BuildPrompt[];
}

export async function getPromptForProject(projectId: string): Promise<BuildPrompt | null> {
  const { data } = await client()
    .from('prompts')
    .select('id, project_id, title, body, is_shared, share_slug, author_name, lineage, created_at, updated_at')
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

  let saved: BuildPrompt;
  if (input.id) {
    const { data, error } = await c
      .from('prompts')
      .update({ title: input.title, body: input.body, lineage: input.lineage ?? undefined })
      .eq('id', input.id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    saved = data as BuildPrompt;
  } else {
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
    saved = data as BuildPrompt;
  }

  // Every save keeps a version snapshot — the trail of how the seed evolved
  try {
    const { count } = await c
      .from('prompt_versions')
      .select('id', { count: 'exact', head: true })
      .eq('prompt_id', saved.id);
    await c.from('prompt_versions').insert({
      prompt_id: saved.id,
      owner_id,
      version: (count ?? 0) + 1,
      title: saved.title,
      body: saved.body,
    });
  } catch {
    // History is best-effort; the save itself already succeeded
  }

  return saved;
}

export async function listPromptVersions(promptId: string): Promise<PromptVersion[]> {
  const { data, error } = await client()
    .from('prompt_versions')
    .select('id, version, title, body, created_at')
    .eq('prompt_id', promptId)
    .order('version', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PromptVersion[];
}

/**
 * The network prompt library: every prompt builders have chosen to share,
 * readable by anyone — the commons, v1.
 */
export async function listNetworkPrompts(limit = 12): Promise<NetworkPrompt[]> {
  if (!builderClient) return [];
  // owner_id is deliberately NOT selected — it's revoked from the anon key
  // (a stable user UUID shouldn't reach anonymous clients). Exclude your
  // own via the slugs from listMyPrompts, not by owner id.
  const { data } = await builderClient
    .from('prompts')
    .select('title, body, share_slug, author_name, updated_at')
    .eq('is_shared', true)
    .not('share_slug', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return ((data ?? []) as NetworkPrompt[]).filter(p => p.share_slug);
}

/**
 * Share: mint a slug once, flip the flag, stamp the author's display name
 * (sharing to the network is consent to be credited), return the remix link.
 */
export async function sharePrompt(prompt: BuildPrompt): Promise<{ slug: string; url: string }> {
  const slug =
    prompt.share_slug ??
    crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  const { useAuthStore } = await import('@/store/auth-store');
  const authorName = useAuthStore.getState().profile?.display_name?.trim() || null;
  const { error } = await client()
    .from('prompts')
    .update({ is_shared: true, share_slug: slug, author_name: authorName })
    .eq('id', prompt.id);
  if (error) throw new Error(error.message);
  const url = promptShareUrl(slug);
  // A share is studio life — let the builder's studios see it (best-effort)
  if (!prompt.share_slug) {
    void (async () => {
      const [{ useStudioStore }, { recordStudioActivity }] = await Promise.all([
        import('@/store/studio-store'),
        import('@/cloud/studios'),
      ]);
      const studio = useStudioStore.getState().activeStudio;
      if (studio) void recordStudioActivity('share', studio.slug, prompt.title, url);
    })();
  }
  return { slug, url };
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
  // Tidy the URL either way so refreshes don't re-trigger
  const url = new URL(window.location.href);
  url.searchParams.delete('prompt');
  window.history.replaceState({}, '', url.toString());
  await plantSharedPrompt(slug);
}

/**
 * Plant a shared prompt: fresh project, prompt in the composer, grown-from
 * lineage recorded. Used by the deep link, the network library, and the
 * builders directory.
 */
export async function plantSharedPrompt(slug: string): Promise<boolean> {
  const prompt = await fetchSharedPrompt(slug);
  if (!prompt) return false;

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
  return true;
}

/** Anyone (signed in or not) can fetch a shared prompt by its slug */
export async function fetchSharedPrompt(slug: string): Promise<BuildPrompt | null> {
  if (!builderClient) return null;
  const clean = slug.trim();
  if (!clean) return null;
  const { data } = await builderClient
    .from('prompts')
    .select('id, project_id, title, body, is_shared, share_slug, author_name, lineage, created_at, updated_at')
    .eq('share_slug', clean)
    .eq('is_shared', true)
    .maybeSingle();
  return (data as BuildPrompt | null) ?? null;
}
