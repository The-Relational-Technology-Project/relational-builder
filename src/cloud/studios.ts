import { builderClient } from '@/cloud/builder-client';
import { adminCall } from '@/cloud/account-requests';
import { useAuthStore } from '@/store/auth-store';

/**
 * Studio membership + activity — the Builder-side half of studios being
 * first-class. Studio configs (principles, branding) live in the KB project;
 * who belongs to a studio and what's been happening there live here, in the
 * Builder backend, next to the rest of a builder's account.
 *
 * Gated studios add a door: joining files a request that a Studio Admin
 * approves. Roles are 'member' or 'admin' — admin is granted by the steward
 * (service role), never self-assigned; RLS enforces both.
 */

export type StudioRole = 'member' | 'admin';
export type MembershipStatus = 'pending' | 'approved';
export type StudioAccess = 'open' | 'gated';

export interface StudioMembership {
  studio_slug: string;
  studio_label: string;
  joined_at: string;
  role: StudioRole;
  status: MembershipStatus;
}

export interface StudioMemberRow extends StudioMembership {
  user_id: string;
  display_name: string | null;
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
    .select('studio_slug, studio_label, joined_at, role, status')
    .eq('user_id', user.id)
    .order('joined_at', { ascending: true });
  return (data ?? []) as StudioMembership[];
}

/** Which studios are gated — public knowledge, read straight through RLS */
export async function fetchStudioAccessMap(): Promise<Map<string, StudioAccess>> {
  const map = new Map<string, StudioAccess>();
  if (!builderClient) return map;
  const { data } = await builderClient
    .from('studio_settings')
    .select('studio_slug, access');
  for (const row of (data ?? []) as { studio_slug: string; access: StudioAccess }[]) {
    map.set(row.studio_slug, row.access);
  }
  return map;
}

/**
 * Join a studio. Open studios welcome you immediately; gated studios file a
 * request for their admins. Returns the membership status that resulted, or
 * null when the join failed.
 */
export async function joinStudio(
  slug: string,
  label: string,
): Promise<MembershipStatus | null> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return null;
  const access = (await fetchStudioAccessMap()).get(slug) ?? 'open';
  const status: MembershipStatus = access === 'gated' ? 'pending' : 'approved';
  const { error } = await builderClient.from('studio_memberships').upsert(
    {
      user_id: user.id,
      studio_slug: slug,
      studio_label: label,
      display_name: displayName(),
      role: 'member',
      status,
    },
    { onConflict: 'user_id,studio_slug', ignoreDuplicates: true },
  );
  if (error) return null;
  // The join itself is the first bit of studio life others see — but a
  // pending request stays between the requester and the admins
  if (status === 'approved') void recordStudioActivity('join', slug);
  return status;
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

// --- Studio Admin: the door of a gated studio ---

/** Everyone in (or knocking on) a studio — admins see pending rows via RLS */
export async function listStudioMembers(slug: string): Promise<StudioMemberRow[]> {
  if (!builderClient) return [];
  const { data } = await builderClient
    .from('studio_memberships')
    .select('user_id, studio_slug, studio_label, display_name, joined_at, role, status')
    .eq('studio_slug', slug)
    .order('joined_at', { ascending: false });
  return (data ?? []) as StudioMemberRow[];
}

/** Approve a pending request — RLS lets only the studio's admins do this */
export async function approveStudioMember(slug: string, userId: string): Promise<boolean> {
  if (!builderClient) return false;
  const { error } = await builderClient
    .from('studio_memberships')
    .update({ status: 'approved' })
    .eq('studio_slug', slug)
    .eq('user_id', userId);
  return !error;
}

/** Decline a request or remove a member — the row simply goes away */
export async function removeStudioMember(slug: string, userId: string): Promise<boolean> {
  if (!builderClient) return false;
  const { error } = await builderClient
    .from('studio_memberships')
    .delete()
    .eq('studio_slug', slug)
    .eq('user_id', userId);
  return !error;
}

// --- Steward: studio access + admin grants (service role, via admin-requests) ---

export async function stewardSetStudioAccess(
  slug: string,
  access: StudioAccess,
): Promise<void> {
  await adminCall({ action: 'studio_access_set', studio_slug: slug, access });
}

export async function stewardSetStudioAdmin(
  slug: string,
  label: string,
  email: string,
  grant: boolean,
): Promise<void> {
  await adminCall({
    action: 'studio_admin_set',
    studio_slug: slug,
    studio_label: label,
    email,
    grant,
  });
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
