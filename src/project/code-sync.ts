/**
 * Two-way code sync with the project's connected repo — on GitHub, GitLab,
 * or a community's own Forgejo/Gitea instance.
 *
 * Changes made outside the Builder — in Claude Code, an editor, anywhere —
 * are a normal, supported part of building. This module notices them,
 * pulls them in safely (checkpoint first, only what changed, deletions
 * included), and tells the story in chat: what changed, who changed it,
 * and what — if anything — the builder still needs to do by hand.
 */

import { forgeClient, isBinaryPath, FORGES, type ForgeClient } from './forge';
import { mapLimit, FORGE_FETCH_CONCURRENCY } from './forge/concurrency';
import { useSyncStore, type ConnectedRepo, type RemoteChanges } from '@/store/sync-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useEnvStore } from '@/store/env-store';
import { generateManifest } from './export';
import { needsBuild, materializeSource } from './build-for-publish';
import type { FileEntry } from './virtual-fs';

/** The key this workspace's repo connection lives under */
export function projectRepoKey(): string {
  return useCloudStore.getState().currentProjectId ?? 'local';
}

export function connectedRepoForCurrentProject(): ConnectedRepo | null {
  return useSyncStore.getState().repos[projectRepoKey()] ?? null;
}

export function clientForRepo(repo: ConnectedRepo): ForgeClient {
  return forgeClient(repo.forge, repo.baseUrl);
}

export function tokenForRepo(repo: ConnectedRepo): string {
  return useSyncStore.getState().tokens[repo.forge] ?? '';
}

/** Display name of the forge a repo lives on ("GitHub", "GitLab", …) */
export function forgeNameForRepo(repo: ConnectedRepo): string {
  return FORGES[repo.forge].name;
}

// ── Remote check ──────────────────────────────────────────────────────

/**
 * What's on the repo that we haven't seen? Null means up to date.
 * Never throws — a failed check is treated as "nothing new".
 */
export async function checkRemoteChanges(): Promise<RemoteChanges | null> {
  const { setRemote, setCheckingRemote } = useSyncStore.getState();
  const repo = connectedRepoForCurrentProject();
  if (!repo) return null;
  const token = tokenForRepo(repo);
  if (!token) return null;
  const client = clientForRepo(repo);

  setCheckingRemote(true);
  try {
    const head = await client.getBranchHead(token, repo.fullName, repo.branch);
    if (repo.lastSyncSha === head) {
      setRemote(null);
      return null;
    }
    if (!repo.lastSyncSha) {
      // Connected but never synced — nothing to announce yet
      setRemote(null);
      return null;
    }
    const diff = await client.compareCommits(token, repo.fullName, repo.lastSyncSha, head);
    const remote: RemoteChanges = diff
      ? {
          headSha: head,
          aheadBy: diff.commits.length,
          commits: diff.commits.slice(-20),
          files: diff.files,
          fullResync: false,
        }
      : {
          // History rewritten (force push / rebase) — we can't diff
          headSha: head,
          aheadBy: 0,
          commits: [],
          files: [],
          fullResync: true,
        };
    // A diff with no commits and no files (e.g. we're actually ahead after
    // a push from elsewhere landed our own commit) — nothing to show
    if (!remote.fullResync && remote.aheadBy === 0 && remote.files.length === 0) {
      setRemote(null);
      return null;
    }
    setRemote(remote);
    return remote;
  } catch {
    return null;
  } finally {
    useSyncStore.getState().setCheckingRemote(false);
  }
}

// ── Pull ──────────────────────────────────────────────────────────────

export interface PullSummary {
  applied: string[];
  deleted: string[];
  /** Files where the Builder copy had also changed since last sync */
  overlaps: string[];
  commits: RemoteChanges['commits'];
  actions: string[];
  fullResync: boolean;
}

/** How many changed files we'll fetch the pre-change version of, to spot overlapping edits */
const OVERLAP_CHECK_CAP = 30;

/**
 * Pull what changed on the repo into the workspace. Takes a checkpoint
 * first, applies only the files the diff names (or overlays everything on
 * a full resync), removes deleted files, then posts a summary to chat with
 * any follow-up steps the builder needs to take by hand.
 */
