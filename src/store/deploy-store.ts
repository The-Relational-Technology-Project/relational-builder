import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where a project last went live on community hosting */
export interface LiveSite {
  slug: string;
  url: string;
  hasPassphrase: boolean;
  publishedAt: number;
}

interface DeployState {
  netlifyToken: string;
  vercelToken: string;
  customDomain: string;
  /** Name each project was last published under — keyed by cloud project id,
   *  local shelf id, or 'local' (same keying as github-store repos). Makes
   *  re-publishing a "save" under the established name, not a "save as". */
  publishNames: Record<string, string>;
  /** The live community-hosted site each project last published to — same
   *  keying as publishNames. Lets Share hand the link straight back instead
   *  of sending the builder through Publish again to find it. */
  liveSites: Record<string, LiveSite>;
  setNetlifyToken: (token: string) => void;
  setVercelToken: (token: string) => void;
  setCustomDomain: (domain: string) => void;
  setPublishName: (key: string, name: string) => void;
  setLiveSite: (key: string, site: LiveSite) => void;
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
      liveSites: {},
      setNetlifyToken: (token) => set({ netlifyToken: token }),
      setVercelToken: (token) => set({ vercelToken: token }),
      setCustomDomain: (domain) => set({ customDomain: domain }),
      setPublishName: (key, name) =>
        set((s) => ({ publishNames: { ...s.publishNames, [key]: name } })),
      setLiveSite: (key, site) =>
        set((s) => ({ liveSites: { ...s.liveSites, [key]: site } })),
      movePublishName: (fromKey, toKey) =>
        set((s) => {
          if (fromKey === toKey) return s;
          const name = s.publishNames[fromKey];
          const live = s.liveSites[fromKey];
          if (!name && !live) return s;
          const publishNames = { ...s.publishNames };
          const liveSites = { ...s.liveSites };
          if (name) { publishNames[toKey] = name; delete publishNames[fromKey]; }
          if (live) { liveSites[toKey] = live; delete liveSites[fromKey]; }
          return { publishNames, liveSites };
        }),
    }),
    {
      name: 'relational-builder-deploy',
      partialize: (state) => ({
        netlifyToken: state.netlifyToken,
        vercelToken: state.vercelToken,
        customDomain: state.customDomain,
        publishNames: state.publishNames,
        liveSites: state.liveSites,
      } as unknown as DeployState),
    },
  ),
);
