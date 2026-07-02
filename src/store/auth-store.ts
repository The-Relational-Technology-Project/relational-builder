import { create } from 'zustand';
import { builderClient, cloudEnabled } from '@/cloud/builder-client';

export interface AuthUser {
  id: string;
  email: string;
}

/** Builder profile — grounded in a place, woven into build chats */
export interface BuilderProfile {
  display_name: string | null;
  full_name: string | null;
  neighborhood: string | null;
  neighborhood_description: string | null;
  dreams: string | null;
  tech_familiarity: string | null;
  ai_coding_experience: string | null;
  email_opt_in: boolean | null;
  profile_completed: boolean;
  /** The builder's own mini design system, woven into new builds */
  design_system: string | null;
  /** Connections: opt-in visibility + how others may reach you */
  open_to_connecting: boolean;
  connect_note: string | null;
  cal_link: string | null;
  allow_requests: boolean;
}

interface AuthState {
  user: AuthUser | null;
  profile: BuilderProfile | null;
  /** True once the profile row has been fetched (or there's no user) */
  profileLoaded: boolean;
  initialized: boolean;

  /** Wire up the Supabase auth listener — call once on app mount */
  init: () => void;
  /** Send a magic link to the given email */
  signIn: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  saveProfile: (fields: Partial<BuilderProfile>) => Promise<{ error: string | null }>;
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  profile: null,
  profileLoaded: false,
  initialized: false,

  init: () => {
    if (get().initialized || !builderClient) {
      set({ initialized: true, profileLoaded: true });
      return;
    }
    set({ initialized: true });

    builderClient.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      set({ user: u?.email ? { id: u.id, email: u.email } : null });
      get().refreshProfile();
    });

    builderClient.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      const prev = get().user?.id;
      set({ user: u?.email ? { id: u.id, email: u.email } : null });
      if (u?.id !== prev) get().refreshProfile();
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
    set({ user: null, profile: null, profileLoaded: true });
  },

  refreshProfile: async () => {
    const user = get().user;
    if (!builderClient || !user) {
      set({ profile: null, profileLoaded: true });
      return;
    }
    const { data } = await builderClient
      .from('profiles')
      .select('display_name, full_name, neighborhood, neighborhood_description, dreams, tech_familiarity, ai_coding_experience, email_opt_in, profile_completed, design_system, open_to_connecting, connect_note, cal_link, allow_requests')
      .eq('id', user.id)
      .maybeSingle();
    set({ profile: (data as BuilderProfile | null) ?? null, profileLoaded: true });
  },

  saveProfile: async (fields) => {
    const user = get().user;
    if (!builderClient || !user) return { error: 'Sign in first' };
    const { error } = await builderClient
      .from('profiles')
      .update(fields)
      .eq('id', user.id);
    if (!error) {
      set({ profile: { ...(get().profile ?? ({} as BuilderProfile)), ...fields } as BuilderProfile });
    }
    return { error: error?.message ?? null };
  },
}));

export { cloudEnabled };
