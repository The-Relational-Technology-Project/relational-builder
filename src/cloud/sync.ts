import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';

/**
 * Auto-save: when a cloud project is open, debounce workspace changes
 * (files, chat, mode, lineage) into a cloud save. Remote updates set
 * `applyingRemote` so they don't echo back as saves.
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

export function initCloudSync() {
  if (started) return;
  started = true;

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
