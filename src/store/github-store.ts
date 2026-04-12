import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ConnectedRepo {
  fullName: string;
  branch: string;
  htmlUrl: string;
  lastSyncSha: string | null;
}

interface GitHubState {
  token: string;
  username: string | null;
  connectedRepo: ConnectedRepo | null;

  setToken: (token: string) => void;
  setUsername: (username: string) => void;
  connectRepo: (repo: ConnectedRepo) => void;
  disconnectRepo: () => void;
  updateLastSync: (sha: string) => void;
  clearAll: () => void;
}

export const useGitHubStore = create<GitHubState>()(
  persist(
    (set) => ({
      token: '',
      username: null,
      connectedRepo: null,

      setToken: (token) => set({ token }),
      setUsername: (username) => set({ username }),

      connectRepo: (repo) => set({ connectedRepo: repo }),

      disconnectRepo: () => set({ connectedRepo: null }),

      updateLastSync: (sha) =>
        set((state) => ({
          connectedRepo: state.connectedRepo
            ? { ...state.connectedRepo, lastSyncSha: sha }
            : null,
        })),

      clearAll: () => set({ token: '', username: null, connectedRepo: null }),
    }),
    {
      name: 'relational-builder-github',
      partialize: (state) => ({
        token: state.token,
        username: state.username,
        connectedRepo: state.connectedRepo,
      } as unknown as GitHubState),
    },
  ),
);
