import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import {
  useCloudStore,
  readCloudAttachment,
  clearCloudAttachment,
} from '@/store/cloud-store';
import { saveCurrentLocally } from '@/project/local-projects';

/**
 * Auto-save: when a cloud project is open, debounce workspace changes
 * (files, chat, mode, lineage) into a cloud save. Remote updates set
 * `applyingRemote` so they don't echo back as saves.
 *
 * Also owns resuming the attached cloud project after a reload — the
 * attachment survives in localStorage, so once auth settles the same
 * project re-opens instead of the workspace silently going "local" and
 * forking under a new name.
 */

const DEBOUNCE_MS = 1500;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;

function scheduleSave() {
  const cloud = useCloudStore.getState();
  if (!cloud.currentProjectId || cloud.applyingRemote) return;
  // Don't snapshot mid-stream — save when the message finalizes
  if (useChatStore.getState().isGenerating) return;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    useCloudStore.getState().saveNow();
  }, DEBOUNCE_MS);
}

/** Resume the attached project once a user is present; if auth settles with
 *  no session, the resume will never come — hand the workspace to the local
 *  shelf under the project's real name so nothing forks under a guessed one. */
function onAuthChanged() {
  if (!readCloudAttachment() || useCloudStore.getState().currentProjectId) return;
  const auth = useAuthStore.getState();
  if (auth.user) {
    void useCloudStore.getState().resumeProject();
  } else if (auth.initialized && auth.profileLoaded) {
    const name = readCloudAttachment()?.name;
    clearCloudAttachment();
    saveCurrentLocally(name);
  }
}

export function initCloudSync() {
  if (started) return;
  started = true;

  useAuthStore.subscribe(onAuthChanged);
  onAuthChanged();

  useProjectStore.subscribe((state, prev) => {
    if (state.version !== prev.version || state.lineage !== prev.lineage) {
      scheduleSave();
    }
  });

  useChatStore.subscribe((state, prev) => {
    if (state.messages !== prev.messages || state.mode !== prev.mode) {
      // Skip token-by-token streaming updates; save once generation finishes
      if (state.isGenerating) return;
      scheduleSave();
    }
  });
}
