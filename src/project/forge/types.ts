/**
 * Forge-neutral types for two-way code sync.
 *
 * A "forge" is anywhere a git repository lives — GitHub, GitLab, or a
 * community's own Forgejo/Gitea instance. Every forge client speaks the
 * same interface, so sync, pull banners, and the story timeline don't
 * care which one a project uses.
 */

import type { FileEntry } from '../virtual-fs';

export type ForgeId = 'github' | 'gitlab' | 'forgejo';

export interface ForgeRepo {
  fullName: string;
  defaultBranch: string;
  htmlUrl: string;
  private: boolean;
}

export interface RepoFile {
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

export interface CompareResult {
  commits: RemoteCommit[];
  files: RemoteFileChange[];
}

/**
 * How a server-side merge ended. A conflict is an OUTCOME here, not an
 * error — safe-copy mode treats "these two versions collide" as a question
 * for a person, and questions shouldn't arrive as exceptions.
 */
export interface MergeOutcome {
  status: 'merged' | 'up-to-date' | 'conflict';
  /** The base branch's new head after a merge; null otherwise */
  sha: string | null;
}

export interface ForgeClient {
  readonly forge: ForgeId;

  /** Validate a token and return the account's login name */
  getUser(token: string): Promise<string>;
  /** The user's repos, most recently active first */
  listRepos(token: string): Promise<ForgeRepo[]>;
  /** Create a repo (public, initialized so a branch ref exists) */
  createRepo(token: string, name: string, description?: string): Promise<ForgeRepo>;

  /** Latest commit SHA on a branch */
  getBranchHead(token: string, fullName: string, branch: string): Promise<string>;
  /**
   * What happened between two commits. Null when the base is unreachable
   * (history rewritten) or the forge can't produce a file-level diff —
   * callers fall back to a full resync, which is always safe.
   */
  compareCommits(
    token: string,
    fullName: string,
    base: string,
    head: string,
  ): Promise<CompareResult | null>;
  /** Recent commits on a branch, newest first */
  listCommits(
    token: string,
    fullName: string,
    branch: string,
    limit?: number,
  ): Promise<RemoteCommit[]>;
  /**
   * One file's text content at a ref; null only when the file is genuinely
   * absent (404) or not representable as text. Any other failure — rate
   * limit, server error, network — throws, so a failed fetch can never be
   * mistaken for a missing file.
   */
  getFileAtRef(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<string | null>;

  /** All text files on a branch (full resync / first pull) */
  pullFiles(
    token: string,
    fullName: string,
    branch: string,
  ): Promise<{ files: RepoFile[]; commitSha: string }>;
  /**
   * Push files as a single commit. Only adds and updates — never deletes
   * something that exists only in the repo.
   */
  pushFiles(
    token: string,
    fullName: string,
    branch: string,
    files: FileEntry[],
    message: string,
  ): Promise<SyncResult>;

  /**
   * Create a branch at a commit — or, if the branch already exists, move it
   * there. Both callers mean "this branch starts here now": a fresh import
   * minting its safe copy, or a reset back to the live version.
   */
  createBranch(token: string, fullName: string, branch: string, fromSha: string): Promise<void>;
  /**
   * Merge `head` into `base` on the server (no local git anywhere). Powers
   * safe-copy mode in both directions: publishing the safe copy to the live
   * branch, and folding live-branch commits back into the safe copy.
   */
  mergeBranch(token: string, fullName: string, base: string, head: string): Promise<MergeOutcome>;

  /** Tag the repo into the relational-tech commons (best-effort) */
  addReltechTopic(token: string, fullName: string): Promise<void>;
}

/** Display + connect-flow metadata per forge */
export interface ForgeMeta {
  id: ForgeId;
  name: string;
  /** Hosted default instance, or null when the user must supply one */
  defaultBaseUrl: string | null;
  /** Whether the connect form asks for an instance URL */
  needsInstanceUrl: boolean;
  tokenPlaceholder: string;
  /** Plain-language scope guidance for creating a token */
  tokenHelp: string;
  /** Where to create a token on a given instance */
  tokenUrl(baseUrl: string): string;
}

/** Extensions the virtual file system can't hold — skip when pulling */
const BINARY_EXT = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|eot|mp[34]|webm|wav|zip|gz|pdf)$/i;

export function isBinaryPath(path: string): boolean {
  return BINARY_EXT.test(path);
}

/** UTF-8 → base64 (btoa alone breaks on non-Latin-1 text) */
export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}
