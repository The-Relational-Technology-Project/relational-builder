import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore, type ProjectLineage } from '@/store/project-store';
import { useProviderStore } from '@/store/provider-store';
import { useChatStore, type ChatMode, type DisplayMessage } from '@/store/chat-store';
import { useNotepadStore, captureNotepad, type NotepadSnapshot } from '@/store/notepad-store';
import { useSyncStore } from '@/store/sync-store';
import type { FileEntry } from '@/project/virtual-fs';

export interface CloudProjectSummary {
  id: string;
  name: string;
  owner_id: string;
  updated_at: string;
}

export interface ProjectMember {
  project_id: string;
  email: string;
  user_id: string | null;
  role: string;
}

export type SyncStatus = 'idle' | 'saving' | 'saved' | 'error';

/**
 * The cloud attachment persists across reloads: which project owns the
 * workspace, and the server timestamp of the last snapshot we synced.
 * Without this, a refresh silently detached the open cloud project — the
 * workspace files survived (project-store persists them) but the local
 * autosaver adopted them as a NEW device-local project under a guessed
 * name, forking the builder's own work.
 */
interface CloudAttachment {
  id: string;
  name: string;
  /** projects.updated_at of the last write we made or update we applied */
  syncedAt: string | null;
}

const ATTACHMENT_KEY = 'rb-cloud-attachment';

export function readCloudAttachment(): CloudAttachment | null {
  try {
    const raw = localStorage.getItem(ATTACHMENT_KEY);
    return raw ? (JSON.parse(raw) as CloudAttachment) : null;
  } catch {
    return null;
  }
}

function writeAttachment(att: CloudAttachment | null) {
  if (att) localStorage.setItem(ATTACHMENT_KEY, JSON.stringify(att));
  else localStorage.removeItem(ATTACHMENT_KEY);
}

export function clearCloudAttachment() {
  writeAttachment(null);
}

/**
 * True when the workspace belongs to a cloud project — either one that's
 * open right now, or one whose attachment survived a reload. The local
 * shelf must never adopt such a workspace (that's how forks are minted).
 *
 * The attachment holds even while signed out: sync is merely paused, and
 * the same project resumes on the next sign-in. Anything else — shelving
 * the workspace and later re-uploading it — mints a duplicate cloud row.
 */
export function cloudProjectOwnsWorkspace(): boolean {
  if (useCloudStore.getState().currentProjectId) return true;
  return readCloudAttachment() !== null;
}

interface CloudProjectRow {
  id: string;
  name: string;
  owner_id: string;
  files: FileEntry[];
  chat: DisplayMessage[];
  mode: ChatMode;
  lineage: ProjectLineage | null;
  /** Notes + story (null on rows saved before the notepad existed) */
  notepad: NotepadSnapshot | null;
  updated_by: string | null;
  updated_at: string;
}

interface CloudState {
  /** The cloud project currently open in the workspace (null = local-only) */
  currentProjectId: string | null;
  currentProjectName: string;
  isOwner: boolean;
  projects: CloudProjectSummary[];
  members: ProjectMember[];
  syncStatus: SyncStatus;
  syncError: string | null;
  /** True while applying a remote update — suppresses the auto-save echo */
  applyingRemote: boolean;

  refreshProjects: () => Promise<void>;
  createProject: (name: string) => Promise<{ error: string | null }>;
  openProject: (id: string) => Promise<{ error: string | null }>;
  /** Re-open the attached cloud project after a reload — the workspace never
   *  silently becomes "local" again */
  resumeProject: () => Promise<void>;
  /** Detach the workspace from its cloud project. Flushes a final save by
   *  default — pass `{flush: false}` when the row is gone (delete). */
  closeProject: (opts?: { flush?: boolean }) => void;
  renameProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveNow: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  /** `note` is the sender's own words about why. An invitation with no
   *  context is a cold DM — the same thing the build guidance warns against
   *  in generated apps, and it applies to our own tool first. */
  inviteMember: (email: string, note?: string) => Promise<{ error: string | null }>;
  removeMember: (email: string) => Promise<void>;
}

