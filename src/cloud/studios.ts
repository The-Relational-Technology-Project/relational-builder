import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';

/**
 * Studio membership + activity — the Builder-side half of studios being
 * first-class. Studio configs (principles, branding) live in the KB project;
 * who belongs to a studio and what's been happening there live here, in the
 * Builder backend, next to the rest of a builder's account.
 */

export interface StudioMembership {
  studio_slug: string;
  studio_label: string;
  joined_at: string;
}

export interface StudioActivityEntry {
  id: string;
  studio_slug: string;
  actor_name: string | null;
  kind: 'join' | 'share' | 'publish';
  title: string | null;
  url: string | null;
  created_at: string;
}

function displayName(): string | null {
  return useAuthStore.getState().profile?.display_name?.trim() || null;
}

export async function listMyStudioMemberships(): Promise<StudioMembership[]> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return [];
  const { data } = await builderClient
    .from('studio_memberships')
    .select('studio_slug, studio_label, joined_at')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });
  return (data ?? []) as StudioMembership[];
}

export async function joinStudio(slug: string, label: string): Promise<boolean> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return false;
  const { error } = await builderClient.from('studio_memberships').upsert(
    {
      user_id: user.id,
      studio_slug: slug,
      studio_label: label,
      display_name: displayName(),
    },
    { onConflict: 'user_id,studio_slug', ignoreDuplicates: true },
  );
  if (error) return false;
  // The join itself is the first bit of studio life others see
  void recordStudioActivity('join', slug);
  return true;
}

export async function leaveStudio(slug: string): Promise<void> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return;
  await builderClient
    .from('studio_memberships')
    .delete()
    .eq('user_id', user.id)
    .eq('studio_slug', slug);
}

/**
 * Append to a studio's stream. Fire-and-forget by design: activity must
 * never block or break the action it describes (sharing, publishing).
 */
export async function recordStudioActivity(
  kind: StudioActivityEntry['kind'],
  studioSlug: string,
  title?: string,
  url?: string,
): Promise<void> {
  try {
    const user = useAuthStore.getState().user;
    if (!builderClient || !user) return;
    await builderClient.from('studio_activity').insert({
      studio_slug: studioSlug,
      actor_id: user.id,
      actor_name: displayName(),
      kind,
      title: title ?? null,
      url: url ?? null,
    });
  } catch {
    // never let the pulse take down the heartbeat
  }
}

/** Recent activity across the studios a builder belongs to, newest first */
export async function fetchStudioActivity(
  slugs: string[],
  limit = 8,
): Promise<StudioActivityEntry[]> {
  if (!builderClient || slugs.length === 0) return [];
  const { data } = await builderClient
    .from('studio_activity')
    .select('id, studio_slug, actor_name, kind, title, url, created_at')
    .in('studio_slug', slugs)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as StudioActivityEntry[];
}
