import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EnvVar {
  key: string;
  value: string;
  /** Secret vars are masked in the UI and excluded from shared previews */
  isSecret: boolean;
}

interface EnvState {
  vars: EnvVar[];
  /**
   * Env vars parked for cloud projects that aren't open, keyed by project
   * id. Device-local by design — secrets never ride along in the shared
   * cloud row. (Shelf projects carry theirs in their own snapshots.)
   * Without this, switching projects left the previous project's keys
   * live and feeding previews, publishes, and deploys.
   */
  stash: Record<string, EnvVar[]>;

  setVar: (key: string, value: string, isSecret: boolean) => void;
  removeVar: (key: string) => void;
  clearAll: () => void;
  /** Park the live vars under a project key and clear the live set */
  stashCurrent: (projectKey: string) => void;
  /** Bring a project's parked vars back as the live set */
  restoreFor: (projectKey: string) => void;
  /** Forget a deleted project's parked vars */
  dropStash: (projectKey: string) => void;

  /** Get all vars (for deploy) */
  getAll: () => EnvVar[];
  /** Get only public vars (for preview / share) */
  getPublic: () => EnvVar[];
  /** Get value by key */
  getValue: (key: string) => string | undefined;
}

export const useEnvStore = create<EnvState>()(
  persist(
    (set, get) => ({
      vars: [],
      stash: {},

      setVar: (key, value, isSecret) =>
        set((state) => {
          const existing = state.vars.findIndex((v) => v.key === key);
          const next = [...state.vars];
          if (existing >= 0) {
            next[existing] = { key, value, isSecret };
          } else {
            next.push({ key, value, isSecret });
          }
          return { vars: next };
        }),

      removeVar: (key) =>
        set((state) => ({
          vars: state.vars.filter((v) => v.key !== key),
        })),

      clearAll: () => set({ vars: [] }),

      stashCurrent: (projectKey) =>
        set((state) => ({
          stash: state.vars.length
            ? { ...state.stash, [projectKey]: state.vars }
            : state.stash,
          vars: [],
        })),

      restoreFor: (projectKey) =>
        set((state) => {
          const stash = { ...state.stash };
          const vars = stash[projectKey] ?? [];
          delete stash[projectKey];
          return { vars, stash };
        }),

      dropStash: (projectKey) =>
        set((state) => {
          if (!(projectKey in state.stash)) return state;
          const stash = { ...state.stash };
          delete stash[projectKey];
          return { stash };
        }),

      getAll: () => get().vars,
      getPublic: () => get().vars.filter((v) => !v.isSecret),
      getValue: (key) => get().vars.find((v) => v.key === key)?.value,
    }),
    {
      name: 'relational-builder-env',
      partialize: (state) => ({ vars: state.vars, stash: state.stash }) as unknown as EnvState,
    },
  ),
);