/**
 * The `notepad` column ships with the Notepad feature — a production
 * database may not have run the migration yet
 * (`alter table public.projects add column if not exists notepad jsonb`).
 * The first save that fails over its absence flips this flag and retries
 * without it: cloud sync must never break over a note.
 */
let notepadColumnMissing = false;

export function notepadColumnKnownMissing(): boolean {
  return notepadColumnMissing;
}

export function markNotepadColumnMissing(): void {
  notepadColumnMissing = true;
}

function isMissingNotepadColumnError(message: string): boolean {
  return /notepad/i.test(message) && /column|schema/i.test(message);
}

/** Snapshot the current local workspace for cloud storage */
function captureWorkspace() {
  const project = useProjectStore.getState();
  const chat = useChatStore.getState();
  return {
    files: project.fs.toJSON(),
    chat: chat.messages.map(m => ({ ...m, isStreaming: false })),
    mode: chat.mode,
    lineage: project.lineage,
    notepad: captureNotepad(),
  };
}

/** Replace the local workspace with a cloud snapshot */
function applyWorkspace(row: CloudProjectRow) {
  useProjectStore.getState().hydrateFiles(row.files ?? [], row.lineage ?? null);
  useChatStore.getState().hydrateChat(row.chat ?? [], row.mode ?? 'build');
  useNotepadStore.getState().hydrateNotepad(
    row.notepad?.notes ?? [],
    row.notepad?.story ?? null,
  );
}

let channel: RealtimeChannel | null = null;
let resumeInFlight = false;

function unsubscribe() {
  if (channel) {
    builderClient?.removeChannel(channel);
    channel = null;
  }
}

