import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeployState {
  netlifyToken: string;
  vercelToken: string;
  customDomain: string;
  setNetlifyToken: (token: string) => void;
  setVercelToken: (token: string) => void;
  setCustomDomain: (domain: string) => void;
}

export const useDeployStore = create<DeployState>()(
  persist(
    (set) => ({
      netlifyToken: '',
      vercelToken: '',
      customDomain: '',
      setNetlifyToken: (token) => set({ netlifyToken: token }),
      setVercelToken: (token) => set({ vercelToken: token }),
      setCustomDomain: (domain) => set({ customDomain: domain }),
    }),
    {
      name: 'relational-builder-deploy',
      partialize: (state) => ({
        netlifyToken: state.netlifyToken,
        vercelToken: state.vercelToken,
        customDomain: state.customDomain,
      } as unknown as DeployState),
    },
  ),
);
