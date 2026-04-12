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

  setVar: (key: string, value: string, isSecret: boolean) => void;
  removeVar: (key: string) => void;
  clearAll: () => void;

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

      getAll: () => get().vars,
      getPublic: () => get().vars.filter((v) => !v.isSecret),
      getValue: (key) => get().vars.find((v) => v.key === key)?.value,
    }),
    {
      name: 'relational-builder-env',
      partialize: (state) => ({ vars: state.vars }) as unknown as EnvState,
    },
  ),
);
