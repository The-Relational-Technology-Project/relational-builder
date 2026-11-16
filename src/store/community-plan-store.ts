import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_COMMUNITY_PLAN, isCommunityPlanId, type CommunityPlanId } from '@/cloud/community-plans';

/**
 * Which community plan a person builds on (src/cloud/community-plans.ts),
 * mirrored locally so routing can read it synchronously. The profile row is
 * the source of truth for a signed-in builder (`profiles.community_plan`):
 * auth-store adopts it on every profile load. `null` means they have not
 * chosen, so the default applies and can change under them; a choice sticks.
 */
interface CommunityPlanState {
  plan: CommunityPlanId | null;
  setPlan: (plan: CommunityPlanId) => void;
  /** Adopt the profile's value (ignores anything unrecognised, including null) */
  adopt: (value: unknown) => void;
}

export const useCommunityPlanStore = create<CommunityPlanState>()(
  persist(
    (set) => ({
      plan: null,
      setPlan: (plan) => set({ plan }),
      adopt: (value) => {
        if (isCommunityPlanId(value)) set({ plan: value });
      },
    }),
    { name: 'rb-community-plan' },
  ),
);

/** The plan in effect: the person's choice, else the default */
export function currentCommunityPlan(): CommunityPlanId {
  return useCommunityPlanStore.getState().plan ?? DEFAULT_COMMUNITY_PLAN;
}
