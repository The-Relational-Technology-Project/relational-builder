/**
 * GitLab forge client — gitlab.com or any self-managed instance.
 *
 * GitLab's Commits API accepts a whole commit in one POST (an `actions`
 * array), so pushing is a single call instead of GitHub's blob → tree →
 * commit → ref pipeline. Project paths travel URL-encoded (`owner%2Frepo`).
 */

import type { FileEntry } from '../virtual-fs';
import type { ForgeClient, ForgeRepo, CompareResult, MergeOutcome, RemoteCommit, RemoteFileChange, RepoFile, SyncResult } from './types';
import { isBinaryPath } from './types';
import { mapLimit, FORGE_FETCH_CONCURRENCY } from './concurrency';

interface GitLabProject {
  path_with_namespace: string;
  default_branch: string | null;
  web_url: string;
  visibility: string;
}

interface GitLabCommit {
  id: string;
  title: string;
  author_name?: string;
  created_at?: string;
}

function toRemoteCommit(c: GitLabCommit): RemoteCommit {
  return {
    sha: c.id,
    message: c.title,
    author: c.author_name ?? 'unknown',
    date: c.created_at ?? '',
  };
}

function toForgeRepo(p: GitLabProject): ForgeRepo {
  return {
    fullName: p.path_with_namespace,
    defaultBranch: p.default_branch ?? 'main',
    htmlUrl: p.web_url,
    private: p.visibility !== 'public',
  };
}

/** Strip the leading slash the VFS uses; GitLab paths have none */
function repoPath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

export class GitLabClient implements ForgeClient {
  readonly forge = 'gitlab' as const;
  private api: string;
  private webBase: string;

  constructor(baseUrl = 'https://gitlab.com') {
    this.webBase = baseUrl.replace(/\/$/, '');
    this.api = `${this.webBase}/api/v4`;
  }

  private headers(token: string): HeadersInit {
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  }

  private project(fullName: string): string {
    return encodeURIComponent(fullName);
  }

  async getUser(token: string): Promise<string> {
    const res = await fetch(`${this.api}/user`, { headers: this.headers(token) });
    if (!res.ok) throw new Error('Invalid GitLab token');
    const data = await res.json();
    return data.username;
  }

  async listRepos(token: string): Promise<ForgeRepo[]> {
    const res = await fetch(
      `${this.api}/projects?membership=true&order_by=last_activity_at&sort=desc&per_page=100`,
      { headers: this.headers(token) },
    );
    if (!res.ok) throw new Error('Failed to list projects');
    const data: GitLabProject[] = await res.json();
    return data.map(toForgeRepo);
  }

