import type { FileEntry } from './virtual-fs';
import type { PublicEnvVar } from './env-module';
import { buildEnvJs } from './env-module';
import { builderClient } from '@/cloud/builder-client';

/**
 * Shareable preview links, hosted on community infrastructure.
 *
 * Previews are unlisted community-hosted sites under a random slug: they
 * don't count against the builder's site cap, don't appear on the dashboard,
 * and expire after PREVIEW_DAYS. (Previously these rode on CodeSandbox's
 * anonymous define API, whose {id}.csb.app links stopped serving apps.)
 */

/** Keep in sync with PREVIEW_DAYS in supabase/functions/publish-site. */
export const PREVIEW_DAYS = 30;

export interface ShareResult {
  /** Clean preview URL — just the running app */
  previewUrl: string;
  slug: string;
  /** When the link lapses (ISO timestamp), if the server reports it */
  expiresAt: string | null;
}

export async function createPreviewLink(
  files: FileEntry[],
  projectName: string,
  publicEnvVars: PublicEnvVar[] = [],
): Promise<ShareResult> {
  if (files.length === 0) {
    throw new Error('No files to share');
  }
  if (!builderClient) {
    throw new Error('Preview links need the cloud backend configured');
  }
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Sign in (top right) to create a preview link');
  }

  const payloadFiles = files.map(f => ({ path: f.path, content: f.content }));
  if (publicEnvVars.length > 0 && !files.some(f => f.path.replace(/^\//, '') === 'env.js')) {
    payloadFiles.push({ path: '/env.js', content: buildEnvJs(publicEnvVars) });
  }

  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/publish-site`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ preview: true, name: projectName, files: payloadFiles }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(result.error ?? `Could not create the preview (${res.status})`);
  }
  return {
    previewUrl: result.url,
    slug: result.slug,
    expiresAt: result.expires_at ?? null,
  };
}
