import { create } from 'zustand';
import { builderClient, cloudEnabled } from '@/cloud/builder-client';

/**
 * Where a magic link should land the builder. In production this is pinned to
 * the canonical domain (VITE_SITE_URL, e.g. https://relationalbuilder.org) so a
 * sign-in started on any origin — a *.vercel.app preview, an old bookmark —
 * still returns to the real front door. Unset (local dev) falls back to the
 * current origin. NB: the target must also be in Supabase Auth's Redirect URLs
 * allow-list, or Supabase ignores it and uses its own Site URL.
 */
function siteUrl(): string {
  const configured = import.meta.env.VITE_SITE_URL as string | undefined;
  return configured?.replace(/\/$/, '') || window.location.origin;
}

/**
 * After a magic-link redirect Supabase consumes the token from the URL hash
 * but can leave a bare "#" (or the spent token) behind. Wipe it so the address
 * bar reads clean.
 */
function clearAuthHash() {
  const h = window.location.hash;
  if (h === '#' || h.includes('access_token') || h.includes('error=')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
}

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
  /** Bumping this opens the sign-in dialog from anywhere in the app */
  signInPromptCount: number;
  promptSignIn: () => void;

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
  signInPromptCount: 0,
  promptSignIn: () => set(s => ({ signInPromptCount: s.signInPromptCount + 1 })),

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
      // Token's been consumed by now — tidy the address bar
      clearAuthHash();
    });
  },

  signIn: async (email: string) => {
    if (!builderClient) return { error: 'Cloud features are not configured' };
    const { error } = await builderClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: siteUrl() },
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
