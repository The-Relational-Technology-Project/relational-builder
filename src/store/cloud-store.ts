import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore, type ProjectLineage } from '@/store/project-store';
import { useProviderStore } from '@/store/provider-store';
import { useChatStore, type ChatMode, type DisplayMessage } from '@/store/chat-store';
import { useNotepadStore, captureNotepad, type NotepadSnapshot } from '@/store/notepad-store';
import { useReferencesStore, captureReferences, type ReferencesSnapshot } from '@/store/references-store';
import { useEnvStore } from '@/store/env-store';
import type { FileEntry } from '@/project/virtual-fs';
import { mergeById, mergeFiles, mergeMessages, mergeNotes, mergeStory } from '@/project/merge-workspace';

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
 * Someone with this project open right now — Supabase Realtime Presence on
 * the project's channel, so it needs no table and clears itself when a tab
 * goes. `building` is the heart of it: a team on four devices used to run
 * four builds at once and the last save won. Now one person builds at a
 * time, and everyone can see who and what.
 */
export interface Peer {
  userId: string;
  name: string;
  /** Set while this person's build (or its closing save) is in flight */
  building: { since: number; prompt: string } | null;
}

/** A `building` flag older than this is a tab that closed mid-build */
export const STALE_BUILD_MS = 4 * 60_000;

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
  /** Reference documents (null on rows saved before they existed) */
  reference_docs: ReferencesSnapshot | null;
  updated_by: string | null;
  updated_at: string;
}

