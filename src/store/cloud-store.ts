import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { useProjectStore, type ProjectLineage } from '@/store/project-store';
import { useChatStore, type ChatMode, type DisplayMessage } from '@/store/chat-store';
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

interface CloudProjectRow {
  id: string;
  name: string;
  owner_id: string;
  files: FileEntry[];
  chat: DisplayMessage[];
  mode: ChatMode;
  lineage: ProjectLineage | null;
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
  closeProject: () => void;
  renameProject: (name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  saveNow: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  inviteMember: (email: string) => Promise<{ error: string | null }>;
  removeMember: (email: string) => Promise<void>;
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
  };
}

/** Replace the local workspace with a cloud snapshot */
function applyWorkspace(row: CloudProjectRow) {
  useProjectStore.getState().hydrateFiles(row.files ?? [], row.lineage ?? null);
  useChatStore.getState().hydrateChat(row.chat ?? [], row.mode ?? 'build');
}

let channel: RealtimeChannel | null = null;

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
    const { data, error } = await builderClient
      .from('projects')
      .insert({
        owner_id: user.id,
        name,
        files: snapshot.files,
        chat: snapshot.chat,
        mode: snapshot.mode,
        lineage: snapshot.lineage,
        updated_by: user.id,
      })
      .select('id, name, owner_id, updated_at')
      .single();

    if (error) return { error: error.message };

    set({
      currentProjectId: data.id,
      currentProjectName: data.name,
      isOwner: true,
      syncStatus: 'saved',
      syncError: null,
    });
    subscribeToProject(data.id);
    await get().refreshProjects();
    await get().refreshMembers();
    return { error: null };
  },

  openProject: async (id: string) => {
    const user = useAuthStore.getState().user;
    if (!builderClient || !user) return { error: 'Sign in first' };

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
    subscribeToProject(row.id);
    await get().refreshMembers();
    return { error: null };
  },

  closeProject: () => {
    unsubscribe();
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
    await get().refreshProjects();
  },

  deleteProject: async (id: string) => {
    if (!builderClient) return;
    await builderClient.from('projects').delete().eq('id', id);
    if (get().currentProjectId === id) get().closeProject();
    await get().refreshProjects();
  },

  saveNow: async () => {
    const { currentProjectId, applyingRemote } = get();
    const user = useAuthStore.getState().user;
    if (!builderClient || !currentProjectId || !user || applyingRemote) return;

    set({ syncStatus: 'saving' });
    const snapshot = captureWorkspace();
    const { error } = await builderClient
      .from('projects')
      .update({
        files: snapshot.files,
        chat: snapshot.chat,
        mode: snapshot.mode,
        lineage: snapshot.lineage,
        updated_by: user.id,
      })
      .eq('id', currentProjectId);

    if (error) {
      set({ syncStatus: 'error', syncError: error.message });
    } else {
      set({ syncStatus: 'saved', syncError: null });
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

  inviteMember: async (email: string) => {
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
