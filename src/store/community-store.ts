import { create } from 'zustand';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';

/**
 * Community access (Tier 3): RTP-subsidized Claude for invited builders.
 * Membership lives in the Builder backend (community_members, RLS lets each
 * person see only their own row). The shared Anthropic key stays server-side
 * in the llm-proxy — the client only ever sends the user's session token.
 */

interface CommunityState {
  active: boolean;
  dailyBudget: number;
  usedToday: number;
  checked: boolean;

  check: () => Promise<void>;
  init: () => void;
}

export const useCommunityStore = create<CommunityState>()((set) => ({
  active: false,
  dailyBudget: 0,
  usedToday: 0,
  checked: false,

  check: async () => {
    const user = useAuthStore.getState().user;
    if (!builderClient || !user) {
      set({ active: false, dailyBudget: 0, usedToday: 0, checked: true });
      return;
    }

    const { data: member } = await builderClient
      .from('community_members')
      .select('daily_token_budget')
      .maybeSingle();

    if (!member) {
      set({ active: false, dailyBudget: 0, usedToday: 0, checked: true });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await builderClient
      .from('community_usage')
      .select('input_tokens, output_tokens')
      .eq('day', today)
      .maybeSingle();

    set({
      active: true,
      dailyBudget: Number(member.daily_token_budget ?? 0),
      usedToday: usage ? Number(usage.input_tokens) + Number(usage.output_tokens) : 0,
      checked: true,
    });
  },

  init: () => {
    // Re-check whenever the signed-in user changes
    let lastUserId: string | null = null;
    useAuthStore.subscribe((state) => {
      const id = state.user?.id ?? null;
      if (id !== lastUserId) {
        lastUserId = id;
        useCommunityStore.getState().check();
      }
    });
    useCommunityStore.getState().check();
  },
}));

/** Session token for the proxy's community gate (null when signed out) */
export async function getCommunitySessionToken(): Promise<string | null> {
  if (!builderClient) return null;
  const { data } = await builderClient.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Non-React accessor for provider code */
export function communityAccessActive(): boolean {
  return useCommunityStore.getState().active;
}
