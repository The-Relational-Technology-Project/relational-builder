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
 * Pulling stays deliberate: bringing outside work in changes what's in front
 * of you, and that's worth a click.
 */

import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useSyncStore } from '@/store/sync-store';
import {
  connectedRepoForCurrentProject,
  projectRepoKey,
  pushToRepo,
  tokenForRepo,
} from './code-sync';

/** How long a change has to settle before it's pushed */
const SETTLE_MS = 6_000;
/** Retry gap when something is in the way (a build running, a pull applying) */
const RETRY_MS = 4_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;
let started = false;

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
  }
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
    if (state.repos !== prev.repos) schedule();
  });
}