  async createRepo(token: string, name: string, description = ''): Promise<ForgeRepo> {
    const res = await fetch(`${this.api}/projects`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        name,
        description,
        visibility: 'public',
        initialize_with_readme: true, // creates the initial commit so a branch exists
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create project: ${err}`);
    }
    return toForgeRepo(await res.json());
  }

  async getBranchHead(token: string, fullName: string, branch: string): Promise<string> {
    const res = await fetch(
      `${this.api}/projects/${this.project(fullName)}/repository/branches/${encodeURIComponent(branch)}`,
      { headers: this.headers(token) },
    );
    if (!res.ok) throw new Error(`Branch "${branch}" not found`);
    const data = await res.json();
    return data.commit.id;
  }

  async compareCommits(
    token: string,
    fullName: string,
    base: string,
    head: string,
  ): Promise<CompareResult | null> {
    const res = await fetch(
      `${this.api}/projects/${this.project(fullName)}/repository/compare?from=${base}&to=${head}`,
      { headers: this.headers(token) },
    );
    if (res.status === 404) return null; // force-push / rebase — base is gone
    if (!res.ok) throw new Error(`Failed to compare commits (${res.status})`);
    const data = await res.json();
    const commits: RemoteCommit[] = (data.commits ?? []).map(toRemoteCommit);
    const files: RemoteFileChange[] = (data.diffs ?? []).map(
      (d: {
        new_path: string;
        old_path: string;
        new_file: boolean;
        deleted_file: boolean;
        renamed_file: boolean;
      }) => ({
        path: '/' + d.new_path,
        status: d.new_file
          ? 'added'
          : d.deleted_file
            ? 'removed'
            : d.renamed_file
              ? 'renamed'
              : 'modified',
        previousPath: d.renamed_file ? '/' + d.old_path : undefined,
      }),
    );
    return { commits, files };
  }

  async listCommits(
    token: string,
    fullName: string,
    branch: string,
    limit = 30,
  ): Promise<RemoteCommit[]> {
    const res = await fetch(
      `${this.api}/projects/${this.project(fullName)}/repository/commits?ref_name=${encodeURIComponent(branch)}&per_page=${limit}`,
      { headers: this.headers(token) },
    );
    if (!res.ok) throw new Error(`Failed to list commits (${res.status})`);
    const data: GitLabCommit[] = await res.json();
    return data.map(toRemoteCommit);
  }

  async getFileAtRef(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<string | null> {
    const res = await fetch(
      `${this.api}/projects/${this.project(fullName)}/repository/files/${encodeURIComponent(repoPath(path))}/raw?ref=${encodeURIComponent(ref)}`,
      { headers: this.headers(token) },
    );
    if (res.status === 404) return null;
    // Non-404 failures (rate limit, 5xx) must not read as "no file"
    if (!res.ok) throw new Error(`Failed to fetch ${repoPath(path)} (${res.status})`);
    return res.text();
  }

  /** All blob paths on a ref (tree endpoint is paginated) */
  private async listTreePaths(token: string, fullName: string, ref: string): Promise<string[]> {
    const paths: string[] = [];
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(
        `${this.api}/projects/${this.project(fullName)}/repository/tree?recursive=true&ref=${encodeURIComponent(ref)}&per_page=100&page=${page}`,
        { headers: this.headers(token) },
      );
      if (!res.ok) throw new Error('Failed to fetch file tree');
      const entries: { path: string; type: string }[] = await res.json();
      paths.push(...entries.filter(e => e.type === 'blob').map(e => e.path));
      if (!res.headers.get('x-next-page')) break;
    }
    return paths;
  }

  async pullFiles(
    token: string,
    fullName: string,
    branch: string,
  ): Promise<{ files: RepoFile[]; commitSha: string }> {
    const commitSha = await this.getBranchHead(token, fullName, branch);
    const paths = (await this.listTreePaths(token, fullName, commitSha)).filter(
      p => !isBinaryPath(p),
    );
    const files = await mapLimit(paths, FORGE_FETCH_CONCURRENCY, async (p): Promise<RepoFile | null> => {
      const content = await this.getFileAtRef(token, fullName, p, commitSha);
      return content === null ? null : { path: '/' + p, content, sha: commitSha };
    });
    return { files: files.filter((f): f is RepoFile => f !== null), commitSha };
  }

  async pushFiles(
    token: string,
    fullName: string,
    branch: string,
    files: FileEntry[],
    message: string,
  ): Promise<SyncResult> {
    // GitLab insists on the right action per file — 'create' for new paths,
    // 'update' for existing ones — so read the current tree first.
    const head = await this.getBranchHead(token, fullName, branch);
    const existing = new Set(await this.listTreePaths(token, fullName, head));

    const actions = files.map(f => {
      const path = repoPath(f.path);
      return {
        action: existing.has(path) ? ('update' as const) : ('create' as const),
        file_path: path,
        content: f.content,
      };
    });

    const res = await fetch(
      `${this.api}/projects/${this.project(fullName)}/repository/commits`,
      {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify({ branch, commit_message: message, actions }),
      },
    );
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to push: ${err}`);
    }
    const commit = await res.json();
    return {
      commitSha: commit.id,
      commitUrl: commit.web_url ?? `${this.webBase}/${fullName}/-/commit/${commit.id}`,
      filesChanged: files.length,
    };
  }

  async createBranch(token: string, fullName: string, branch: string, fromSha: string): Promise<void> {
    const id = this.project(fullName);
    const create = () =>
      fetch(
        `${this.api}/projects/${id}/repository/branches?branch=${encodeURIComponent(branch)}&ref=${fromSha}`,
        { method: 'POST', headers: this.headers(token) },
      );
    let res = await create();
    if (res.status === 400) {
      // Already exists — GitLab has no force-move, so recreate at the new spot
      await fetch(
        `${this.api}/projects/${id}/repository/branches/${encodeURIComponent(branch)}`,
        { method: 'DELETE', headers: this.headers(token) },
      );
      res = await create();
    }
    if (!res.ok) {
      throw new Error(`Couldn't create the "${branch}" branch (${res.status}) — check that your token can push to this repo`);
    }
  }

  async mergeBranch(token: string, fullName: string, base: string, head: string): Promise<MergeOutcome> {
    const id = this.project(fullName);
    // Nothing to merge? Then don't open (and instantly close) an MR for it.
    const cmp = await fetch(
      `${this.api}/projects/${id}/repository/compare?from=${encodeURIComponent(base)}&to=${encodeURIComponent(head)}`,
      { headers: this.headers(token) },
    );
    if (cmp.ok && ((await cmp.json()).commits ?? []).length === 0) {
      return { status: 'up-to-date', sha: null };
    }

    // GitLab merges through a merge request — open one, accept it, and if it
    // can't merge (conflict), close it again so nothing dangles.
    let mrRes = await fetch(`${this.api}/projects/${id}/merge_requests`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        source_branch: head,
        target_branch: base,
        title: 'Publish from Relational Builder',
      }),
    });
    if (mrRes.status === 409) {
      // One already open for this pair — reuse it
      mrRes = await fetch(
        `${this.api}/projects/${id}/merge_requests?state=opened&source_branch=${encodeURIComponent(head)}&target_branch=${encodeURIComponent(base)}`,
        { headers: this.headers(token) },
      );
      if (mrRes.ok) {
        const list = await mrRes.json();
        if (list[0]) return this.acceptMergeRequest(token, id, list[0].iid);
      }
      throw new Error('Merge failed (409)');
    }
    if (!mrRes.ok) throw new Error(`Merge failed (${mrRes.status})`);
    const mr = await mrRes.json();
    return this.acceptMergeRequest(token, id, mr.iid);
  }

  private async acceptMergeRequest(token: string, projectId: string, iid: number): Promise<MergeOutcome> {
    // GitLab computes mergeability asynchronously — a 405 straight after MR
    // creation can just mean "still checking", so give it one more chance.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `${this.api}/projects/${projectId}/merge_requests/${iid}/merge`,
        { method: 'PUT', headers: this.headers(token), body: JSON.stringify({}) },
      );
      if (res.ok) {
        const data = await res.json();
        return { status: 'merged', sha: data.merge_commit_sha ?? data.sha ?? null };
      }
      if (res.status === 405 && attempt === 0) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if ([405, 406, 422].includes(res.status)) {
        await fetch(`${this.api}/projects/${projectId}/merge_requests/${iid}`, {
          method: 'PUT',
          headers: this.headers(token),
          body: JSON.stringify({ state_event: 'close' }),
        }).catch(() => {});
        return { status: 'conflict', sha: null };
      }
      throw new Error(`Merge failed (${res.status})`);
    }
    return { status: 'conflict', sha: null };
  }

  async addReltechTopic(token: string, fullName: string): Promise<void> {
    const id = this.project(fullName);
    const getRes = await fetch(`${this.api}/projects/${id}`, { headers: this.headers(token) });
    if (!getRes.ok) return;
    const topics: string[] = (await getRes.json()).topics ?? [];
    if (!topics.includes('relational-tech')) {
      await fetch(`${this.api}/projects/${id}`, {
        method: 'PUT',
        headers: this.headers(token),
        body: JSON.stringify({ topics: [...topics, 'relational-tech'] }),
      });
    }
  }
}
