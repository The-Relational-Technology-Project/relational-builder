/**
 * GitHub API client for two-way file sync.
 *
 * Uses the Git Data API for atomic multi-file commits (blobs → tree → commit → ref).
 * Auth via Personal Access Token — no backend required.
 */

import type { FileEntry } from './virtual-fs';

const API = 'https://api.github.com';

function headers(token: string): HeadersInit {
  const base: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  // Empty token = unauthenticated public-repo access (remixing).
  // GitHub allows ~60 requests/hour per IP without auth.
  if (token) base['Authorization'] = `Bearer ${token}`;
  return base;
}

// ── Types ──────────────────────────────────────────────────────────────

export interface GitHubRepo {
  full_name: string;
  default_branch: string;
  html_url: string;
  private: boolean;
}

export interface GitHubFile {
  path: string;
  content: string;
  sha: string;
}

export interface SyncResult {
  commitSha: string;
  commitUrl: string;
  filesChanged: number;
}

/** Get a public repo's metadata (works unauthenticated, for remixing) */
export async function getRepoInfo(repoFullName: string, token = ''): Promise<GitHubRepo> {
  const res = await fetch(`${API}/repos/${repoFullName}`, { headers: headers(token) });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'Repository not found — is it public?'
        : res.status === 403
          ? 'GitHub rate limit reached — connect your GitHub token in the GitHub dialog, or try again in an hour'
          : `GitHub error (${res.status})`,
    );
  }
  return res.json();
}

// ── User & Repo ────────────────────────────────────────────────────────

/** Get the authenticated user's login */
export async function getUser(token: string): Promise<string> {
  const res = await fetch(`${API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error('Invalid GitHub token');
  const data = await res.json();
  return data.login;
}

/** List the user's repos (first 100, sorted by recent push) */
export async function listRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${API}/user/repos?sort=pushed&per_page=100&affiliation=owner`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error('Failed to list repos');
  return res.json();
}

/** Create a new repo under the authenticated user */
export async function createRepo(
  token: string,
  name: string,
  description = '',
  isPrivate = false,
): Promise<GitHubRepo> {
  const res = await fetch(`${API}/user/repos`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({
      name,
      description,
      private: isPrivate,
      auto_init: true, // creates initial commit so we have a ref
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to create repo: ${err}`);
  }
  return res.json();
}

// ── Pull (GitHub → VFS) ───────────────────────────────────────────────

/** Fetch all files from a repo's default branch */
export async function pullFiles(
  token: string,
  repoFullName: string,
  branch: string,
): Promise<{ files: GitHubFile[]; treeSha: string; commitSha: string }> {
  // Get the latest commit on the branch
  const refRes = await fetch(
    `${API}/repos/${repoFullName}/git/refs/heads/${branch}`,
    { headers: headers(token) },
  );
  if (!refRes.ok) throw new Error(`Branch "${branch}" not found`);
  const ref = await refRes.json();
  const commitSha = ref.object.sha;

  // Get the commit to find the tree
  const commitRes = await fetch(
    `${API}/repos/${repoFullName}/git/commits/${commitSha}`,
    { headers: headers(token) },
  );
  if (!commitRes.ok) throw new Error('Failed to fetch commit');
  const commit = await commitRes.json();
  const treeSha = commit.tree.sha;

  // Get the full tree recursively
  const treeRes = await fetch(
    `${API}/repos/${repoFullName}/git/trees/${treeSha}?recursive=1`,
    { headers: headers(token) },
  );
  if (!treeRes.ok) throw new Error('Failed to fetch file tree');
  const tree = await treeRes.json();

  // Fetch content for each blob (file)
  const blobs = tree.tree.filter(
    (item: { type: string; size?: number }) =>
      item.type === 'blob' && (item.size ?? 0) < 500_000, // skip large files
  );

  const files: GitHubFile[] = await Promise.all(
    blobs.map(async (blob: { path: string; sha: string }) => {
      const blobRes = await fetch(
        `${API}/repos/${repoFullName}/git/blobs/${blob.sha}`,
        { headers: headers(token) },
      );
      if (!blobRes.ok) return null;
      const blobData = await blobRes.json();
      const content = atob(blobData.content.replace(/\n/g, ''));
      return { path: '/' + blob.path, content, sha: blob.sha };
    }),
  );

  return {
    files: files.filter((f): f is GitHubFile => f !== null),
    treeSha,
    commitSha,
  };
}

// ── Push (VFS → GitHub) ───────────────────────────────────────────────

/** Push all VFS files as a single atomic commit */
export async function pushFiles(
  token: string,
  repoFullName: string,
  branch: string,
  files: FileEntry[],
  message: string,
): Promise<SyncResult> {
  const h = headers(token);

  // 1. Get the current HEAD commit SHA
  const refRes = await fetch(
    `${API}/repos/${repoFullName}/git/refs/heads/${branch}`,
    { headers: h },
  );
  if (!refRes.ok) throw new Error(`Branch "${branch}" not found`);
  const ref = await refRes.json();
  const parentSha = ref.object.sha;

  // 2. Create blobs for each file
  const blobShas = await Promise.all(
    files.map(async (file) => {
      const blobRes = await fetch(
        `${API}/repos/${repoFullName}/git/blobs`,
        {
          method: 'POST',
          headers: h,
          body: JSON.stringify({
            content: file.content,
            encoding: 'utf-8',
          }),
        },
      );
      if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.path}`);
      const blob = await blobRes.json();
      return {
        path: file.path.startsWith('/') ? file.path.slice(1) : file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.sha as string,
      };
    }),
  );

  // 3. Create a new tree from all blobs
  const treeRes = await fetch(
    `${API}/repos/${repoFullName}/git/trees`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify({ tree: blobShas }),
    },
  );
  if (!treeRes.ok) throw new Error('Failed to create tree');
  const tree = await treeRes.json();

  // 4. Create a commit pointing to the new tree
  const commitRes = await fetch(
    `${API}/repos/${repoFullName}/git/commits`,
    {
      method: 'POST',
      headers: h,
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [parentSha],
      }),
    },
  );
  if (!commitRes.ok) throw new Error('Failed to create commit');
  const commit = await commitRes.json();

  // 5. Update the branch ref to point to the new commit
  const updateRes = await fetch(
    `${API}/repos/${repoFullName}/git/refs/heads/${branch}`,
    {
      method: 'PATCH',
      headers: h,
      body: JSON.stringify({ sha: commit.sha }),
    },
  );
  if (!updateRes.ok) throw new Error('Failed to update branch ref');

  return {
    commitSha: commit.sha,
    commitUrl: commit.html_url,
    filesChanged: files.length,
  };
}

/** Add the relational-tech topic to a repo */
export async function addReltechTopic(
  token: string,
  repoFullName: string,
): Promise<void> {
  // Get current topics
  const getRes = await fetch(
    `${API}/repos/${repoFullName}/topics`,
    { headers: headers(token) },
  );
  const current = getRes.ok ? await getRes.json() : { names: [] };
  const topics: string[] = current.names ?? [];

  if (!topics.includes('relational-tech')) {
    topics.push('relational-tech');
    await fetch(`${API}/repos/${repoFullName}/topics`, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify({ names: topics }),
    });
  }
}
