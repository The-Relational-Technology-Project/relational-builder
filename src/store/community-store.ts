import { create } from 'zustand';
import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { useProviderStore } from '@/store/provider-store';

/**
 * Models covered by the RTP community key (mirror of the proxy's allowlist).
 * Fable 5.1 is the default for planning (project strategy, commons work); Opus
 * 5 for first builds AND edits (July 27 launch check: completest
 * mutual-aid-board build the bench has produced, at Opus 4.8's price — half
 * Fable's). Opus 4.8 stays covered as a manual pick; Sonnet 5 as the
 * lighter pick.
 */
export const COMMUNITY_MODELS = ['claude-opus-5', 'claude-fable-5-1', 'claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'];

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

    // Mirrors the llm-proxy gate: ALL token traffic counts against the daily
    // budget — input, output, and cache writes/reads — so the banner's meter
    // and the server's 429 agree.
    const today = new Date().toISOString().slice(0, 10);
    const { data: usage } = await builderClient
      .from('community_usage')
      .select('input_tokens, output_tokens, cache_creation_tokens, cache_read_tokens')
      .eq('day', today)
      .maybeSingle();

    set({
      active: true,
      dailyBudget: Number(member.daily_token_budget ?? 0),
      usedToday: usage
        ? Number(usage.input_tokens) +
          Number(usage.output_tokens) +
          Number(usage.cache_creation_tokens ?? 0) +
          Number(usage.cache_read_tokens ?? 0)
        : 0,
      checked: true,
    });

    // Community default: a member with no personal Claude key gets steered off
    // a model that would 403 — onto the stage-appropriate default (Fable 5.1
    // while planning, Opus 5 for builds and edits).
    const providers = useProviderStore.getState();
    if (
      providers.activeProviderId === 'claude' &&
      !providers.apiKeys['claude'] &&
      !COMMUNITY_MODELS.includes(providers.activeModelId)
    ) {
      const [{ useProjectStore }, { useChatStore }] = await Promise.all([
        import('@/store/project-store'),
        import('@/store/chat-store'),
      ]);
      providers.setActiveModel(
        communityDefaultModelFor(
          useChatStore.getState().mode,
          useProjectStore.getState().getFileCount(),
        ).model,
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
 * Smart model defaults for free community building — one slot per stage of a
 * project's life.
 *
 * - **Planning — Fable 5.1.** The strategy phase: exploring the project,
 *   drawing on the commons, and drafting the build plan. Owner decision
 *   (2026-08-21, project-first shift): the plan shapes everything downstream
 *   of it, and plan turns are short prose — so the strongest reasoning model
 *   costs little here ($10/$50 per MTok vs Opus 5's $5/$25, on a fraction of
 *   a build's output tokens) while its judgment leverages the whole project.
 *   The stage now has its own bench — `npm run bench -- plan` (frozen
 *   scenarios, mechanical + judge + human 0–10 scoring) — which defaults to
 *   this constant; run it before revisiting the choice.
 *   2026-09-02: Fable 5 → Fable 5.1 (owner decision). Same $10/$50 per MTok,
 *   cache reads at a quarter of Fable 5's rate, stronger reasoning, and
 *   Anthropic says Fable 5 prompts carry over as-is. The build and edit
 *   slots stay on Opus 5: Fable 5.1's output price is double, and the
 *   first-build case needs the bench (three trials against Opus 5 on the
 *   mutual-aid-board task) before it's revisited.
 * - **First build — Opus 5.** The moment the tool has to feel like magic.
 *   July 2026: matched-or-beat Fable 5 on completeness at half the cost, and
 *   clearly beat Opus 4.8 at the same cost (bench/results/2026-07-27T17-23-28db9a8).
 * - **Edits — Opus 5.** Briefly Sonnet 5 on the cost case, reverted the same
 *   day once the edit bench ran (bench/results/2026-08-02T15-33-48aa455).
 *   Sonnet is genuinely better on the common edits — identical output on a
 *   copy change, more surgical on a restyle, 41% cheaper and 30% faster — but
 *   it went 2/3 on threading a feature through two files, and the miss was
 *   the silent kind: it rendered `post.urgent` in the card and never added
 *   the field to the data, so the build bundles, renders, and the feature
 *   just never appears. Edits have no automated safety net (the quality
 *   review pass runs on first builds only), and the first real builders are
 *   arriving now. Reliability wins until n>3 says otherwise.
 *
 * Note for whoever revisits this: Opus 4.8 is NOT a cheaper edit model. It
 * lists at exactly Opus 5's price ($5/$25 per MTok). The saving that motivated
 * the Sonnet experiment is real, but it lives one tier down, not half a
 * version back.
 *
 * Only applies when the person is building on the community key AND hasn't
 * picked a model themselves (the picker pins their choice for the project).
 * BYOK and other providers are never touched.
 *
 * Returns the model to switch to AND which stage asked for it, or null when
 * no change is called for. The stage travels with the model because the
 * announcement in chat must tell the right story: a first-build switch is
 * the community default taking over from a leftover unpinned model, while
 * an edit switch is the step-down after a finished build — and with both
 * constants currently equal, comparing the returned model against
 * COMMUNITY_EDIT_MODEL cannot tell the two apart (that exact comparison once
 * showed an "edits and fixes" note to someone whose first build hadn't even
 * started).
 */
export const COMMUNITY_PLAN_MODEL = 'claude-fable-5-1';
export const COMMUNITY_FIRST_BUILD_MODEL = 'claude-opus-5';
export const COMMUNITY_EDIT_MODEL = 'claude-opus-5';

export type CommunityModelStage = 'plan' | 'first-build' | 'edit';

/** Stage → model, from what the person is doing right now. Plan mode is the
 *  plan stage whatever the file count — a rethink on a built project is
 *  still strategy work. 'message' never reaches a model, but typing the
 *  union here lets callers pass the chat mode straight through. */
export function communityDefaultModelFor(
  chatMode: 'plan' | 'build' | 'message',
  projectFileCount: number,
): { model: string; stage: CommunityModelStage } {
  const stage: CommunityModelStage =
    chatMode === 'plan' ? 'plan' : projectFileCount === 0 ? 'first-build' : 'edit';
  const model =
    stage === 'plan'
      ? COMMUNITY_PLAN_MODEL
      : stage === 'first-build'
        ? COMMUNITY_FIRST_BUILD_MODEL
        : COMMUNITY_EDIT_MODEL;
  return { model, stage };
}

export function resolveCommunityModelDefault(
  projectFileCount: number,
  chatMode: 'plan' | 'build' | 'message' = 'build',
): { model: string; stage: CommunityModelStage } | null {
  const providers = useProviderStore.getState();
  const autoManaged =
    useCommunityStore.getState().active &&
    providers.activeProviderId === 'claude' &&
    !providers.apiKeys['claude'] &&
    !providers.modelPinned;
  if (!autoManaged) return null;

  const { model: desired, stage } = communityDefaultModelFor(chatMode, projectFileCount);
  return providers.activeModelId === desired ? null : { model: desired, stage };
}
