/**
 * Deploy project files to Vercel via their API.
 *
 * Uses the Vercel API v13:
 * - POST /v13/deployments (create deployment with inline files)
 * - Requires a personal access token from https://vercel.com/account/tokens
 */

import type { FileEntry } from './virtual-fs';

export interface VercelDeployResult {
  url: string;
  deploymentUrl: string;
  projectId: string;
}

export async function deployToVercel(
  files: FileEntry[],
  projectName: string,
  token: string,
): Promise<VercelDeployResult> {
  // Vercel's API accepts files inline as an array
  const vercelFiles = files.map(f => ({
    file: f.path.startsWith('/') ? f.path.slice(1) : f.path,
    data: f.content,
  }));

  const res = await fetch('https://api.vercel.com/v13/deployments', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: projectName.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
      files: vercelFiles,
      projectSettings: {
        framework: null, // static site
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to deploy to Vercel: ${err}`);
  }

  const deployment = await res.json();

  return {
    url: `https://${deployment.url}`,
    deploymentUrl: `https://vercel.com/${deployment.url}`,
    projectId: deployment.projectId,
  };
}
