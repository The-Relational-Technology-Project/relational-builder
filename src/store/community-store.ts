import { create } from 'zustand';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { useProviderStore } from '@/store/provider-store';

/**
 * Models covered by the RTP community key (mirror of the proxy's allowlist).
 * Opus 4.8 is the default — early adopters get the best model; Sonnet 5 is
 * the lighter choice. Smart throttling (e.g. after initial builds) can come
 * later.
 */
export const COMMUNITY_MODELS = ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];

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

    // Membership is granted only by a steward approving an account request —
    // passcode self-enrollment is retired.
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

    // Community default: a member with no personal Claude key gets steered off
    // a model that would 403 — onto the stage-appropriate default (Opus for a
    // fresh project, Sonnet 5 once it has files).
    const providers = useProviderStore.getState();
    if (
      providers.activeProviderId === 'claude' &&
      !providers.apiKeys['claude'] &&
      !COMMUNITY_MODELS.includes(providers.activeModelId)
    ) {
      const { useProjectStore } = await import('@/store/project-store');
      providers.setActiveModel(
        useProjectStore.getState().getFileCount() === 0
          ? COMMUNITY_FIRST_BUILD_MODEL
          : COMMUNITY_EDIT_MODEL,
      );
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

/**
 * Smart model defaults for free community building: Opus 4.8 does the first
 * build (vision and architecture are where the best model earns its cost),
 * Sonnet 5 picks up the edits — faster, and ~5× lighter on the shared budget.
 *
 * Only applies when the person is building on the community key AND hasn't
 * picked a model themselves (the picker pins their choice for the project).
 * BYOK and other providers are never touched.
 *
 * Returns the model to switch to, or null when no change is called for.
 */
export const COMMUNITY_FIRST_BUILD_MODEL = 'claude-opus-4-8';
export const COMMUNITY_EDIT_MODEL = 'claude-sonnet-5';

export function resolveCommunityModelDefault(projectFileCount: number): string | null {
  const providers = useProviderStore.getState();
  const autoManaged =
    useCommunityStore.getState().active &&
    providers.activeProviderId === 'claude' &&
    !providers.apiKeys['claude'] &&
    !providers.modelPinned;
  if (!autoManaged) return null;

  const desired =
    projectFileCount === 0 ? COMMUNITY_FIRST_BUILD_MODEL : COMMUNITY_EDIT_MODEL;
  return providers.activeModelId === desired ? null : desired;
}
