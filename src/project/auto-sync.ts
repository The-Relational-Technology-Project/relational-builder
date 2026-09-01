/**
 * Set it and forget it: a connected repo keeps itself up to date.
 *
 * Managing pushes was work the tool was handing back to the builder. You
 * connected a repo — that *was* the decision — and then had to remember to
 * open a panel, write a commit message, and press Push, every time, forever.
 * Miss it and the repo silently drifted; press it twice and you'd re-send a
 * push you'd already made.
 *
 * So the Builder pushes for you: a few quiet seconds after a change settles,
 * with a commit message taken from what you asked for. The rules it holds to:
 *
 * - **Never mid-build.** A push waits for generation to finish, so a commit
 *   is a whole change rather than half a file.
 * - **Never redundant.** An unchanged project doesn't reach the network —
 *   pushing an identical tree still writes a commit on every forge.
 * - **Never destructive.** If the repo moved ahead (Claude Code, a
 *   collaborator), the push holds and the pull banner takes over. Whose
 *   version wins is a person's call, not a timer's.
 * - **Never on someone else's first move.** A freshly connected repo with
 *   history we've never seen waits for the one-time "where do we start"
 *   choice in the sync panel.
 *
 * It goes the other way too. Commits pushed from Claude Code, an editor, or a
 * collaborator come back in on their own — with the plain-language summary in
 * chat, so the change that moved your files is visible rather than mysterious,
 * and a checkpoint taken first. The one condition: the workspace has to match
 * what was last pushed. If there are Builder edits the repo hasn't seen, whose
 * version wins is a person's call, and the banner asks instead.
 */

import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useSyncStore } from '@/store/sync-store';
import {
  checkRemoteChanges,
  connectedRepoForCurrentProject,
  filesForPush,
  fingerprintFiles,
  projectRepoKey,
  pullRemoteChanges,
  pushToRepo,
  tokenForRepo,
} from './code-sync';
import { foldLiveChanges } from './promote';

/** How long a change has to settle before it's pushed */
const SETTLE_MS = 6_000;
/** Retry gap when something is in the way (a build running, a pull applying) */
const RETRY_MS = 4_000;
/** Background check for work that landed on the repo elsewhere */
const REMOTE_POLL_MS = 2 * 60_000;
/** Re-check when the tab regains focus, at most this often */
const FOCUS_THROTTLE_MS = 20_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let started = false;
let lastRemoteCheck = 0;
let remoteInFlight = false;

/** Auto-push is on unless this project turned it off */
export function autoPushEnabled(key: string = projectRepoKey()): boolean {
  return useSyncStore.getState().autoPush[key] !== false;
}

function schedule(delay = SETTLE_MS): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void run();
  }, delay);
}

/** Push now if there's anything to push — the same path the timer takes */
export function syncNow(): void {
  schedule(0);
}

async function run(): Promise<void> {
  const repo = connectedRepoForCurrentProject();
  if (!repo || !tokenForRepo(repo)) return;
  if (!autoPushEnabled()) return;
  // A repo connected but never synced: the sync panel is asking whether to
  // start from the repo or from this project. Don't answer it for them.
  if (!repo.lastSyncSha) return;

  // Mid-build, mid-pull, or mid-push — come back when the dust settles
  if (
    useChatStore.getState().isGenerating ||
    useSyncStore.getState().pulling ||
    inFlight
  ) {
    schedule(RETRY_MS);
    return;
  }

  const sync = useSyncStore.getState();
  inFlight = true;
  sync.setPushStatus('pushing');
  try {
    const outcome = await pushToRepo();
    if (outcome.status === 'pushed') {
      useSyncStore.getState().setPushStatus('pushed');
    } else if (outcome.status === 'held') {
      // The pull banner is already telling this story — don't tell it twice
      useSyncStore.getState().setPushStatus('held');
    } else {
      useSyncStore.getState().setPushStatus('idle');
    }
  } catch (err) {
    useSyncStore
      .getState()
      .setPushStatus('error', err instanceof Error ? err.message : 'Push failed');
  } finally {
    inFlight = false;
    // Remote checks that ran while this push was in the air had to hold off.
    // Now that the workspace and the repo agree again, look once more — this
    // is the moment an automatic pull becomes safe.
    void checkRemote(true);
  }
}

/**
 * Fingerprinting the push set is a full materialization of the project —
 * kit merge, import scan, manifest synthesis, then hashing every file —
 * and canAutoPull runs on every tab focus and poll tick. Cache it on what
 * it actually depends on: the VFS version, the repo key, and lineage
 * (which feeds the manifest without bumping the version).
 */