export async function pullRemoteChanges(
  options: { automatic?: boolean } = {},
): Promise<PullSummary> {
  const sync = useSyncStore.getState();
  const repo = connectedRepoForCurrentProject();
  if (!repo) throw new Error('No repository connected');
  const token = tokenForRepo(repo);
  if (!token) throw new Error('No repository connected');
  const client = clientForRepo(repo);
  const key = projectRepoKey();
  const project = useProjectStore.getState();

  sync.setPulling(true);
  try {
    // Safety net: everything before the pull is one tap away
    if (project.getFileCount() > 0) {
      project.takeCheckpoint('Before repo pull');
    }

    const head = await client.getBranchHead(token, repo.fullName, repo.branch);
    const diff = repo.lastSyncSha
      ? await client.compareCommits(token, repo.fullName, repo.lastSyncSha, head)
      : null;

    const applied: string[] = [];
    const deleted: string[] = [];
    const overlaps: string[] = [];
    const changedContents: { path: string; status: string; content?: string }[] = [];

    if (diff) {
      // Targeted pull: only what the diff names
      const toFetch = diff.files.filter(
        f => f.status !== 'removed' && !isBinaryPath(f.path),
      );

      // Spot overlapping edits: the Builder copy differs from the version
      // both sides started from — the repo version will win, but say so.
      const overlapCandidates = toFetch
        .filter(f => project.getFile(f.path))
        .slice(0, OVERLAP_CHECK_CAP);
      await mapLimit(overlapCandidates, FORGE_FETCH_CONCURRENCY, async f => {
        const base = await client.getFileAtRef(token, repo.fullName, f.path, repo.lastSyncSha!);
        const local = useProjectStore.getState().getFile(f.path)?.content;
        if (base !== null && local !== undefined && local !== base) {
          overlaps.push(f.path);
        }
      });

      // All-or-nothing: a fetch that fails throws (see getFileAtRef), which
      // aborts the pull before anything is applied and before the sync point
      // advances. Skipping failed files and recording the head anyway made
      // them vanish from every future diff — silent data loss.
      const contents = await mapLimit(toFetch, FORGE_FETCH_CONCURRENCY, async f => ({
        file: f,
        content: await client.getFileAtRef(token, repo.fullName, f.path, head),
      }));
      const store = useProjectStore.getState();
      for (const { file, content } of contents) {
        if (content === null) continue; // genuinely absent or not text — leave it to the repo
        if (file.status === 'renamed' && file.previousPath && store.getFile(file.previousPath)) {
          store.deleteFile(file.previousPath);
          deleted.push(file.previousPath);
        }
        store.writeFile(file.path, content);
        applied.push(file.path);
        changedContents.push({ path: file.path, status: file.status, content });
      }
      for (const f of diff.files.filter(f => f.status === 'removed')) {
        if (store.getFile(f.path)) {
          store.deleteFile(f.path);
          deleted.push(f.path);
        }
        changedContents.push({ path: f.path, status: 'removed' });
      }
    } else {
      // First sync or rewritten history: overlay the whole repo. Local files
      // the repo doesn't have are kept — pulling never silently deletes work.
      const result = await client.pullFiles(token, repo.fullName, repo.branch);
      const store = useProjectStore.getState();
      for (const file of result.files) {
        if (isBinaryPath(file.path)) continue;
        const local = store.getFile(file.path);
        if (local?.content === file.content) continue; // unchanged
        store.writeFile(file.path, file.content);
        applied.push(file.path);
        changedContents.push({ path: file.path, status: 'modified', content: file.content });
      }
    }

    const remote = sync.remote;
    const actions = analyzeActionsNeeded(changedContents);
    const summary: PullSummary = {
      applied,
      deleted,
      overlaps,
      commits: diff?.commits.slice(-20) ?? remote?.commits ?? [],
      actions,
      fullResync: !diff,
    };

    // Level with the repo again: record what the workspace now holds as the
    // synced state, so automatic push stays quiet until something actually
    // changes here. Without this, every pull bounced straight back as a push.
    useSyncStore.getState().recordPush(key, head, fingerprintFiles(filesForPush(repo)));
    useSyncStore.getState().setRemote(null);

    // Tell the story in chat — the summary lives in history, so the AI
    // knows the project changed outside the Builder too.
    if (applied.length > 0 || deleted.length > 0) {
      useChatStore
        .getState()
        .addSyncMessage(buildSyncChatMessage(repo, summary, options.automatic === true));
    }

    return summary;
  } finally {
    useSyncStore.getState().setPulling(false);
  }
}

