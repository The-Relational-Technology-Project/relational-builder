import { create } from 'zustand';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { useProviderStore } from '@/store/provider-store';

/** Models covered by the RTP community key (mirror of the proxy's allowlist) */
export const COMMUNITY_MODELS = ['claude-sonnet-5', 'claude-haiku-4-5'];

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

    let { data: member } = await builderClient
      .from('community_members')
      .select('daily_token_budget')
      .maybeSingle();

    if (!member) {
      // Holding the invitation passcode + being signed in IS the invite —
      // enroll automatically instead of dead-ending at "add your API key"
      const enrolled = await tryEnrollWithPasscode();
      if (enrolled) {
        const retry = await builderClient
          .from('community_members')
          .select('daily_token_budget')
          .maybeSingle();
        member = retry.data;
      }
    }

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

    // Community default: a member with no personal Claude key gets steered to
    // Sonnet 5 (the pilot's covered model) instead of a model that would 403.
    const providers = useProviderStore.getState();
    if (
      providers.activeProviderId === 'claude' &&
      !providers.apiKeys['claude'] &&
      !COMMUNITY_MODELS.includes(providers.activeModelId)
    ) {
      providers.setActiveModel('claude-sonnet-5');
    }
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

let enrollAttempted = false;

/** One-shot self-enrollment using the stored invitation passcode */
async function tryEnrollWithPasscode(): Promise<boolean> {
  if (enrollAttempted || !builderClient) return false;
  enrollAttempted = true;
  const passcode = localStorage.getItem('rb-access-granted');
  if (!passcode) return false;
  try {
    const { data } = await builderClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return false;
    const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
    const res = await fetch(`${url}/functions/v1/enroll-community`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ passcode }),
    });
    const result = await res.json().catch(() => ({}));
    return res.ok && result.ok === true;
  } catch {
    return false;
  }
}

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
