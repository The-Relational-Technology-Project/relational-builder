import { builderClient } from '@/cloud/builder-client';

/**
 * Manage a builder's Community Hosting sites — the dashboard's view of
 * what's live, how it's being used, and what neighbors are saying.
 */

export interface SiteFeedback {
  id: string;
  name: string | null;
  message: string;
  created_at: string;
}

export interface SiteError {
  day: string;
  message: string;
  count: number;
  last_seen: string;
}

export interface CommunitySite {
  slug: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
  /** Private site — visitors need the passphrase before anything is served */
  has_passphrase?: boolean;
  total_views: number;
  week_views: number;
  /** Daily view counts, oldest → newest (up to 30 days) */
  daily?: { day: string; views: number }[];
  feedback: SiteFeedback[];
  /** Runtime errors neighbors hit this week (from the site's error beacon) */
  week_errors?: number;
  errors?: SiteError[];
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!builderClient) throw new Error('Community hosting needs the cloud backend configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to manage your sites');

  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/publish-site`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((result as { error?: string }).error ?? `Request failed (${res.status})`);
  return result as Record<string, unknown>;
}

export async function listCommunitySites(): Promise<CommunitySite[]> {
  const result = await call({ action: 'list' });
  return (result.sites as CommunitySite[]) ?? [];
}

export async function deleteCommunitySite(slug: string): Promise<void> {
  await call({ action: 'delete', slug });
}

/** Set or change (a string) or remove (null) a site's passphrase. Changing
 *  it signs every visitor out; they unlock again with the new one. */
export async function setSitePassphrase(slug: string, passphrase: string | null): Promise<void> {
  await call({ action: 'set_passphrase', slug, passphrase });
}

// ── Versions: every republish keeps the outgoing site, restorable ──

export interface SiteVersion {
  id: string;
  taken_at: string;
  label: string | null;
  file_count: number;
  bytes: number;
}

export async function listSiteVersions(slug: string): Promise<SiteVersion[]> {
  const result = await call({ action: 'versions', slug });
  return (result.versions as SiteVersion[]) ?? [];
}

/** Roll the live site back to a snapshot. The current version is snapshotted
 *  first, so a restore can always be restored from. */
export async function restoreSiteVersion(slug: string, versionId: string): Promise<void> {
  await call({ action: 'restore_version', slug, version_id: versionId });
}