function subscribeToProject(projectId: string) {
  if (!builderClient) return;
  unsubscribe();
  channel = builderClient
    .channel(`project-${projectId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
      payload => {
        const row = payload.new as CloudProjectRow;
        const me = useAuthStore.getState().user;
        // Ignore our own writes echoed back
        if (me && row.updated_by === me.id) return;
        useCloudStore.setState({ applyingRemote: true, currentProjectName: row.name });
        writeAttachment({ id: row.id, name: row.name, syncedAt: row.updated_at });
        try {
          applyWorkspace(row);
        } finally {
          // Give the store subscriptions a beat before re-enabling auto-save
          setTimeout(() => useCloudStore.setState({ applyingRemote: false }), 100);
        }
      },
    )
    .subscribe();
}

export const useCloudStore = create<CloudState>()((set, get) => ({
  currentProjectId: null,
  currentProjectName: '',
  isOwner: false,
  projects: [],
  members: [],
  syncStatus: 'idle',
  syncError: null,
  applyingRemote: false,

  refreshProjects: async () => {
    if (!builderClient) return;
    const { data, error } = await builderClient
      .from('projects')
      .select('id, name, owner_id, updated_at')
      .order('updated_at', { ascending: false });
    if (!error && data) set({ projects: data as CloudProjectSummary[] });
  },

  createProject: async (name: string) => {
    const user = useAuthStore.getState().user;
    if (!builderClient || !user) return { error: 'Sign in first' };

    const snapshot = captureWorkspace();
    const insertRow = (withNotepad: boolean) =>
      builderClient!
        .from('projects')
        .insert({
          owner_id: user.id,
          name,
          files: snapshot.files,
          chat: snapshot.chat,
          mode: snapshot.mode,
          lineage: snapshot.lineage,
          ...(withNotepad ? { notepad: snapshot.notepad } : {}),
          updated_by: user.id,
        })
        .select('id, name, owner_id, updated_at')
        .single();

    let { data, error } = await insertRow(!notepadColumnMissing);
    if (error && isMissingNotepadColumnError(error.message)) {
      markNotepadColumnMissing();
      ({ data, error } = await insertRow(false));
    }

    if (error) return { error: error.message };
    if (!data) return { error: 'Save failed' };

    // A repo connected while this was a local project follows it into the cloud
    useSyncStore.getState().moveRepo('local', data.id);

    set({
      currentProjectId: data.id,
      currentProjectName: data.name,
      isOwner: true,
      syncStatus: 'saved',
      syncError: null,
    });
    writeAttachment({ id: data.id, name: data.name, syncedAt: data.updated_at });
    subscribeToProject(data.id);
    await get().refreshProjects();
    await get().refreshMembers();
    return { error: null };
  },

  openProject: async (id: string) => {
    const user = useAuthStore.getState().user;
    if (!builderClient || !user) return { error: 'Sign in first' };

    // Whatever's open still owes the cloud its last debounced edits
    if (get().currentProjectId && get().currentProjectId !== id) await get().saveNow();

    const { data, error } = await builderClient
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return { error: error?.message ?? 'Project not found' };

    const row = data as CloudProjectRow;
    set({ applyingRemote: true });
    try {
      applyWorkspace(row);
    } finally {
      setTimeout(() => useCloudStore.setState({ applyingRemote: false }), 100);
    }
    set({
      currentProjectId: row.id,
      currentProjectName: row.name,
      isOwner: row.owner_id === user.id,
      syncStatus: 'saved',
      syncError: null,
    });
    writeAttachment({ id: row.id, name: row.name, syncedAt: row.updated_at });
    // Model pins are per project — opening a different one gets fresh defaults
    useProviderStore.getState().clearModelPin();
    subscribeToProject(row.id);
    await get().refreshMembers();
    return { error: null };
  },

  resumeProject: async () => {
    const user = useAuthStore.getState().user;
    const att = readCloudAttachment();
    if (!builderClient || !user || !att || get().currentProjectId || resumeInFlight) return;
    resumeInFlight = true;
    try {
      const { data, error } = await builderClient
        .from('projects')
        .select('*')
        .eq('id', att.id)
        .maybeSingle();
      // Transient failure (offline, cold start): keep the attachment — the
      // shelf stays hands-off — and retry until the project comes back
      if (error) {
        setTimeout(() => get().resumeProject(), 15_000);
        return;
      }
      if (!data) {
        // Deleted, or access revoked: the cloud copy is gone. Hand the
        // workspace to the local shelf under its real name — not a guess.
        writeAttachment(null);
        const { saveCurrentLocally } = await import('@/project/local-projects');
        saveCurrentLocally(att.name);
        return;
      }

      const row = data as CloudProjectRow;
      const localSnapshot = captureWorkspace();
      const localEmpty = localSnapshot.files.length === 0 && localSnapshot.chat.length === 0;
      const remoteNewer =
        // An empty workspace must never be pushed over a cloud copy with
        // real work in it, whatever the timestamps say
        localEmpty ||
        (att.syncedAt !== null
          ? Date.parse(row.updated_at) > Date.parse(att.syncedAt) + 1000
          : true); // can't date the local copy — the cloud is the source of truth

      set({
        currentProjectId: row.id,
        currentProjectName: row.name,
        isOwner: row.owner_id === user.id,
        syncStatus: 'saved',
        syncError: null,
      });
      writeAttachment({
        id: row.id,
        name: row.name,
        syncedAt: remoteNewer ? row.updated_at : att.syncedAt,
      });

      if (remoteNewer) {
        // Edited elsewhere since this device last synced — pull it in
        set({ applyingRemote: true });
        try {
          applyWorkspace(row);
        } finally {
          setTimeout(() => useCloudStore.setState({ applyingRemote: false }), 100);
        }
      } else {
        // The local workspace is the same or newer (last session's edits may
        // never have flushed) — push it up rather than pulling stale files down
        void get().saveNow();
      }
      subscribeToProject(row.id);
      await get().refreshMembers();
    } finally {
      resumeInFlight = false;
    }
  },

  closeProject: (opts?: { flush?: boolean }) => {
    // The debounced autosaver may still owe the row up to 1.5s of edits —
    // flush before detaching. saveNow snapshots the workspace synchronously,
    // so clearing state right after is safe.
    if (opts?.flush !== false && get().currentProjectId) void get().saveNow();
    unsubscribe();
    writeAttachment(null);
    set({
      currentProjectId: null,
      currentProjectName: '',
      isOwner: false,
      members: [],
      syncStatus: 'idle',
      syncError: null,
    });
  },

  renameProject: async (name: string) => {
    const { currentProjectId } = get();
    if (!builderClient || !currentProjectId) return;
    await builderClient.from('projects').update({ name }).eq('id', currentProjectId);
    set({ currentProjectName: name });
    const att = readCloudAttachment();
    if (att?.id === currentProjectId) writeAttachment({ ...att, name });
    await get().refreshProjects();
  },

  deleteProject: async (id: string) => {
    if (!builderClient) return;
    await builderClient.from('projects').delete().eq('id', id);
    // No flush — a farewell save would just error against the deleted row
    if (get().currentProjectId === id) get().closeProject({ flush: false });
    await get().refreshProjects();
  },

  saveNow: async () => {
    const { currentProjectId, applyingRemote } = get();
    const user = useAuthStore.getState().user;
    if (!builderClient || !currentProjectId || !user || applyingRemote) return;

    set({ syncStatus: 'saving' });
    const snapshot = captureWorkspace();
    const updateRow = (withNotepad: boolean) =>
      builderClient!
        .from('projects')
        .update({
          files: snapshot.files,
          chat: snapshot.chat,
          mode: snapshot.mode,
          lineage: snapshot.lineage,
          ...(withNotepad ? { notepad: snapshot.notepad } : {}),
          updated_by: user.id,
        })
        .eq('id', currentProjectId)
        .select('updated_at')
        .single();

    let { data, error } = await updateRow(!notepadColumnMissing);
    if (error && isMissingNotepadColumnError(error.message)) {
      markNotepadColumnMissing();
      ({ data, error } = await updateRow(false));
    }

    // The project may have been closed while the write was in flight (e.g. a
    // flush-on-close) — don't resurrect its status or attachment afterwards
    if (get().currentProjectId !== currentProjectId) return;

    if (error) {
      set({ syncStatus: 'error', syncError: error.message });
    } else {
      set({ syncStatus: 'saved', syncError: null });
      writeAttachment({
        id: currentProjectId,
        name: get().currentProjectName,
        syncedAt: data?.updated_at ?? null,
      });
    }
  },

  refreshMembers: async () => {
    const { currentProjectId } = get();
    if (!builderClient || !currentProjectId) return;
    const { data, error } = await builderClient
      .from('project_members')
      .select('project_id, email, user_id, role')
      .eq('project_id', currentProjectId);
    if (!error && data) set({ members: data as ProjectMember[] });
  },

  inviteMember: async (email: string, note?: string) => {
    const { currentProjectId } = get();
    const user = useAuthStore.getState().user;
    if (!builderClient || !currentProjectId || !user) return { error: 'No cloud project open' };

    const { error } = await builderClient.from('project_members').insert({
      project_id: currentProjectId,
      email: email.trim().toLowerCase(),
      invited_by: user.id,
    });
    if (error) return { error: error.message };

    // Best-effort notification email — the invite works either way
    // (the project appears when they sign in with that address)
    builderClient.auth.getSession().then(({ data }) => {
      const token = data.session?.access_token;
      const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
      if (!token || !url) return;
      fetch(`${url}/functions/v1/notify-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          invitee_email: email.trim().toLowerCase(),
          project_name: get().currentProjectName,
          note: note?.trim() || undefined,
          inviter_name: useAuthStore.getState().profile?.display_name ?? undefined,
        }),
      }).catch(() => {});
    });

    await get().refreshMembers();
    return { error: null };
  },

  removeMember: async (email: string) => {
    const { currentProjectId } = get();
    if (!builderClient || !currentProjectId) return;
    await builderClient
      .from('project_members')
      .delete()
      .eq('project_id', currentProjectId)
      .eq('email', email);
    await get().refreshMembers();
  },
}));
