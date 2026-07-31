import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeployState {
  netlifyToken: string;
  vercelToken: string;
  customDomain: string;
  /** Name each project was last published under — keyed by cloud project id,
   *  local shelf id, or 'local' (same keying as github-store repos). Makes
   *  re-publishing a "save" under the established name, not a "save as". */
  publishNames: Record<string, string>;
  setNetlifyToken: (token: string) => void;
  setVercelToken: (token: string) => void;
  setCustomDomain: (domain: string) => void;
  setPublishName: (key: string, name: string) => void;
  /** Move a remembered name when a local project becomes a cloud project */
  movePublishName: (fromKey: string, toKey: string) => void;
}

export const useDeployStore = create<DeployState>()(
  persist(
    (set) => ({
      netlifyToken: '',
      vercelToken: '',
      customDomain: '',
      publishNames: {},
      setNetlifyToken: (token) => set({ netlifyToken: token }),
      setVercelToken: (token) => set({ vercelToken: token }),
      setCustomDomain: (domain) => set({ customDomain: domain }),
      setPublishName: (key, name) =>
        set((s) => ({ publishNames: { ...s.publishNames, [key]: name } })),
      movePublishName: (fromKey, toKey) =>
        set((s) => {
          const name = s.publishNames[fromKey];
          if (!name || fromKey === toKey) return s;
          const publishNames = { ...s.publishNames, [toKey]: name };
          delete publishNames[fromKey];
          return { publishNames };
        }),
    }),
    {
      name: 'relational-builder-deploy',
      partialize: (state) => ({
        netlifyToken: state.netlifyToken,
        vercelToken: state.vercelToken,
        customDomain: state.customDomain,
        publishNames: state.publishNames,
      } as unknown as DeployState),
    },
  ),
);
