import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useAuthStore } from '@/store/auth-store';
import {
  useCloudStore, readCloudAttachment,
  notepadColumnKnownMissing, markNotepadColumnMissing,
} from '@/store/cloud-store';
import { useNotepadStore } from '@/store/notepad-store';
import { useLocalProjects } from '@/project/local-projects';
import { builderClient } from '@/cloud/builder-client';

/**
 * Auto-save: when a cloud project is open, debounce workspace changes
 * (files, chat, mode, lineage) into a cloud save. Remote updates set
 * `applyingRemote` so they don't echo back as saves.
 *
 * Also owns resuming the attached cloud project after a reload. The
 * attachment survives in localStorage and holds even while signed out —
 * sync is merely paused, and the SAME project resumes on the next sign-in.
 * Nothing here ever hands a cloud project's workspace to the device shelf:
 * shelving and later re-uploading is exactly how duplicate cloud rows used
 * to be minted.
 */

const DEBOUNCE_MS = 1500;
let timer: ReturnType<typeof setTimeout> | null = null;
let started = false;
let migrated = false;

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

/** Resume the attached project once a user is present. While signed out the
 *  attachment simply waits — edits keep living in the persisted workspace,
 *  and the resume reconciles them (local-newer pushes up, remote-newer pulls
 *  down) instead of forking the project under a new id. */
function onAuthChanged() {
  const auth = useAuthStore.getState();
  if (!auth.user) return;
  if (readCloudAttachment() && !useCloudStore.getState().currentProjectId) {
    void useCloudStore.getState().resumeProject();
  }
  void migrateShelfToCloud();
}

/**
 * One-time move of device-shelf projects onto the account: signed-in
 * builders shouldn't have a second, device-bound library. Each shelf slot
 * becomes a real cloud project — except slots whose name already matches a
 * cloud project: those are almost certainly stale forks of it (the old
 * detach/sign-out flows minted them), and uploading them would create yet
 * another duplicate. They stay untouched in localStorage as a quiet backup.
 */
export async function migrateShelfToCloud(): Promise<void> {
  if (migrated || !builderClient) return;
  const user = useAuthStore.getState().user;
  if (!user) return;
  migrated = true;

  const { shelf, currentId } = useLocalProjects.getState();
  // The open workspace's slot belongs to the live promotion path, not here
  const slots = shelf.filter(m => m.id !== currentId);
  if (slots.length === 0) return;

  await useCloudStore.getState().refreshProjects();
  const cloudNames = new Set(
    useCloudStore.getState().projects.map(p => p.name.trim().toLowerCase()),
  );

  for (const meta of slots) {
    if (cloudNames.has(meta.name.trim().toLowerCase())) continue;
    let snapshot: {
      name: string; files: unknown; chat: unknown; mode: unknown; lineage: unknown;
      notepad?: unknown;
    } | null = null;
    try {
      const raw = localStorage.getItem(`rb-local-project:${meta.id}`);
      snapshot = raw ? JSON.parse(raw) : null;
    } catch {
      continue;
    }
    if (!snapshot) continue;

    const insertRow = (withNotepad: boolean) =>
      builderClient!.from('projects').insert({
        owner_id: user.id,
        name: meta!.name,
        files: snapshot!.files ?? [],
        chat: snapshot!.chat ?? [],
        mode: snapshot!.mode ?? 'build',
        lineage: snapshot!.lineage ?? null,
        ...(withNotepad ? { notepad: snapshot!.notepad ?? null } : {}),
        updated_by: user.id,
      });
    let { error } = await insertRow(!notepadColumnKnownMissing());
    if (error && /notepad/i.test(error.message) && /column|schema/i.test(error.message)) {
      markNotepadColumnMissing();
      ({ error } = await insertRow(false));
    }
    if (error) {
      // Offline or rejected — leave the slot for a later session
      migrated = false;
      continue;
    }
    const { deleteLocalProject } = await import('@/project/local-projects');
    deleteLocalProject(meta.id);
  }
  await useCloudStore.getState().refreshProjects();
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

  useNotepadStore.subscribe((state, prev) => {
    if (state.notes !== prev.notes || state.story !== prev.story) {
      scheduleSave();
    }
  });
}
