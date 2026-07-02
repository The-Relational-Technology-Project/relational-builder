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

export interface CommunitySite {
  slug: string;
  name: string;
  url: string;
  created_at: string;
  updated_at: string;
  total_views: number;
  week_views: number;
  /** Daily view counts, oldest → newest (up to 30 days) */
  daily?: { day: string; views: number }[];
  feedback: SiteFeedback[];
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
