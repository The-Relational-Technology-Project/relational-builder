/**
 * Forgejo/Gitea forge client — for a community's own instance.
 *
 * Both forges speak the same API (`/api/v1`), including an atomic
 * multi-file commit endpoint (`POST /repos/{owner}/{repo}/contents`).
 * Self-hosted instances must enable CORS (`[cors]` in app.ini) for a
 * browser-based builder to reach them — the connect UI says so.
 */

import type { FileEntry } from '../virtual-fs';
import type { ForgeClient, ForgeRepo, CompareResult, RemoteCommit, RemoteFileChange, RepoFile, SyncResult } from './types';
import { isBinaryPath, toBase64 } from './types';

interface ForgejoRepo {
  full_name: string;
  default_branch: string;
  html_url: string;
  private: boolean;
}

interface ForgejoCommit {
  sha: string;
  commit: { message: string; author?: { name?: string; date?: string } };
  files?: { filename: string; status?: string; previous_filename?: string }[];
}

function toRemoteCommit(c: ForgejoCommit): RemoteCommit {
  return {
    sha: c.sha,
    message: c.commit.message.split('\n')[0],
    author: c.commit.author?.name ?? 'unknown',
    date: c.commit.author?.date ?? '',
  };
}

function toForgeRepo(r: ForgejoRepo): ForgeRepo {
  return {
    fullName: r.full_name,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    private: r.private,
  };
}

function repoPath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

/** Encode a repo path for a URL, keeping the slashes */
function encPath(path: string): string {
  return encodeURIComponent(path).replace(/%2F/g, '/');
}

export class ForgejoClient implements ForgeClient {
  readonly forge = 'forgejo' as const;
  private api: string;
  private webBase: string;

  constructor(baseUrl: string) {
    this.webBase = baseUrl.replace(/\/$/, '');
    this.api = `${this.webBase}/api/v1`;
  }

  private headers(token: string): HeadersInit {
    return { Authorization: `token ${token}`, 'Content-Type': 'application/json' };
  }

  async getUser(token: string): Promise<string> {
    const res = await fetch(`${this.api}/user`, { headers: this.headers(token) });
    if (!res.ok) throw new Error('Invalid token — check the instance URL and scopes');
    const data = await res.json();
    return data.login;
  }

  async listRepos(token: string): Promise<ForgeRepo[]> {
    const res = await fetch(`${this.api}/user/repos?limit=100`, {
      headers: this.headers(token),
    });
    if (!res.ok) throw new Error('Failed to list repos');
    const data: ForgejoRepo[] = await res.json();
    return data.map(toForgeRepo);
  }

  async createRepo(token: string, name: string, description = ''): Promise<ForgeRepo> {
    const res = await fetch(`${this.api}/user/repos`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ name, description, private: false, auto_init: true }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to create repo: ${err}`);
    }
    return toForgeRepo(await res.json());
  }

  async getBranchHead(token: string, fullName: string, branch: string): Promise<string> {
    const res = await fetch(
      `${this.api}/repos/${fullName}/branches/${encodeURIComponent(branch)}`,
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
      `${this.api}/repos/${fullName}/compare/${base}...${head}`,
      { headers: this.headers(token) },
    );
    if (!res.ok) return null; // unreachable base or old instance — full resync is safe
    const data = await res.json();
    const rawCommits: ForgejoCommit[] = data.commits ?? [];
    const commits = rawCommits.map(toRemoteCommit);

    // File changes ride along on each commit object. If this instance
    // doesn't include them, report "can't diff" so the caller overlays
    // the whole repo instead of silently missing changes.
    if (commits.length > 0 && rawCommits.every(c => !c.files)) return null;

    const byPath = new Map<string, RemoteFileChange>();
    for (const c of rawCommits) {
      for (const f of c.files ?? []) {
        const status = (['added', 'modified', 'removed', 'renamed'].includes(f.status ?? '')
          ? f.status
          : 'modified') as RemoteFileChange['status'];
        byPath.set('/' + f.filename, {
          path: '/' + f.filename,
          status,
          previousPath: f.previous_filename ? '/' + f.previous_filename : undefined,
        });
      }
    }
    return { commits, files: [...byPath.values()] };
  }

  async listCommits(
    token: string,
    fullName: string,
    branch: string,
    limit = 30,
  ): Promise<RemoteCommit[]> {
    const res = await fetch(
      `${this.api}/repos/${fullName}/commits?sha=${encodeURIComponent(branch)}&limit=${limit}&stat=false`,
      { headers: this.headers(token) },
    );
    if (!res.ok) throw new Error(`Failed to list commits (${res.status})`);
    const data: ForgejoCommit[] = await res.json();
    return data.map(toRemoteCommit);
  }

  async getFileAtRef(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<string | null> {
    const res = await fetch(
      `${this.api}/repos/${fullName}/raw/${encPath(repoPath(path))}?ref=${encodeURIComponent(ref)}`,
      { headers: this.headers(token) },
    );
    if (!res.ok) return null;
    return res.text();
  }

  /** All blobs on a tree: path → blob sha (paginated, `truncated` flag) */
  private async listTree(
    token: string,
    fullName: string,
    treeSha: string,
  ): Promise<Map<string, string>> {
    const blobs = new Map<string, string>();
    for (let page = 1; page <= 50; page++) {
      const res = await fetch(
        `${this.api}/repos/${fullName}/git/trees/${treeSha}?recursive=true&page=${page}`,
        { headers: this.headers(token) },
      );
      if (!res.ok) throw new Error('Failed to fetch file tree');
      const data = await res.json();
      for (const item of data.tree ?? []) {
        if (item.type === 'blob') blobs.set(item.path, item.sha);
      }
      if (!data.truncated) break;
    }
    return blobs;
  }

  async pullFiles(
    token: string,
    fullName: string,
    branch: string,
  ): Promise<{ files: RepoFile[]; commitSha: string }> {
    const commitSha = await this.getBranchHead(token, fullName, branch);
    const tree = await this.listTree(token, fullName, commitSha);
    const paths = [...tree.keys()].filter(p => !isBinaryPath(p));
    const files = await Promise.all(
      paths.map(async (p): Promise<RepoFile | null> => {
        const content = await this.getFileAtRef(token, fullName, p, commitSha);
        return content === null ? null : { path: '/' + p, content, sha: tree.get(p)! };
      }),
    );
    return { files: files.filter((f): f is RepoFile => f !== null), commitSha };
  }

  async pushFiles(
    token: string,
    fullName: string,
    branch: string,
    files: FileEntry[],
    message: string,
  ): Promise<SyncResult> {
    // One atomic commit; updates must carry the existing blob's sha.
    const head = await this.getBranchHead(token, fullName, branch);
    const existing = await this.listTree(token, fullName, head);

    const changes = files.map(f => {
      const path = repoPath(f.path);
      const sha = existing.get(path);
      return {
        operation: sha ? ('update' as const) : ('create' as const),
        path,
        content: toBase64(f.content),
        ...(sha ? { sha } : {}),
      };
    });

    const res = await fetch(`${this.api}/repos/${fullName}/contents`, {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({ branch, message, files: changes }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to push: ${err}`);
    }
    const data = await res.json();
    const sha = data.commit?.sha ?? '';
    return {
      commitSha: sha,
      commitUrl: data.commit?.html_url ?? `${this.webBase}/${fullName}/commit/${sha}`,
      filesChanged: files.length,
    };
  }

  async addReltechTopic(token: string, fullName: string): Promise<void> {
    await fetch(`${this.api}/repos/${fullName}/topics/relational-tech`, {
      method: 'PUT',
      headers: this.headers(token),
    });
  }
}
