/**
 * Import an existing repo as a Relational Builder project — the door for
 * work that started somewhere else (Lovable, another builder, a plain
 * editor) and is moving here.
 *
 * Remix (remix.ts) forks: it copies a public repo's code and the connection
 * ends there. Import connects: the repo's code becomes a fresh RB project
 * named after the repo, and the repo is wired up for two-way sync in the
 * same motion — edits here push back, commits from anywhere else pull in.
 * The pulled tree is recorded as already-synced, so importing never bounces
 * an unchanged project straight back at the repo as a commit.
 */

import { forgeClient, type ForgeId, type ForgeRepo } from './forge';
import { usableRepoFiles } from './remix';
import { stashAndStartFresh, saveCurrentLocally } from './local-projects';
import {
  projectRepoKey,
  connectedRepoForCurrentProject,
  filesForPush,
  fingerprintFiles,
  missingEnvKeys,
} from './code-sync';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useEnvStore } from '@/store/env-store';
import { useSyncStore } from '@/store/sync-store';

/** Bigger than remix's cap: this is someone's whole ongoing project, not a
 *  starting point to trim down */
const MAX_FILES = 300;

export interface ImportResult {
  repoName: string;
  fileCount: number;
  skipped: number;
}

export async function importRepoAsProject(
  forge: ForgeId,
  repo: ForgeRepo,
): Promise<ImportResult> {
  const sync = useSyncStore.getState();
  const token = sync.tokens[forge];
  if (!token) throw new Error('Connect your account first');
  const baseUrl = sync.instanceUrls[forge];
  const client = forgeClient(forge, baseUrl || undefined);

  const { files, commitSha } = await client.pullFiles(token, repo.fullName, repo.defaultBranch);
  const kept = usableRepoFiles(files, MAX_FILES);
  if (kept.length === 0) {
    throw new Error("That repo doesn't contain web app files the Builder can work with");
  }

  const now = Date.now();
  const entries = kept.map(f => ({
    path: f.path,
    content: f.content,
    language: f.path.split('.').pop() ?? 'text',
    createdAt: now,
    updatedAt: now,
  }));

  // A fresh workspace, never destructive: open work goes to the shelf (cloud
  // projects are already saved), and the import starts clean
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useEnvStore.getState().clearAll();
  useProjectStore.getState().hydrateFiles(entries, {
    source: 'repo-import',
    sourceUrl: repo.htmlUrl,
    importedAt: new Date(now).toISOString(),
  });

  const repoName = repo.fullName.split('/')[1] ?? repo.fullName;
  const skipped = files.length - kept.length;

  // An app that lived elsewhere brought its expectations with it — say up
  // front which settings it reads (import.meta.env.*, env.*) that have no
  // value here yet, so the preview failing to start is a to-do, not a mystery.
  const missing = missingEnvKeys(entries.map(e => e.content));
  const settingsNote =
    missing.length > 0 && missing.length <= 12
      ? [
          '',
          `**One thing before the preview runs:** this app reads ${missing.map(k => `\`${k}\``).join(', ')} ` +
            `and ${missing.length === 1 ? 'it has' : 'they have'} no value here yet. ` +
            'Add ' + (missing.length === 1 ? 'it' : 'them') + ' under **Services → Environment** ' +
            '(the same values the app already uses — public keys only; secrets stay out of the preview).',
        ]
      : [];

  useChatStore.getState().hydrateChat(
    [
      {
        id: `msg-import-${now}`,
        role: 'assistant',
        content: [
          `Imported **${repo.fullName}** — ${kept.length} files are in your workspace, and the repo is connected for two-way sync.`,
          '',
          'From here it works like any Builder project: changes you make here push to the repo on their own, and commits from Claude Code, an editor, or a collaborator come back in with a summary in chat.',
          ...settingsNote,
          '',
          `If this repo deploys to production, know that synced changes land on \`${repo.defaultBranch}\` — ` +
            'you can switch off automatic sync in the repo panel (top right) to review and push by hand instead.',
          '',
          'Tell me what you want to change first — or just ask me to walk you through what this app does.',
        ].join('\n'),
        timestamp: now,
      },
    ],
    'build',
  );

  // Name the project after its repo, minting the shelf slot now so the sync
  // connection keys to this project (signed in, the autosaver promotes both
  // to the account moments later)
  saveCurrentLocally(repoName);

  // Connected AND already synced: the pulled commit is the shared starting
  // point, so the "where should this start?" question never needs asking
  const key = projectRepoKey();
  useSyncStore.getState().connectRepo(key, {
    forge,
    baseUrl: baseUrl || undefined,
    fullName: repo.fullName,
    branch: repo.defaultBranch,
    htmlUrl: repo.htmlUrl,
    lastSyncSha: commitSha,
  });
  const connected = connectedRepoForCurrentProject();
  if (connected) {
    useSyncStore
      .getState()
      .recordPush(key, commitSha, fingerprintFiles(filesForPush(connected)));
  }

  return { repoName: repo.fullName, fileCount: kept.length, skipped };
}