// ── Push ──────────────────────────────────────────────────────────────

/**
 * Everything a push sends: the project's runnable source (framework projects
 * carry the kit files they import plus a Vite scaffold, so a clone runs with
 * `npm install`) plus the `.reltech.yml` manifest the network watcher reads.
 */
export function filesForPush(repo: ConnectedRepo): FileEntry[] {
  const files = useProjectStore.getState().getAllFiles();
  if (files.length === 0) return [];

  const sourceFiles = needsBuild(files) ? materializeSource(files) : files;
  const out = [...sourceFiles];
  const hasManifest = files.some(f => f.path.replace(/^\//, '') === '.reltech.yml');
  if (!hasManifest) {
    const { lineage } = useProjectStore.getState();
    const repoName = repo.fullName.split('/')[1] ?? 'my-community-app';
    out.push({
      path: '.reltech.yml',
      content: generateManifest(repoName, lineage),
      language: 'yaml',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
  return out;
}

/**
 * A stable stand-in for "what this push would contain". Pushing an identical
 * tree still writes a commit on every forge, so a project that hasn't changed
 * must never reach the network — otherwise a reload, a tab switch, or an
 * autosave tick would each land an empty commit on someone's repo.
 */
export function fingerprintFiles(files: FileEntry[]): string {
  // djb2 over path + content, order-independent by sorting first
  let hash = 5381;
  const material = [...files]
    .sort((a, b) => a.path.localeCompare(b.path))
    // \u0000 / \u0001 as delimiters: file content can contain any printable
    // text, so the separators have to be characters it never holds
    .map(f => `${f.path}\u0000${f.content}`)
    .join('\u0001');
  for (let i = 0; i < material.length; i++) {
    hash = ((hash << 5) + hash + material.charCodeAt(i)) | 0;
  }
  return `${material.length.toString(36)}.${(hash >>> 0).toString(36)}`;
}

const DEFAULT_COMMIT_MESSAGE = 'Update from Relational Builder';

/**
 * What to call this commit, without asking. The last thing the builder asked
 * for is the truest one-line description of what changed — it's the sentence
 * that produced the code.
 */
export function autoCommitMessage(): string {
  const messages = useChatStore.getState().messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    const line = m.content.trim().split('\n').find(l => l.trim().length > 0);
    if (!line) break;
    const trimmed = line.trim().replace(/\s+/g, ' ');
    const summary = trimmed.length > 72 ? `${trimmed.slice(0, 69)}…` : trimmed;
    return `${summary} — via Relational Builder`;
  }
  return DEFAULT_COMMIT_MESSAGE;
}

export interface PushOutcome {
  /** pushed: a commit landed · unchanged: nothing to send · held: the repo moved ahead */
  status: 'pushed' | 'unchanged' | 'held';
  filesChanged?: number;
  commitSha?: string;
  /** How far ahead the repo is, when held */
  aheadBy?: number;
}

/**
 * Send the project to its repo. The one push path — the sync panel's "push
 * now" and the automatic sync behind it both come through here, so they can't
 * disagree about what gets sent or when it's safe to send it.
 *
 * Refuses by default when the repo has moved ahead of us: overwriting work
 * that landed from Claude Code or a collaborator is exactly the thing nobody
 * should be able to do by accident. `force` is the deliberate override.
 */
export async function pushToRepo(
  options: { message?: string; force?: boolean } = {},
): Promise<PushOutcome> {
  const repo = connectedRepoForCurrentProject();
  if (!repo) throw new Error('No repository connected');
  const token = tokenForRepo(repo);
  if (!token) throw new Error('No repository connected');
  const key = projectRepoKey();
  const store = useSyncStore.getState();

  const files = filesForPush(repo);
  if (files.length === 0) return { status: 'unchanged' };

  const fingerprint = fingerprintFiles(files);
  if (!options.force && store.pushedFingerprint[key] === fingerprint) {
    return { status: 'unchanged' };
  }

  if (!options.force) {
    const remote = await checkPushSafety();
    if (remote && (remote.aheadBy > 0 || remote.fullResync)) {
      return { status: 'held', aheadBy: remote.aheadBy };
    }
  }

  const result = await clientForRepo(repo).pushFiles(
    token,
    repo.fullName,
    repo.branch,
    files,
    options.message?.trim() || autoCommitMessage(),
  );
  useSyncStore.getState().recordPush(key, result.commitSha, fingerprint);
  return {
    status: 'pushed',
    filesChanged: result.filesChanged,
    commitSha: result.commitSha,
  };
}

// ── Push safety ───────────────────────────────────────────────────────

/**
 * Before pushing: is the repo ahead of what we last synced? Returns the
 * remote changes if so — the person should pull first (or consciously
 * push anyway).
 */
export async function checkPushSafety(): Promise<RemoteChanges | null> {
  const repo = connectedRepoForCurrentProject();
  if (!repo || !repo.lastSyncSha) return null;
  const token = tokenForRepo(repo);
  if (!token) return null;
  try {
    const head = await clientForRepo(repo).getBranchHead(token, repo.fullName, repo.branch);
    if (head === repo.lastSyncSha) return null;
    return await checkRemoteChanges();
  } catch {
    return null;
  }
}

// ── Follow-up analysis ────────────────────────────────────────────────

/** Env keys referenced in code: env.X, import.meta.env.X, process.env.X */
const ENV_REF_PATTERNS = [
  /\benv\.([A-Z][A-Z0-9_]{2,})/g,
  /import\.meta\.env\.([A-Z][A-Z0-9_]{2,})/g,
  /process\.env\.([A-Z][A-Z0-9_]{2,})/g,
];

/**
 * The tricky part of building in two places: after code arrives from the
 * repo, is there anything the Builder can't do automatically? These are
 * deterministic checks — no AI, no guessing — for the known seams.
 */
export function analyzeActionsNeeded(
  changes: { path: string; status: string; content?: string }[],
): string[] {
  const actions: string[] = [];
  const active = changes.filter(c => c.status !== 'removed');

  // Database migrations never run themselves
  const migrations = active.filter(c =>
    /supabase\/migrations\/.*\.sql$/i.test(c.path),
  );
  if (migrations.length > 0) {
    const supabaseUrl = useEnvStore.getState().getValue('SUPABASE_URL');
    const ref = supabaseUrl?.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
    const editorLink = ref
      ? ` ([open the SQL editor](https://supabase.com/dashboard/project/${ref}/sql/new))`
      : ' (Supabase dashboard → SQL editor)';
    actions.push(
      `**Run the new database migration${migrations.length > 1 ? 's' : ''}** — ` +
        `migration files don't run automatically. Paste ${migrations.length > 1 ? 'each one' : 'it'} ` +
        `into your Supabase SQL editor${editorLink} and run it: ` +
        migrations.map(m => `\`${m.path.replace(/^\//, '')}\``).join(', '),
    );
  }

  // Edge functions need a redeploy
  const fns = new Set(
    active
      .map(c => c.path.match(/supabase\/functions\/([^/]+)\//)?.[1])
      .filter((n): n is string => !!n),
  );
  if (fns.size > 0) {
    actions.push(
      `**Redeploy edge function${fns.size > 1 ? 's' : ''}** \`${[...fns].join('`, `')}\` — ` +
        `run \`supabase functions deploy ${[...fns][0]}\`${fns.size > 1 ? ' (and the others)' : ''} ` +
        `from wherever you edited the code.`,
    );
  }

  // New settings the workspace doesn't have values for
  const known = new Set(useEnvStore.getState().vars.map(v => v.key));
  const referenced = new Set<string>();
  for (const c of active) {
    if (!c.content) continue;
    for (const pattern of ENV_REF_PATTERNS) {
      for (const m of c.content.matchAll(pattern)) referenced.add(m[1]);
    }
  }
  const missing = [...referenced].filter(k => !known.has(k) && !isCommonFalsePositive(k));
  if (missing.length > 0 && missing.length <= 8) {
    actions.push(
      `**Add missing settings** — the new code references ` +
        `${missing.map(k => `\`${k}\``).join(', ')} but ${missing.length === 1 ? 'it has' : 'they have'} ` +
        `no value here yet. Add ${missing.length === 1 ? 'it' : 'them'} under Services → Environment.`,
    );
  }

  // Dependency changes — the preview reads package.json directly
  if (active.some(c => c.path.replace(/^\//, '') === 'package.json')) {
    actions.push(
      '**Dependencies changed** — the preview picks up `package.json` automatically; ' +
        'give it a moment to reload and check that the app still renders.',
    );
  }

  return actions;
}

/** Env-looking tokens that aren't settings */
function isCommonFalsePositive(key: string): boolean {
  return ['NODE_ENV', 'DEV', 'PROD', 'MODE', 'SSR', 'BASE_URL'].includes(key);
}

// ── Chat message ──────────────────────────────────────────────────────

const MAX_LISTED_FILES = 14;

function buildSyncChatMessage(
  repo: ConnectedRepo,
  summary: PullSummary,
  automatic = false,
): string {
  const lines: string[] = [];
  const repoName = repo.fullName.split('/')[1] ?? repo.fullName;
  const forgeName = forgeNameForRepo(repo);
  const many = summary.commits.length > 1;
  // An automatic pull changed the files under someone's hands. Say so in the
  // first breath — "came in on its own" is the difference between a tool that
  // keeps up and a workspace that moved for no visible reason.
  const arrived = automatic
    ? many ? 'and came in on their own' : 'and came in on its own'
    : many ? 'and were pulled in' : 'and was pulled in';

  if (summary.fullResync) {
    lines.push(
      `The Builder re-synced with **${repoName}** — the repo's history changed, so everything was refreshed from the current version.`,
    );
  } else if (summary.commits.length > 0) {
    const authors = [...new Set(summary.commits.map(c => c.author))];
    lines.push(
      `**${summary.commits.length} commit${summary.commits.length > 1 ? 's' : ''}** landed on ` +
        `**${repoName}** outside the Builder (by ${authors.join(', ')}) ${arrived}:`,
    );
    lines.push('');
    for (const c of summary.commits.slice(-8)) {
      lines.push(`- \`${c.sha.slice(0, 7)}\` ${c.message}`);
    }
    if (summary.commits.length > 8) {
      lines.push(`- …and ${summary.commits.length - 8} more`);
    }
  }

  lines.push('');
  const parts: string[] = [];
  if (summary.applied.length > 0) parts.push(`**${summary.applied.length} file${summary.applied.length > 1 ? 's' : ''} updated**`);
  if (summary.deleted.length > 0) parts.push(`**${summary.deleted.length} removed**`);
  lines.push(parts.join(', ') + ':');
  const listed = [...summary.applied.map(p => p), ...summary.deleted.map(p => `~~${p}~~`)];
  lines.push(
    listed.slice(0, MAX_LISTED_FILES).map(p => `\`${p.replace(/^\//, '')}\``).join(' · '),
  );
  if (listed.length > MAX_LISTED_FILES) {
    lines.push(`…and ${listed.length - MAX_LISTED_FILES} more.`);
  }

  if (summary.overlaps.length > 0) {
    lines.push('');
    lines.push(
      `> ⚠️ ${summary.overlaps.length === 1 ? 'One file' : `${summary.overlaps.length} files`} had Builder ` +
        `changes that hadn't been pushed — the ${forgeName} version won: ` +
        summary.overlaps.map(p => `\`${p.replace(/^\//, '')}\``).join(', ') +
        `. Everything from before the pull is saved as a checkpoint if you need it back.`,
    );
  }

  if (summary.actions.length > 0) {
    lines.push('');
    lines.push('**Before this all works, you may need to:**');
    for (const a of summary.actions) lines.push(`- ${a}`);
  } else {
    lines.push('');
    lines.push('Nothing else needed — the preview reflects the new code.');
  }

  if (automatic && summary.overlaps.length === 0) {
    lines.push('');
    lines.push(
      'Everything from just before this is saved as a checkpoint, if it turns out you wanted the older version.',
    );
  }

  return lines.join('\n');
}
