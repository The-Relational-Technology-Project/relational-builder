/**
 * Safe-copy mode's three verbs, all server-side merges — no git vocabulary
 * ever reaches the builder.
 *
 * An imported LIVE app syncs to a safe-copy branch; the branch its site
 * deploys from only moves when a person presses "Publish to your live
 * site". The other direction stays automatic: commits landing on the live
 * branch (Claude Code, a collaborator, a hotfix) are folded into the safe
 * copy when they merge cleanly, and become a question — never a silent
 * overwrite — when they collide.
 */

import {
  clientForRepo,
  connectedRepoForCurrentProject,
  projectRepoKey,
  pullRemoteChanges,
  pushToRepo,
  tokenForRepo,
} from './code-sync';
import { useSyncStore } from '@/store/sync-store';
import { useChatStore } from '@/store/chat-store';

/** The safe copy's branch name — visible on the forge, so it explains itself */
export const SAFE_COPY_BRANCH = 'relational-builder';

export interface PublishOutcome {
  /**
   * published: the live branch has the changes · up-to-date: it already did ·
   * held: the safe copy has unpulled changes (pull first) · conflict: live
   * moved in colliding ways — the sync panel takes over
   */
  status: 'published' | 'up-to-date' | 'held' | 'conflict';
}

/**
 * The one deliberate action of safe-copy mode: push whatever has settled in
 * the workspace to the safe copy, then merge the safe copy into the live
 * branch. The person's click IS the confirmation — this does the whole thing.
 */
export async function publishToLive(): Promise<PublishOutcome> {
  const repo = connectedRepoForCurrentProject();
  if (!repo?.liveBranch) throw new Error('This project has no live branch to publish to');
  const token = tokenForRepo(repo);
  if (!token) throw new Error('No repository connected');
  const client = clientForRepo(repo);
  const key = projectRepoKey();
  const store = useSyncStore.getState();

  // What you see is what ships: any settled workspace changes go to the
  // safe copy first, so publish never sends a stale version.
  const push = await pushToRepo();
  if (push.status === 'held') return { status: 'held' };

  const result = await client.mergeBranch(token, repo.fullName, repo.liveBranch, repo.branch);
  if (result.status === 'conflict') {
    store.setLiveConflict(true);
    return { status: 'conflict' };
  }

  const liveHead =
    result.sha ?? (await client.getBranchHead(token, repo.fullName, repo.liveBranch));
  store.updateLastLive(key, liveHead);
  store.setUnpublished(key, false);

  if (result.status === 'merged') {
    // The ship moment belongs in the project's story
    useChatStore
      .getState()
      .addSyncMessage(
        `🚀 **Published to your live site** — \`${repo.liveBranch}\` on **${repo.fullName}** now has your changes. ` +
          'If your host deploys automatically, give it a minute to rebuild.',
      );
  }
  return { status: result.status === 'merged' ? 'published' : 'up-to-date' };
}

/**
 * The automatic direction: when the live branch has commits the safe copy
 * hasn't seen, merge them in server-side. On a clean merge the safe copy
 * moves, and the ordinary remote-check/pull machinery brings the files into
 * the workspace with its usual checkpoint and chat summary. On a collision,
 * raise the conflict flag and stop — a person decides from here.
 *
 * Never throws: this runs on every remote check, and a transient network
 * failure should mean "try again next check", not an error banner.
 */
export async function foldLiveChanges(): Promise<void> {
  const repo = connectedRepoForCurrentProject();
  if (!repo?.liveBranch) return;
  const sync = useSyncStore.getState();
  if (sync.liveConflict) return; // waiting on the person's call
  const token = tokenForRepo(repo);
  if (!token) return;
  const client = clientForRepo(repo);

  try {
    const liveHead = await client.getBranchHead(token, repo.fullName, repo.liveBranch);
    if (liveHead === repo.lastLiveSha) return;

    const result = await client.mergeBranch(token, repo.fullName, repo.branch, repo.liveBranch);
    if (result.status === 'conflict') {
      useSyncStore.getState().setLiveConflict(true);
      return;
    }
    useSyncStore.getState().updateLastLive(projectRepoKey(), liveHead);
  } catch {
    // Quiet — the next remote check retries
  }
}

/**
 * The conflict escape hatch a non-technical builder can actually use:
 * "the live version wins." Moves the safe copy to the live branch's head
 * and pulls — the pull takes a checkpoint first, so the colliding work
 * here stays one tap away.
 */
export async function resetSafeCopyToLive(): Promise<void> {
  const repo = connectedRepoForCurrentProject();
  if (!repo?.liveBranch) throw new Error('This project has no live branch');
  const token = tokenForRepo(repo);
  if (!token) throw new Error('No repository connected');
  const client = clientForRepo(repo);
  const key = projectRepoKey();

  const liveHead = await client.getBranchHead(token, repo.fullName, repo.liveBranch);
  await client.createBranch(token, repo.fullName, repo.branch, liveHead);
  const store = useSyncStore.getState();
  store.updateLastLive(key, liveHead);
  store.setUnpublished(key, false);
  store.setLiveConflict(false);
  // The safe copy's history was rewritten on purpose — this pull sees that,
  // overlays the live version, and says so in chat (checkpoint taken first)
  await pullRemoteChanges();
}
