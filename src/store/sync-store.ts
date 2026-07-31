import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ForgeId, RemoteCommit, RemoteFileChange } from '@/project/forge/types';

export interface ConnectedRepo {
  forge: ForgeId;
  /** Instance base URL for self-hosted forges; unset for the hosted default */
  baseUrl?: string;
  fullName: string;
  branch: string;
  htmlUrl: string;
  lastSyncSha: string | null;
}

/** What's sitting on the repo that the Builder hasn't seen yet */
export interface RemoteChanges {
  headSha: string;
  aheadBy: number;
  commits: RemoteCommit[];
  files: RemoteFileChange[];
  /** True when we couldn't diff — never synced, or history was rewritten */
  fullResync: boolean;
}

interface SyncState {
  /** One saved token per forge (Forgejo's belongs to its instanceUrl) */
  tokens: Partial<Record<ForgeId, string>>;
  usernames: Partial<Record<ForgeId, string>>;
  /** Instance URLs for self-hosted forges, remembered per forge */
  instanceUrls: Partial<Record<ForgeId, string>>;
  /** Repo connection per project — keyed by cloud project id, or 'local' */
  repos: Record<string, ConnectedRepo>;

  // Transient remote awareness (never persisted)
  remote: RemoteChanges | null;
  checkingRemote: boolean;
  lastCheckedAt: number;
  /** Head SHA the person chose "Later" on — don't re-show that banner */
  dismissedHead: string | null;
  /** True while a pull is applying files (suppresses cloud auto-save echo churn) */
  pulling: boolean;

  setToken: (forge: ForgeId, token: string) => void;
  setUsername: (forge: ForgeId, username: string) => void;
  setInstanceUrl: (forge: ForgeId, url: string) => void;
  /** Forget one forge's token and its projects' repo connections */
  signOut: (forge: ForgeId) => void;
  connectRepo: (key: string, repo: ConnectedRepo) => void;
  disconnectRepo: (key: string) => void;
  updateLastSync: (key: string, sha: string) => void;
  /** Move a repo connection when a local project becomes a cloud project */
  moveRepo: (fromKey: string, toKey: string) => void;
  setRemote: (remote: RemoteChanges | null) => void;
  setCheckingRemote: (checking: boolean) => void;
  dismissRemote: (headSha: string) => void;
  setPulling: (pulling: boolean) => void;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      tokens: {},
      usernames: {},
      instanceUrls: {},
      repos: {},

      remote: null,
      checkingRemote: false,
      lastCheckedAt: 0,
      dismissedHead: null,
      pulling: false,

      setToken: (forge, token) =>
        set((s) => ({ tokens: { ...s.tokens, [forge]: token } })),
      setUsername: (forge, username) =>
        set((s) => ({ usernames: { ...s.usernames, [forge]: username } })),
      setInstanceUrl: (forge, url) =>
        set((s) => ({ instanceUrls: { ...s.instanceUrls, [forge]: url } })),

      signOut: (forge) =>
        set((s) => {
          const tokens = { ...s.tokens };
          const usernames = { ...s.usernames };
          delete tokens[forge];
          delete usernames[forge];
          const repos = Object.fromEntries(
            Object.entries(s.repos).filter(([, r]) => r.forge !== forge),
          );
          return { tokens, usernames, repos, remote: null, dismissedHead: null };
        }),

      connectRepo: (key, repo) =>
        set((s) => ({ repos: { ...s.repos, [key]: repo }, remote: null, dismissedHead: null })),

      disconnectRepo: (key) =>
        set((s) => {
          const repos = { ...s.repos };
          delete repos[key];
          return { repos, remote: null, dismissedHead: null };
        }),

      updateLastSync: (key, sha) =>
        set((s) =>
          s.repos[key]
            ? { repos: { ...s.repos, [key]: { ...s.repos[key], lastSyncSha: sha } } }
            : s,
        ),

      moveRepo: (fromKey, toKey) =>
        set((s) => {
          const repo = s.repos[fromKey];
          if (!repo || fromKey === toKey) return s;
          const repos = { ...s.repos, [toKey]: repo };
          delete repos[fromKey];
          return { repos };
        }),

      setRemote: (remote) => set({ remote, lastCheckedAt: Date.now() }),
      setCheckingRemote: (checkingRemote) => set({ checkingRemote }),
      dismissRemote: (headSha) => set({ dismissedHead: headSha }),
      setPulling: (pulling) => set({ pulling }),
    }),
    {
      // Historical key — this store began GitHub-only, and renaming it
      // would orphan everyone's saved tokens and repo connections.
      name: 'relational-builder-github',
      version: 2,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 && state?.connectedRepo) {
          // The old single global connection becomes the local project's
          state.repos = { local: state.connectedRepo };
          delete state.connectedRepo;
        }
        if (version <= 1) {
          // GitHub-only era: one token/username, repos without a forge
          state.tokens = state.token ? { github: state.token } : {};
          state.usernames = state.username ? { github: state.username } : {};
          state.instanceUrls = {};
          delete state.token;
          delete state.username;
          const repos = (state.repos ?? {}) as Record<string, ConnectedRepo>;
          for (const key of Object.keys(repos)) {
            repos[key] = { ...repos[key], forge: repos[key].forge ?? 'github' };
          }
        }
        return state as unknown as SyncState;
      },
      partialize: (state) => ({
        tokens: state.tokens,
        usernames: state.usernames,
        instanceUrls: state.instanceUrls,
        repos: state.repos,
      } as unknown as SyncState),
    },
  ),
);
