import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RemoteCommit, RemoteFileChange } from '@/project/github-api';

export interface ConnectedRepo {
  fullName: string;
  branch: string;
  htmlUrl: string;
  lastSyncSha: string | null;
}

/** What's sitting on GitHub that the Builder hasn't seen yet */
export interface RemoteChanges {
  headSha: string;
  aheadBy: number;
  commits: RemoteCommit[];
  files: RemoteFileChange[];
  /** True when we couldn't diff — never synced, or history was rewritten */
  fullResync: boolean;
}

interface GitHubState {
  token: string;
  username: string | null;
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

  setToken: (token: string) => void;
  setUsername: (username: string) => void;
  connectRepo: (key: string, repo: ConnectedRepo) => void;
  disconnectRepo: (key: string) => void;
  updateLastSync: (key: string, sha: string) => void;
  /** Move a repo connection when a local project becomes a cloud project */
  moveRepo: (fromKey: string, toKey: string) => void;
  setRemote: (remote: RemoteChanges | null) => void;
  setCheckingRemote: (checking: boolean) => void;
  dismissRemote: (headSha: string) => void;
  setPulling: (pulling: boolean) => void;
  clearAll: () => void;
}

export const useGitHubStore = create<GitHubState>()(
  persist(
    (set) => ({
      token: '',
      username: null,
      repos: {},

      remote: null,
      checkingRemote: false,
      lastCheckedAt: 0,
      dismissedHead: null,
      pulling: false,

      setToken: (token) => set({ token }),
      setUsername: (username) => set({ username }),

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

      clearAll: () =>
        set({ token: '', username: null, repos: {}, remote: null, dismissedHead: null }),
    }),
    {
      name: 'relational-builder-github',
      version: 1,
      migrate: (persisted: unknown, version: number) => {
        const state = persisted as Record<string, unknown>;
        if (version === 0 && state?.connectedRepo) {
          // The old single global connection becomes the local project's
          state.repos = { local: state.connectedRepo };
          delete state.connectedRepo;
        }
        return state as unknown as GitHubState;
      },
      partialize: (state) => ({
        token: state.token,
        username: state.username,
        repos: state.repos,
      } as unknown as GitHubState),
    },
  ),
);
