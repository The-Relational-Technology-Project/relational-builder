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

import { forgeClient, type ForgeId, type ForgeRepo, type RepoImagePull } from './forge';
import { usableRepoFiles } from './remix';
import { SAFE_COPY_BRANCH } from './promote';
import { compressBase64Image } from './assets';
import { imageMimeFor } from './app-icon';
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

/**
 * Image budgets. The workspace lives in localStorage (and every checkpoint
 * copies it), so images come in preview-sized: originals up to the fetch cap
 * are pulled and re-compressed under the per-file cap when needed; the total
 * budget keeps a photo-heavy repo from swamping the store. Anything past a
 * cap shows as a placeholder in the preview — the repo (and the live site
 * built from it) always keeps the real files.
 */
const IMAGE_FETCH_CAP = 2 * 1024 * 1024;
const IMAGE_FILE_CAP = 400 * 1024;
const IMAGE_TOTAL_CAP = 2.5 * 1024 * 1024;

export interface ImportResult {
  repoName: string;
  fileCount: number;
  skipped: number;
}

export async function importRepoAsProject(
  forge: ForgeId,
  repo: ForgeRepo,
  options: {
    /**
     * The app is live for its community: sync through a safe-copy branch,
     * and only the Publish button ever moves the branch the site deploys
     * from. False = the original posture, straight onto the default branch.
     */
    safeCopy: boolean;
  },
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

  // Images too, where the forge supports it — an imported app should look
  // like itself, not like a wall of broken-image errors. Never fatal: a
  // repo whose images can't come along still imports as code.
  let imagePull: RepoImagePull = { images: [], skipped: [] };
  if (client.pullImages) {
    try {
      imagePull = await client.pullImages(token, repo.fullName, repo.defaultBranch, {
        maxFileBytes: IMAGE_FETCH_CAP,
      });
    } catch {
      // e.g. rate-limited mid-walk — treated the same as an unsupported forge
    }
  }
  const imageEntries: { path: string; base64: string; bytes: number }[] = [];
  const imagesSkipped = [...imagePull.skipped];
  let imageBudget = IMAGE_TOTAL_CAP;
  for (const img of imagePull.images) {
    let b64 = img.base64;
    let bytes = img.bytes;
    if (bytes > IMAGE_FILE_CAP) {
      const shrunk = await compressBase64Image(b64, imageMimeFor(img.path), IMAGE_FILE_CAP);
      if (shrunk === null) {
        imagesSkipped.push(img.path);
        continue;
      }
      b64 = shrunk;
      bytes = Math.round(shrunk.length * 0.75);
    }
    if (bytes > imageBudget) {
      imagesSkipped.push(img.path);
      continue;
    }
    imageBudget -= bytes;
    imageEntries.push({ path: img.path, base64: b64, bytes });
  }

  // Mint the safe copy BEFORE touching the workspace: if the token can't
  // create branches, the import fails whole rather than half-connected.
  // (A leftover safe copy from an abandoned import is moved here — a fresh
  // import means "start from the live version, now".)
  if (options.safeCopy) {
    await client.createBranch(token, repo.fullName, SAFE_COPY_BRANCH, commitSha);
  }

  const now = Date.now();
  const entries = kept.map(f => ({
    path: f.path,
    content: f.content,
    language: f.path.split('.').pop() ?? 'text',
    createdAt: now,
    updatedAt: now,
  }));
  // Binary images ride the same VFS convention as generated app icons:
  // bare base64 under a binary extension (see app-icon.ts). They stay out
  // of pushes and prompts; the preview bundler serves them as data URLs.
  const imageFileEntries = imageEntries.map(img => ({
    path: img.path,
    content: img.base64,
    language: 'base64',
    createdAt: now,
    updatedAt: now,
  }));

  // A fresh workspace, never destructive: open work goes to the shelf (cloud
  // projects are already saved), and the import starts clean
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useEnvStore.getState().clearAll();
  useProjectStore.getState().hydrateFiles([...entries, ...imageFileEntries], {
    source: 'repo-import',
    sourceUrl: repo.htmlUrl,
    importedAt: new Date(now).toISOString(),
  });

  const repoName = repo.fullName.split('/')[1] ?? repo.fullName;
  const skipped = files.length - kept.length;

  // Images that couldn't come along are the classic import mystery — the
  // preview shows placeholders and the person wonders if their site broke.
  // Say what happened and, more important, what did NOT happen: the repo
  // and the live site still have every original file.
  const skippedNames = imagesSkipped.map(p => `\`${p.split('/').pop()}\``);
  const imageNote =
    imagesSkipped.length > 0
      ? [
          '',
          `**About images:** ${
            imageFileEntries.length > 0
              ? `${imageFileEntries.length} came in with the code, but `
              : ''
          }${imagesSkipped.length === 1 ? `one (${skippedNames[0]}) was` : `${imagesSkipped.length} (${
            skippedNames.length <= 4 ? skippedNames.join(', ') : skippedNames.slice(0, 3).join(', ') + ', …'
          }) were`} too large to preview here, so the preview shows a placeholder in ${
            imagesSkipped.length === 1 ? 'its' : 'their'
          } place. **Your repo and live site still have the real ${
            imagesSkipped.length === 1 ? 'image' : 'images'
          }** — publishing from here never removes them.`,
        ]
      : [];

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

  const modeNote = options.safeCopy
    ? `**Your live site is protected.** It keeps following \`${repo.defaultBranch}\`, and nothing there changes by itself. ` +
      'Your edits save to a separate safe copy, and when you like what you see, press ' +
      '**Publish to your live site** in the repo panel (top right). Changes made elsewhere — Claude Code, a collaborator — still flow in here automatically.'
    : `If this repo deploys to production, know that synced changes land on \`${repo.defaultBranch}\` — ` +
      'you can switch off automatic sync in the repo panel (top right) to review and push by hand instead.';

  useChatStore.getState().hydrateChat(
    [
      {
        id: `msg-import-${now}`,
        role: 'assistant',
        content: [
          `Imported **${repo.fullName}** — ${kept.length} files${
            imageFileEntries.length > 0
              ? ` and ${imageFileEntries.length} image${imageFileEntries.length === 1 ? '' : 's'}`
              : ''
          } are in your workspace, and the repo is connected for two-way sync${options.safeCopy ? ' through a safe copy' : ''}.`,
          '',
          'From here it works like any Builder project: changes you make here push to the repo on their own, and commits from Claude Code, an editor, or a collaborator come back in with a summary in chat.',
          ...imageNote,
          ...settingsNote,
          '',
          modeNote,
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
  // point, so the "where should this start?" question never needs asking.
  // In safe-copy mode sync reads and writes the safe copy; the live branch
  // is recorded so publish and the fold check know where the site lives.
  const key = projectRepoKey();
  useSyncStore.getState().connectRepo(key, {
    forge,
    baseUrl: baseUrl || undefined,
    fullName: repo.fullName,
    branch: options.safeCopy ? SAFE_COPY_BRANCH : repo.defaultBranch,
    htmlUrl: repo.htmlUrl,
    lastSyncSha: commitSha,
    ...(options.safeCopy
      ? { liveBranch: repo.defaultBranch, lastLiveSha: commitSha }
      : {}),
  });
  const connected = connectedRepoForCurrentProject();
  if (connected) {
    useSyncStore
      .getState()
      .recordPush(key, commitSha, fingerprintFiles(filesForPush(connected)));
  }

  return { repoName: repo.fullName, fileCount: kept.length, skipped };
}
