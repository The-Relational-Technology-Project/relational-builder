import { create } from 'zustand';
import { builderClient, cloudEnabled } from '@/cloud/builder-client';

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  user: AuthUser | null;
  initialized: boolean;

  /** Wire up the Supabase auth listener — call once on app mount */
  init: () => void;
  /** Send a magic link to the given email */
  signIn: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  initialized: false,

  init: () => {
    if (get().initialized || !builderClient) {
      set({ initialized: true });
      return;
    }
    set({ initialized: true });

    builderClient.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      set({ user: u?.email ? { id: u.id, email: u.email } : null });
    });

    builderClient.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      set({ user: u?.email ? { id: u.id, email: u.email } : null });
    });
  },

  signIn: async (email: string) => {
    if (!builderClient) return { error: 'Cloud features are not configured' };
    const { error } = await builderClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error?.message ?? null };
  },

  signOut: async () => {
    await builderClient?.auth.signOut();
    set({ user: null });
  },
}));

export { cloudEnabled };
