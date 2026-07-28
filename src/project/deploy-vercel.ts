/**
 * Deploy project files to Vercel via their API.
 *
 * Uses the Vercel API v13:
 * - POST /v13/deployments (create deployment with inline files)
 * - Requires a personal access token from https://vercel.com/account/tokens
 */

import type { FileEntry } from './virtual-fs';
import { isBinaryFilePath } from './app-icon';

export interface VercelDeployResult {
  url: string;
  deploymentUrl: string;
  projectId: string;
  /** DNS records the user needs to create for their custom domain */
  dnsInstructions?: DnsInstruction[];
}

export interface DnsInstruction {
  type: 'CNAME' | 'A';
  host: string;
  value: string;
}

export async function deployToVercel(
  files: FileEntry[],
  projectName: string,
  token: string,
  envVars?: Record<string, string>,
  customDomain?: string,
): Promise<VercelDeployResult> {
  // Vercel's API accepts files inline as an array; binary files (e.g. the
  // generated home-screen icons) ride the VFS as base64 and are flagged so
  const vercelFiles = files.map(f => {
    const path = f.path.startsWith('/') ? f.path.slice(1) : f.path;
    return isBinaryFilePath(path)
      ? { file: path, data: f.content, encoding: 'base64' as const }
      : { file: path, data: f.content };
  });

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
      env: envVars,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to deploy to Vercel: ${err}`);
  }

  const deployment = await res.json();

  const result: VercelDeployResult = {
    url: `https://${deployment.url}`,
    deploymentUrl: `https://vercel.com/${deployment.url}`,
    projectId: deployment.projectId,
  };

  // Add custom domain to the project if provided
  if (customDomain && deployment.projectId) {
    const domain = customDomain.replace(/^https?:\/\//, '').replace(/\/+$/, '');
    await fetch(
      `https://api.vercel.com/v10/projects/${deployment.projectId}/domains`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      },
    ).catch(() => {});

    const isApex = domain.split('.').length === 2;
    result.dnsInstructions = isApex
      ? [{ type: 'A', host: '@', value: '76.76.21.21' }]
      : [{ type: 'CNAME', host: domain.split('.')[0], value: 'cname.vercel-dns.com' }];
  }

  return result;
}