let fpCache: { version: number; key: string; lineage: unknown; value: string } | null = null;
function currentFingerprint(repo: NonNullable<ReturnType<typeof connectedRepoForCurrentProject>>): string {
  const { version, lineage } = useProjectStore.getState();
  const key = projectRepoKey();
  if (fpCache && fpCache.version === version && fpCache.key === key && fpCache.lineage === lineage) {
    return fpCache.value;
  }
  const value = fingerprintFiles(filesForPush(repo));
  fpCache = { version, key, lineage, value };
  return value;
}

/**
 * Is it safe to bring the repo's version in without asking? Only when the
 * workspace is exactly what we last pushed (or holds nothing yet) — then a
 * pull can't cost anyone work. Any local edit the repo hasn't seen makes this
 * a decision, not a background task.
 */
function canAutoPull(): boolean {
  const repo = connectedRepoForCurrentProject();
  if (!repo || !repo.lastSyncSha) return false;
  if (!autoPushEnabled()) return false;

  const sync = useSyncStore.getState();
  if (sync.pulling || inFlight) return false;
  // Mid-build the files are moving under us — and the reply being written
  // assumes the code it just read
  if (useChatStore.getState().isGenerating) return false;

  const project = useProjectStore.getState();
  if (project.getFileCount() === 0) return true;

  const key = projectRepoKey();
  return sync.pushedFingerprint[key] === currentFingerprint(repo);
}

/**
 * Look for commits made elsewhere, and bring them in when that's safe. What
 * isn't safe stays on the banner as an offer — this never decides for someone
 * whose unpushed work is on the line.
 */
async function checkRemote(force = false): Promise<void> {
  const repo = connectedRepoForCurrentProject();
  if (!repo || !tokenForRepo(repo) || !repo.lastSyncSha) return;
  if (remoteInFlight) return;
  if (!force && Date.now() - lastRemoteCheck < FOCUS_THROTTLE_MS) return;
  lastRemoteCheck = Date.now();

  // Claim the banner before the network call when a pull is already known to
  // be safe — otherwise "3 new commits" flashes up for the second it takes to
  // bring them in on their own
  remoteInFlight = true;
  if (canAutoPull()) useSyncStore.getState().setAutoPulling(true);
  try {
    // Safe-copy mode: first fold anything new on the live branch into the
    // safe copy (clean merges only — collisions raise a flag and wait).
    // Whatever folded in is then ordinary remote change on our branch, and
    // the check below brings it into the workspace the usual way.
    await foldLiveChanges();
    const remote = await checkRemoteChanges();
    if (!remote) return;
    // Decided on conditions *now*, not on the snapshot from before the round
    // trip: a push finishing mid-check used to leave the banner standing for
    // changes that were perfectly safe to bring in a second later.
    if (!canAutoPull()) return;
    useSyncStore.getState().setAutoPulling(true);
    useSyncStore.getState().setPullError(null);
    await pullRemoteChanges({ automatic: true });
  } catch (err) {
    // The banner is still standing with its Pull button — say why the quiet
    // path didn't work rather than leaving it looking like nothing happened
    useSyncStore
      .getState()
      .setPullError(err instanceof Error ? err.message : 'Pull failed');
  } finally {
    remoteInFlight = false;
    useSyncStore.getState().setAutoPulling(false);
  }
}

/** Check the repo now — used when the sync panel or a person asks directly */
export function checkRemoteNow(): void {
  void checkRemote(true);
}

export function initAutoSync(): void {
  if (started) return;
  started = true;

  // Files changed — the ordinary case
  useProjectStore.subscribe((state, prev) => {
    if (state.version !== prev.version) schedule();
  });

  // A build just finished. Files land while the response streams, so the
  // last file's change often arrives before generation actually ends.
  useChatStore.subscribe((state, prev) => {
    if (prev.isGenerating && !state.isGenerating) schedule();
  });

  // A repo was connected, or a project with one was opened
  useSyncStore.subscribe((state, prev) => {
    if (state.repos !== prev.repos) {
      schedule();
      void checkRemote(true);
    }
  });

  // The other direction. Watching lives here rather than in the banner
  // component: work landing on the repo doesn't stop mattering because
  // someone happens to be looking at the Gallery.
  void checkRemote(true);
  window.addEventListener('focus', () => void checkRemote());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void checkRemote();
  });
  setInterval(() => void checkRemote(true), REMOTE_POLL_MS);
}