interface CloudState {
  /** The cloud project currently open in the workspace (null = local-only) */
  currentProjectId: string | null;
  currentProjectName: string;
  isOwner: boolean;
  projects: CloudProjectSummary[];
  /** The same list as a set of ids — "is this project one of mine" */
  projectIds: Set<string>;
  members: ProjectMember[];
  syncStatus: SyncStatus;
  syncError: string | null;
  /** True while applying a remote update — suppresses the auto-save echo */
  applyingRemote: boolean;
  /** Teammates with the project open (never includes this device) */
  peers: Peer[];

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

/** Same story for `reference_docs` (migration 20260909090000): a save must
 *  never fail over a column the database hasn't grown yet. */
let referenceDocsColumnMissing = false;

export function referenceDocsColumnKnownMissing(): boolean {
  return referenceDocsColumnMissing;
}

export function markReferenceDocsColumnMissing(): void {
  referenceDocsColumnMissing = true;
}

export function isMissingReferenceDocsColumnError(message: string): boolean {
  return /reference_docs/i.test(message) && /column|schema/i.test(message);
}

/** The optional columns a project row carries, minus any this database is
 *  known to lack. Rows are written with this spread; a write that fails
 *  over a missing column marks it and retries. */
function optionalColumns(snapshot: { notepad: NotepadSnapshot; reference_docs: ReferencesSnapshot }) {
  return {
    ...(notepadColumnMissing ? {} : { notepad: snapshot.notepad }),
    ...(referenceDocsColumnMissing ? {} : { reference_docs: snapshot.reference_docs }),
  };
}

/** Did this write fail over an optional column? Mark it missing and say so. */
function absorbMissingColumn(message: string): boolean {
  if (!notepadColumnMissing && isMissingNotepadColumnError(message)) {
    markNotepadColumnMissing();
    return true;
  }
  if (!referenceDocsColumnMissing && isMissingReferenceDocsColumnError(message)) {
    markReferenceDocsColumnMissing();
    return true;
  }
  return false;
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
    reference_docs: captureReferences(),
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
  useReferencesStore.getState().hydrateReferences(row.reference_docs ?? []);
}

let channel: RealtimeChannel | null = null;
let resumeInFlight = false;

/** What this device tells the room about itself */
let myPresence: { userId: string; name: string; building: Peer['building'] } | null = null;
/** A teammate's row that arrived while a build was running here — merged
 *  the moment the build ends, before its closing save */
let pendingRemoteRow: CloudProjectRow | null = null;
/** When the build running here started — files written since are ours */
let buildStartedAt: number | null = null;

function unsubscribe() {
  if (channel) {
    void channel.untrack();
    builderClient?.removeChannel(channel);
    channel = null;
  }
  pendingRemoteRow = null;
  useCloudStore.setState({ peers: [] });
}

function myDisplayName(): string {
  const { profile, user } = useAuthStore.getState();
  return (
    profile?.display_name?.trim() ||
    profile?.full_name?.trim() ||
    user?.email?.split('@')[0] ||
    'Someone'
  );
}

function readPeers(): Peer[] {
  if (!channel) return [];
  const me = useAuthStore.getState().user?.id;
  const out: Peer[] = [];
  const state = channel.presenceState<{ userId: string; name: string; building: Peer['building'] }>();
  for (const entries of Object.values(state)) {
    for (const e of entries) {
      if (!e.userId || e.userId === me) continue;
      // The same person in two tabs is one peer; a build in either counts
      const existing = out.find(p => p.userId === e.userId);
      if (existing) {
        if (!existing.building && e.building) existing.building = e.building;
      } else {
        out.push({ userId: e.userId, name: e.name, building: e.building ?? null });
      }
    }
  }
  return out;
}

function track() {
  if (!channel || !myPresence) return;
  void channel.track(myPresence);
}

/**
 * Say whether a build is running on this device. `prompt` is what was asked,
 * shortened — the thing a teammate sees under "Maya is building". The flag
 * stays up through the closing save (see saveNow), so a queued prompt on
 * another device sends only once the new files are there to build on.
 */
export function trackBuilding(building: boolean, prompt?: string) {
  if (!myPresence) return;
  if (building) {
    buildStartedAt = Date.now();
    myPresence = {
      ...myPresence,
      building: { since: Date.now(), prompt: (prompt ?? '').trim().slice(0, 120) },
    };
    track();
  } else if (!useCloudStore.getState().currentProjectId) {
    clearBuilding();
  } else {
    // The closing save clears it (saveNow). If that save never runs — an
    // echo guard swallowed it, the row was unchanged — nobody should wait
    // on a flag that means nothing any more.
    if (buildClearFallback) clearTimeout(buildClearFallback);
    buildClearFallback = setTimeout(clearBuilding, 8_000);
  }
}
let buildClearFallback: ReturnType<typeof setTimeout> | null = null;

function clearBuilding() {
  buildStartedAt = null;
  if (buildClearFallback) {
    clearTimeout(buildClearFallback);
    buildClearFallback = null;
  }
  if (myPresence?.building) {
    myPresence = { ...myPresence, building: null };
    track();
  }
}

/**
 * The teammate whose build everyone else is waiting on, or null. Stale
 * flags (a tab closed mid-build) don't count — presence usually clears them
 * itself, but a dropped connection can leave one behind for a while.
 */
export function remoteBuilderOf(peers: Peer[], now: number = Date.now()): Peer | null {
  return (
    peers.find(p => p.building && now - p.building.since < STALE_BUILD_MS) ?? null
  );
}

export function useRemoteBuilder(): Peer | null {
  return useCloudStore(s => remoteBuilderOf(s.peers));
}

/**
 * Fold a teammate's snapshot into the workspace — union, newer wins — rather
 * than replacing it (see merge-workspace.ts for the rules). The echo guard
 * around it keeps the merged result from saving back instantly; the next
 * local edit carries it up, and until then our copy is a superset anyway.
 */
function mergeRemote(row: CloudProjectRow) {
  const remoteAt = Date.parse(row.updated_at);
  const project = useProjectStore.getState();
  const chat = useChatStore.getState();
  const notepad = useNotepadStore.getState();
  const refs = useReferencesStore.getState();

  const files = mergeFiles(project.fs.toJSON(), row.files ?? [], {
    remoteAt,
    protectAfter: buildStartedAt ?? undefined,
  });
  const messages = mergeMessages(chat.messages, row.chat ?? []);
  const notes = mergeNotes(notepad.notes, row.notepad?.notes ?? []);
  const story = mergeStory(notepad.story, row.notepad?.story ?? null);
  const docs = mergeById(refs.docs, row.reference_docs ?? []);

  useCloudStore.setState({ applyingRemote: true, currentProjectName: row.name });
  writeAttachment({ id: row.id, name: row.name, syncedAt: row.updated_at });
  try {
    project.hydrateFiles(files, row.lineage ?? project.lineage);
    // Mode is how *this* person is working — a teammate flipping to plan
    // mode shouldn't flip the composer under someone mid-sentence
    chat.hydrateChat(messages, chat.mode);
    notepad.hydrateNotepad(notes, story);
    refs.hydrateReferences(docs);
  } finally {
    // Give the store subscriptions a beat before re-enabling auto-save
    setTimeout(() => useCloudStore.setState({ applyingRemote: false }), 100);
  }
}

/** A build just ended here: bring in anything a teammate saved meanwhile,
 *  before this device's closing save would have written over it */
export function flushPendingRemote() {
  const row = pendingRemoteRow;
  pendingRemoteRow = null;
  if (row && useCloudStore.getState().currentProjectId === row.id) mergeRemote(row);
}

function subscribeToProject(projectId: string) {
  if (!builderClient) return;
  unsubscribe();
  const user = useAuthStore.getState().user;
  myPresence = user ? { userId: user.id, name: myDisplayName(), building: null } : null;
  channel = builderClient
    .channel(`project-${projectId}`, { config: { presence: { key: user?.id ?? 'anon' } } })
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'projects', filter: `id=eq.${projectId}` },
      payload => {
        const row = payload.new as CloudProjectRow;
        const me = useAuthStore.getState().user;
        // Ignore our own writes echoed back
        if (me && row.updated_by === me.id) return;
        // A build is streaming here: hold the row rather than pull the
        // reply out from under it (the stream appends by message id, and a
        // wholesale replace used to make the reply vanish). Merged on end.
        if (useChatStore.getState().isGenerating) {
          pendingRemoteRow = row;
          return;
        }
        mergeRemote(row);
      },
    )
    .on('presence', { event: 'sync' }, () => {
      useCloudStore.setState({ peers: readPeers() });
    })
    .subscribe(status => {
      if (status === 'SUBSCRIBED') track();
    });
}

