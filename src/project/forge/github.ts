/**
 * GitHub forge client — a thin adapter over the existing Git Data API
 * implementation in `../github-api` (which also serves unauthenticated
 * public-repo remixing and keeps its own exported functions).
 */

import type { FileEntry } from '../virtual-fs';
import type { ForgeClient, ForgeRepo, CompareResult, MergeOutcome, RemoteCommit, RepoFile, RepoImagePull, SyncResult } from './types';
import * as gh from '../github-api';

function toForgeRepo(repo: gh.GitHubRepo): ForgeRepo {
  return {
    fullName: repo.full_name,
    defaultBranch: repo.default_branch,
    htmlUrl: repo.html_url,
    private: repo.private,
  };
}

export class GitHubClient implements ForgeClient {
  readonly forge = 'github' as const;

  getUser(token: string): Promise<string> {
    return gh.getUser(token);
  }

  async listRepos(token: string): Promise<ForgeRepo[]> {
    return (await gh.listRepos(token)).map(toForgeRepo);
  }

  async createRepo(token: string, name: string, description = ''): Promise<ForgeRepo> {
    return toForgeRepo(await gh.createRepo(token, name, description));
  }

  getBranchHead(token: string, fullName: string, branch: string): Promise<string> {
    return gh.getBranchHead(token, fullName, branch);
  }

  compareCommits(
    token: string,
    fullName: string,
    base: string,
    head: string,
  ): Promise<CompareResult | null> {
    return gh.compareCommits(token, fullName, base, head);
  }

  listCommits(
    token: string,
    fullName: string,
    branch: string,
    limit?: number,
  ): Promise<RemoteCommit[]> {
    return gh.listCommits(token, fullName, branch, limit);
  }

  getFileAtRef(
    token: string,
    fullName: string,
    path: string,
    ref: string,
  ): Promise<string | null> {
    return gh.getFileAtRef(token, fullName, path, ref);
  }

  async pullFiles(
    token: string,
    fullName: string,
    branch: string,
  ): Promise<{ files: RepoFile[]; commitSha: string }> {
    const { files, commitSha } = await gh.pullFiles(token, fullName, branch);
    return { files, commitSha };
  }

  pullImages(
    token: string,
    fullName: string,
    branch: string,
    opts: { maxFileBytes: number },
  ): Promise<RepoImagePull> {
    return gh.pullImages(token, fullName, branch, opts);
  }

  pushFiles(
    token: string,
    fullName: string,
    branch: string,
    files: FileEntry[],
    message: string,
  ): Promise<SyncResult> {
    return gh.pushFiles(token, fullName, branch, files, message);
  }

  createBranch(token: string, fullName: string, branch: string, fromSha: string): Promise<void> {
    return gh.createBranch(token, fullName, branch, fromSha);
  }

  mergeBranch(token: string, fullName: string, base: string, head: string): Promise<MergeOutcome> {
    return gh.mergeBranch(token, fullName, base, head);
  }

  addReltechTopic(token: string, fullName: string): Promise<void> {
    return gh.addReltechTopic(token, fullName);
  }
}
