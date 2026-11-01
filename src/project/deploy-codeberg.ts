import type { FileEntry } from './virtual-fs';
import type { DnsInstruction } from './deploy-netlify';
import { isBinaryFilePath } from './app-icon';

/**
 * Deploy a static site to Codeberg Pages (Codeberg e.V., Berlin — a
 * non-profit running Forgejo). The site is a public repository with a
 * `pages` branch; Codeberg serves it at https://{user}.codeberg.page/{repo}/
 * (or the root for a repo named `pages`). The second EU publish target
 * (docs/REGIONAL-MODE.md): the one with no company behind it at all.
 *
 * Browser-side through the Forgejo API (CORS `*`, checked Nov 2026):
 *   1. ensure the repo exists (POST /user/repos, default branch `pages`),
 *   2. write every file in ONE commit (POST /repos/{o}/{r}/contents with
 *      a `files` list — create or update, by comparing against the tree),
 *   3. make sure the Pages webhook is there (Codeberg's docs ask for a
 *      Forgejo-type webhook filtered to the `pages` branch; the target URL
 *      is the site's own address).
 *
 * Token: Codeberg → Settings → Applications → Generate token, with
 * `write:repository` and `write:user` (the latter creates the repo).
 */

const API = 'https://codeberg.org/api/v1';
const BRANCH = 'pages';

export interface CodebergSite {
  owner: string;
  repo: string;
  url: string;
}

export interface CodebergDeployResult {
  siteUrl: string;
  adminUrl: string;
  site: CodebergSite;
  /** The webhook was created on this publish (first time only) */
  webhookCreated: boolean;
  dnsInstructions?: DnsInstruction[];
}

function repoSlug(name: string): string {
  return (name.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'community-app').slice(0, 60);
}

async function api<T>(path: string, token: string, init: RequestInit = {}): Promise<{ status: number; body: T | null }> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401) throw new Error('Codeberg rejected the token. Create one at codeberg.org → Settings → Applications with write:repository and write:user.');
  const text = await res.text();
  let body: T | null = null;
  try { body = text ? (JSON.parse(text) as T) : null; } catch { body = null; }
  return { status: res.status, body };
}

/** Binary files already ride the VFS as base64 (flagged by path); text gets encoded here */
function toBase64(path: string, content: string): string {
  if (isBinaryFilePath(path)) return content;
  const bytes = new TextEncoder().encode(content);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

interface TreeEntry { path: string; type: string; sha: string }

export async function deployToCodeberg(
  files: FileEntry[],
  siteName: string,
  token: string,
  existing?: CodebergSite,
  customDomain?: string,
): Promise<CodebergDeployResult> {
  // Who am I — the owner half of every URL below
  const me = await api<{ login: string }>('/user', token);
  if (!me.body?.login) throw new Error('Codeberg did not say who this token belongs to — it may be missing the read:user scope.');
  const owner = existing?.owner ?? me.body.login;
  const repo = existing?.repo ?? repoSlug(siteName);

  // 1. The repository — public, `pages` as default branch, no auto-init so
  //    the first contents write makes the first commit
  let created = false;
  const have = await api<{ default_branch: string }>(`/repos/${owner}/${repo}`, token);
  if (have.status === 404) {
    const mk = await api<{ full_name: string }>('/user/repos', token, {
      method: 'POST',
      body: JSON.stringify({
        name: repo,
        description: `${siteName} — built with Relational Builder`,
        private: false,
        auto_init: false,
        default_branch: BRANCH,
      }),
    });
    if (mk.status >= 300) {
      const msg = (mk.body as { message?: string } | null)?.message ?? `HTTP ${mk.status}`;
      throw new Error(`Couldn't create the repository on Codeberg: ${msg}`);
    }
    created = true;
  } else if (have.status >= 300) {
    throw new Error(`Couldn't read the repository on Codeberg (HTTP ${have.status}).`);
  }

  // 2. What's already there on the pages branch, so updates carry their sha
  const shas = new Map<string, string>();
  if (!created) {
    const tree = await api<{ tree?: TreeEntry[] }>(`/repos/${owner}/${repo}/git/trees/${BRANCH}?recursive=true&per_page=10000`, token);
    for (const e of tree.body?.tree ?? []) if (e.type === 'blob') shas.set(e.path, e.sha);
  }

  const ops = files.map(f => {
    const path = f.path.replace(/^\/+/, '');
    const sha = shas.get(path);
    return sha
      ? { operation: 'update', path, content: toBase64(path, f.content), sha }
      : { operation: 'create', path, content: toBase64(path, f.content) };
  });
  // Files that were on the branch but aren't in this build go away, so a
  // renamed page doesn't linger as a stale URL
  const keep = new Set(ops.map(o => o.path));
  for (const [path, sha] of shas) if (!keep.has(path)) ops.push({ operation: 'delete', path, sha, content: '' });

  const commit = await api<{ message?: string }>(`/repos/${owner}/${repo}/contents`, token, {
    method: 'POST',
    // On a brand-new repo `pages` is the default branch and the first
    // write creates it; afterwards it's an ordinary commit on that branch
    body: JSON.stringify({
      branch: BRANCH,
      message: `Publish ${siteName} from Relational Builder`,
      files: ops,
    }),
  });
  if (commit.status >= 300) {
    throw new Error(`Codeberg refused the commit: ${commit.body?.message ?? `HTTP ${commit.status}`}`);
  }

  // 3. The Pages webhook — Codeberg's documented setup step, done once
  const siteUrl = repo === 'pages' ? `https://${owner}.codeberg.page/` : `https://${owner}.codeberg.page/${repo}/`;
  let webhookCreated = false;
  const hooks = await api<{ config?: { url?: string } }[]>(`/repos/${owner}/${repo}/hooks`, token);
  const hasPagesHook = (hooks.body ?? []).some(h => (h.config?.url ?? '').includes('codeberg.page'));
  if (!hasPagesHook) {
    const hk = await api(`/repos/${owner}/${repo}/hooks`, token, {
      method: 'POST',
      body: JSON.stringify({
        type: 'forgejo',
        active: true,
        branch_filter: BRANCH,
        events: ['push'],
        config: { url: siteUrl, content_type: 'json' },
      }),
    });
    webhookCreated = hk.status < 300;
  }

  const result: CodebergDeployResult = {
    siteUrl,
    adminUrl: `https://codeberg.org/${owner}/${repo}`,
    site: { owner, repo, url: siteUrl },
    webhookCreated,
  };

  // Custom domains are DNS-only on Codeberg Pages: a CNAME to codeberg.page
  // plus a TXT record naming the repository (their docs, Nov 2026)
  const domain = customDomain?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (domain) {
    const isApex = domain.split('.').length === 2;
    result.dnsInstructions = [
      isApex
        ? { type: 'ALIAS', host: '@', value: 'codeberg.page' }
        : { type: 'CNAME', host: domain.split('.')[0], value: 'codeberg.page' },
      { type: 'TXT' as DnsInstruction['type'], host: `_git-pages-repository.${domain}`, value: `https://codeberg.org/${owner}/${repo}` },
    ];
  }

  return result;
}
