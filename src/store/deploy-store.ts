import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface DeployState {
  netlifyToken: string;
  vercelToken: string;
  setNetlifyToken: (token: string) => void;
  setVercelToken: (token: string) => void;
}

export const useDeployStore = create<DeployState>()(
  persist(
    (set) => ({
      netlifyToken: '',
      vercelToken: '',
      setNetlifyToken: (token) => set({ netlifyToken: token }),
      setVercelToken: (token) => set({ vercelToken: token }),
    }),
    {
      name: 'relational-builder-deploy',
      partialize: (state) => ({
        netlifyToken: state.netlifyToken,
        vercelToken: state.vercelToken,
      } as unknown as DeployState),
    },
  ),
);