export const useCloudStore = create<CloudState>()((set, get) => ({
  currentProjectId: null,
  currentProjectName: '',
  isOwner: false,
  projects: [],
  projectIds: new Set(),
  members: [],
  syncStatus: 'idle',
  syncError: null,
  applyingRemote: false,
  peers: [],

  refreshProjects: async () => {
    if (!builderClient) return;
    const { data, error } = await builderClient
      .from('projects')
      .select('id, name, owner_id, updated_at')
      .order('updated_at', { ascending: false });
    if (!error && data) {
      const projects = data as CloudProjectSummary[];
      set({ projects, projectIds: new Set(projects.map(p => p.id)) });
    }
  },

  createProject: async (name: string) => {
    const user = useAuthStore.getState().user;
    if (!builderClient || !user) return { error: 'Sign in first' };

    const snapshot = captureWorkspace();
    const insertRow = () =>
      builderClient!
        .from('projects')
        .insert({
          owner_id: user.id,
          name,
          files: snapshot.files,
          chat: snapshot.chat,
          mode: snapshot.mode,
          lineage: snapshot.lineage,
          ...optionalColumns(snapshot),
          updated_by: user.id,
        })
        .select('id, name, owner_id, updated_at')
        .single();

    let { data, error } = await insertRow();
    // Each optional column gets one retry without it (two at most)
    while (error && absorbMissingColumn(error.message)) {
      ({ data, error } = await insertRow());
    }

    if (error) return { error: error.message };
    if (!data) return { error: 'Save failed' };

    // The repo connection follows the work onto the account from
    // promoteWorkspaceToCloud, which knows the shelf slot it came from
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
    const previousId = get().currentProjectId;
    if (previousId && previousId !== id) await get().saveNow();

    const { data, error } = await builderClient
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return { error: error?.message ?? 'Project not found' };

    const row = data as CloudProjectRow;
    // Env vars are project-scoped and device-local: park the outgoing
    // project's, bring in the incoming project's — otherwise the previous
    // project's keys stay live and feed this one's previews and deploys
    if (previousId && previousId !== id) useEnvStore.getState().stashCurrent(previousId);
    set({ applyingRemote: true });
    try {
      applyWorkspace(row);
      if (previousId !== id) useEnvStore.getState().restoreFor(row.id);
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
    // Park the project's env vars on this device so reopening it brings
    // them back — and the next workspace doesn't inherit its secrets
    const closingId = get().currentProjectId;
    if (closingId) useEnvStore.getState().stashCurrent(closingId);
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
    // Locally first: same-tick readers (the build-ready notification, a
    // report assembled right after) see the new name without racing the write
    set({ currentProjectName: name });
    await builderClient.from('projects').update({ name }).eq('id', currentProjectId);
    const att = readCloudAttachment();
    if (att?.id === currentProjectId) writeAttachment({ ...att, name });
    await get().refreshProjects();
  },

  deleteProject: async (id: string) => {
    if (!builderClient) return;
    await builderClient.from('projects').delete().eq('id', id);
    // No flush — a farewell save would just error against the deleted row
    if (get().currentProjectId === id) get().closeProject({ flush: false });
    useEnvStore.getState().dropStash(id);
    await get().refreshProjects();
  },

  saveNow: async () => {
    const { currentProjectId, applyingRemote } = get();
    const user = useAuthStore.getState().user;
    if (!builderClient || !currentProjectId || !user || applyingRemote) return;

    set({ syncStatus: 'saving' });
    const snapshot = captureWorkspace();
    const updateRow = () =>
      builderClient!
        .from('projects')
        .update({
          files: snapshot.files,
          chat: snapshot.chat,
          mode: snapshot.mode,
          lineage: snapshot.lineage,
          ...optionalColumns(snapshot),
          updated_by: user.id,
        })
        .eq('id', currentProjectId)
        .select('updated_at')
        .single();

    let { data, error } = await updateRow();
    while (error && absorbMissingColumn(error.message)) {
      ({ data, error } = await updateRow());
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
    // The build's files are on the row now (or the save failed and holding
    // the room any longer helps nobody): teammates' queued prompts may go
    if (!useChatStore.getState().isGenerating) clearBuilding();
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

    // What the invitee opens is the row, not this screen — flush the
    // debounced edits first so they see the conversation as it stands
    await get().saveNow();

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
          // Without the id the email's button was a bare origin — it opened
          // whatever account the browser was already in and showed nothing
          project_id: currentProjectId,
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
