/**
 * GitHub API client for two-way file sync.
 *
 * Uses the Git Data API for atomic multi-file commits (blobs → tree → commit → ref).
 * Auth via Personal Access Token — no backend required.
 */

import type { FileEntry } from './virtual-fs';
import { isBinaryPath, type RepoImagePull } from './forge/types';
import { mapLimit, FORGE_FETCH_CONCURRENCY } from './forge/concurrency';
import { isBinaryFilePath } from './app-icon';

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

export interface RemoteCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

export interface RemoteFileChange {
  path: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  previousPath?: string;
}

/** Get the latest commit SHA on a branch */
export async function getBranchHead(
  token: string,
  repoFullName: string,
  branch: string,
): Promise<string> {
  const res = await fetch(
    `${API}/repos/${repoFullName}/git/refs/heads/${branch}`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`Branch "${branch}" not found`);
  const ref = await res.json();
  return ref.object.sha;
}

/**
 * Compare two commits — what happened on GitHub since we last synced.
 * Returns null when the base commit is unreachable (history was rewritten).
 */
export async function compareCommits(
  token: string,
  repoFullName: string,
  base: string,
  head: string,
): Promise<{ commits: RemoteCommit[]; files: RemoteFileChange[] } | null> {
  const res = await fetch(
    `${API}/repos/${repoFullName}/compare/${base}...${head}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null; // force-push / rebase — base is gone
  if (!res.ok) throw new Error(`Failed to compare commits (${res.status})`);
  const data = await res.json();
  const commits: RemoteCommit[] = (data.commits ?? []).map(
    (c: { sha: string; commit: { message: string; author?: { name?: string; date?: string } } }) => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      author: c.commit.author?.name ?? 'unknown',
      date: c.commit.author?.date ?? '',
    }),
  );
  const files: RemoteFileChange[] = (data.files ?? [])
    .filter((f: { status: string }) =>
      ['added', 'modified', 'removed', 'renamed'].includes(f.status),
    )
    .map((f: { filename: string; status: string; previous_filename?: string }) => ({
      path: '/' + f.filename,
      status: f.status as RemoteFileChange['status'],
      previousPath: f.previous_filename ? '/' + f.previous_filename : undefined,
    }));
  return { commits, files };
}

/** Recent commits on a branch, newest first (for the Project Story timeline) */
export async function listCommits(
  token: string,
  repoFullName: string,
  branch: string,
  limit = 30,
): Promise<RemoteCommit[]> {
  const res = await fetch(
    `${API}/repos/${repoFullName}/commits?sha=${encodeURIComponent(branch)}&per_page=${limit}`,
    { headers: headers(token) },
  );
  if (!res.ok) throw new Error(`Failed to list commits (${res.status})`);
  const data = await res.json();
  return (data as { sha: string; commit: { message: string; author?: { name?: string; date?: string } } }[]).map(c => ({
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name ?? 'unknown',
    date: c.commit.author?.date ?? '',
  }));
}

/** Fetch one file's content at a specific ref (branch or commit SHA) */
export async function getFileAtRef(
  token: string,
  repoFullName: string,
  path: string,
  ref: string,
): Promise<string | null> {
  const clean = path.startsWith('/') ? path.slice(1) : path;
  const res = await fetch(
    `${API}/repos/${repoFullName}/contents/${encodeURIComponent(clean).replace(/%2F/g, '/')}?ref=${ref}`,
    { headers: headers(token) },
  );
  if (res.status === 404) return null;
  // Anything else non-OK (rate limit, 5xx) is a failed fetch, not a missing
  // file — returning null here made pulls silently skip real changes.
  if (!res.ok) throw new Error(`Failed to fetch ${clean} (${res.status})`);
  const data = await res.json();
  if (data.encoding !== 'base64' || typeof data.content !== 'string') return null;
  try {
    return atob(data.content.replace(/\n/g, ''));
  } catch {
    return null; // not valid text
  }
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

/**
 * List every repo the token can push to (first 100, sorted by recent push).
 * All affiliations, not just owner: work often lives in an organization
 * (or a collaborator's account), and a repo you can't see here is a repo
 * you can't connect or import.
 */
export async function listRepos(token: string): Promise<GitHubRepo[]> {
  const res = await fetch(
    `${API}/user/repos?sort=pushed&per_page=100&affiliation=owner,collaborator,organization_member`,
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

  // Fetch content for each text blob — binaries are filtered by path up
  // front rather than downloaded and discarded
  const blobs: { path: string; sha: string }[] = tree.tree.filter(
    (item: { type: string; path: string; size?: number }) =>
      item.type === 'blob' &&
      (item.size ?? 0) < 500_000 && // skip large files
      !isBinaryPath(item.path),
  );

  const files = await mapLimit(blobs, FORGE_FETCH_CONCURRENCY, async blob => {
    const blobRes = await fetch(
      `${API}/repos/${repoFullName}/git/blobs/${blob.sha}`,
      { headers: headers(token) },
    );
    // A blob fetch by sha only fails transiently — surfacing it beats
    // silently dropping the file from the pulled tree
    if (!blobRes.ok) throw new Error(`Failed to fetch ${blob.path} (${blobRes.status})`);
    const blobData = await blobRes.json();
    try {
      return { path: '/' + blob.path, content: atob(blobData.content.replace(/\n/g, '')), sha: blob.sha };
    } catch {
      return null; // not valid text after all
    }
  });

  return {
    files: files.filter((f): f is GitHubFile => f !== null),
    treeSha,
    commitSha,
  };
}

/**
 * Fetch a branch's images as base64 — the photos and logos an imported app
 * needs for its preview to look like the real site. Files over the per-file
 * cap are reported as skipped rather than downloaded; the caller decides
 * what to tell the person.
 */
export async function pullImages(
  token: string,
  repoFullName: string,
  branch: string,
  opts: { maxFileBytes: number },
): Promise<RepoImagePull> {
  const refRes = await fetch(
    `${API}/repos/${repoFullName}/git/refs/heads/${branch}`,
    { headers: headers(token) },
  );
  if (!refRes.ok) throw new Error(`Branch "${branch}" not found`);
  const ref = await refRes.json();

  const commitRes = await fetch(
    `${API}/repos/${repoFullName}/git/commits/${ref.object.sha}`,
    { headers: headers(token) },
  );
  if (!commitRes.ok) throw new Error('Failed to fetch commit');
  const commit = await commitRes.json();

  const treeRes = await fetch(
    `${API}/repos/${repoFullName}/git/trees/${commit.tree.sha}?recursive=1`,
    { headers: headers(token) },
  );
  if (!treeRes.ok) throw new Error('Failed to fetch file tree');
  const tree = await treeRes.json();

  const all: { path: string; sha: string; size: number }[] = tree.tree.filter(
    (item: { type: string; path: string; size?: number }) =>
      item.type === 'blob' && isBinaryFilePath(item.path),
  );
  const skipped = all.filter(b => b.size > opts.maxFileBytes).map(b => '/' + b.path);
  const toFetch = all.filter(b => b.size <= opts.maxFileBytes);

  const images = await mapLimit(toFetch, FORGE_FETCH_CONCURRENCY, async blob => {
    const blobRes = await fetch(
      `${API}/repos/${repoFullName}/git/blobs/${blob.sha}`,
      { headers: headers(token) },
    );
    if (!blobRes.ok) throw new Error(`Failed to fetch ${blob.path} (${blobRes.status})`);
    const blobData = await blobRes.json();
    // The blobs API already speaks base64 — exactly what the VFS stores
    return { path: '/' + blob.path, base64: String(blobData.content).replace(/\n/g, ''), bytes: blob.size };
  });

  return { images, skipped };
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

  // Find the parent commit's tree — pushing on top of it means a push only
  // adds and updates files. It never deletes something that exists only on
  // GitHub (a README, workflows, docs written outside the Builder).
  const parentCommitRes = await fetch(
    `${API}/repos/${repoFullName}/git/commits/${parentSha}`,
    { headers: h },
  );
  if (!parentCommitRes.ok) throw new Error('Failed to read current commit');
  const parentCommit = await parentCommitRes.json();
  const baseTreeSha = parentCommit.tree.sha;

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
      body: JSON.stringify({ base_tree: baseTreeSha, tree: blobShas }),
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

// ── Branches & merges (safe-copy mode) ────────────────────────────────

/** Create a branch at a commit; if it exists, move it there (force). */
export async function createBranch(
  token: string,
  repoFullName: string,
  branch: string,
  fromSha: string,
): Promise<void> {
  const res = await fetch(`${API}/repos/${repoFullName}/git/refs`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha }),
  });
  if (res.ok) return;
  if (res.status === 422) {
    // Already exists — both callers mean "start here now", so move it
    const patch = await fetch(`${API}/repos/${repoFullName}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify({ sha: fromSha, force: true }),
    });
    if (patch.ok) return;
  }
  throw new Error(`Couldn't create the "${branch}" branch (${res.status}) — check that your token can push to this repo`);
}

export interface MergeOutcome {
  status: 'merged' | 'up-to-date' | 'conflict';
  sha: string | null;
}

/** Merge head into base server-side. Conflict is an outcome, not an error. */
export async function mergeBranch(
  token: string,
  repoFullName: string,
  base: string,
  head: string,
): Promise<MergeOutcome> {
  const res = await fetch(`${API}/repos/${repoFullName}/merges`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ base, head }),
  });
  if (res.status === 201) {
    const data = await res.json();
    return { status: 'merged', sha: data.sha ?? null };
  }
  if (res.status === 204) return { status: 'up-to-date', sha: null };
  if (res.status === 409) return { status: 'conflict', sha: null };
  throw new Error(`Merge failed (${res.status})`);
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
