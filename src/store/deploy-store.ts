import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BunnySite } from '@/project/deploy-bunny';
import type { CodebergSite } from '@/project/deploy-codeberg';

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
  /** EU hosts (docs/REGIONAL-MODE.md). Bunny needs the account key plus,
   *  per site, the zone it was created in — a republish uploads into the
   *  same zone. Codeberg needs the token plus the repo each site lives in. */
  bunnyAccountKey: string;
  bunnySites: Record<string, BunnySite>;
  codebergToken: string;
  codebergSites: Record<string, CodebergSite>;
  setNetlifyToken: (token: string) => void;
  setVercelToken: (token: string) => void;
  setBunnyAccountKey: (key: string) => void;
  setBunnySite: (key: string, site: BunnySite) => void;
  setCodebergToken: (token: string) => void;
  setCodebergSite: (key: string, site: CodebergSite) => void;
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
      bunnyAccountKey: '',
      bunnySites: {},
      codebergToken: '',
      codebergSites: {},
      setNetlifyToken: (token) => set({ netlifyToken: token }),
      setVercelToken: (token) => set({ vercelToken: token }),
      setBunnyAccountKey: (key) => set({ bunnyAccountKey: key }),
      setBunnySite: (key, site) => set((s) => ({ bunnySites: { ...s.bunnySites, [key]: site } })),
      setCodebergToken: (token) => set({ codebergToken: token }),
      setCodebergSite: (key, site) => set((s) => ({ codebergSites: { ...s.codebergSites, [key]: site } })),
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
          const bunny = s.bunnySites[fromKey];
          const codeberg = s.codebergSites[fromKey];
          if (!name && !live && !bunny && !codeberg) return s;
          const publishNames = { ...s.publishNames };
          const liveSites = { ...s.liveSites };
          const bunnySites = { ...s.bunnySites };
          const codebergSites = { ...s.codebergSites };
          if (name) { publishNames[toKey] = name; delete publishNames[fromKey]; }
          if (live) { liveSites[toKey] = live; delete liveSites[fromKey]; }
          if (bunny) { bunnySites[toKey] = bunny; delete bunnySites[fromKey]; }
          if (codeberg) { codebergSites[toKey] = codeberg; delete codebergSites[fromKey]; }
          return { publishNames, liveSites, bunnySites, codebergSites };
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
        bunnyAccountKey: state.bunnyAccountKey,
        bunnySites: state.bunnySites,
        codebergToken: state.codebergToken,
        codebergSites: state.codebergSites,
      } as unknown as DeployState),
    },
  ),
);
