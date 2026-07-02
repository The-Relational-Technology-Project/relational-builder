import type { FileEntry } from './virtual-fs';
import { buildEnvJs, type PublicEnvVar } from './env-module';
import { builderClient } from '@/cloud/builder-client';

/**
 * Publish to Community Hosting — RTP-hosted deployment, no tokens, no
 * accounts on other platforms. Every builder gets a few free sites,
 * paid for by RTP during the pilot on the way to shared community infra.
 */

export interface CommunityPublishResult {
  slug: string;
  url: string;
  total_views: number;
}

export async function publishToCommunityHosting(
  files: FileEntry[],
  projectName: string,
  publicEnvVars: PublicEnvVar[],
): Promise<CommunityPublishResult> {
  if (!builderClient) {
    throw new Error('Community hosting needs the cloud backend configured');
  }
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sign in (top right) to publish to community hosting');
  }

  const payloadFiles = files.map(f => ({ path: f.path, content: f.content }));
  if (publicEnvVars.length > 0 && !files.some(f => f.path.replace(/^\//, '') === 'env.js')) {
    payloadFiles.push({ path: '/env.js', content: buildEnvJs(publicEnvVars) });
  }

  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/publish-site`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ name: projectName, files: payloadFiles }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.error ?? `Publish failed (${res.status})`);
  }
  return result as CommunityPublishResult;
}
