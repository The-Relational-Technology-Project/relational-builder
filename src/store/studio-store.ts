import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listStudios, fetchStudio, DEFAULT_STUDIO_SLUG, type StudioContext } from '@/knowledge/studio-context';
import {
  listMyStudioMemberships,
  joinStudio as joinStudioCloud,
  leaveStudio as leaveStudioCloud,
  type StudioMembership,
} from '@/cloud/studios';
import { useAuthStore } from '@/store/auth-store';

/**
 * Active studio frame + studio membership. A builder can work inside a
 * Studio's frame — its principles layered on the base, its identity in the
 * project lineage — and can BELONG to studios: membership makes the studio's
 * life (shares, new joins) show up on their home, and their joining shows
 * up for everyone else in the studio.
 *
 * Deep links work: /?studio=thread activates that studio on load, so a
 * Studio can link its members straight into a studio-framed Builder.
 */

interface StudioState {
  activeStudio: StudioContext | null;
  studios: StudioContext[];
  loaded: boolean;
  /** Studios this builder belongs to (loaded per signed-in user) */
  memberships: StudioMembership[];
  membershipsLoaded: boolean;
  init: () => Promise<void>;
  loadStudios: () => Promise<void>;
  loadMemberships: () => Promise<void>;
  joinStudio: (studio: StudioContext) => Promise<void>;
  leaveStudio: (slug: string) => Promise<void>;
  setStudio: (studio: StudioContext | null) => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      activeStudio: null,
      studios: [],
      loaded: false,
      memberships: [],
      membershipsLoaded: false,

      init: async () => {
        // URL param wins over the persisted choice — this is how a Studio
        // links its members in, including studios not yet listed publicly
        const param = new URLSearchParams(window.location.search).get('studio');
        if (param) {
          const studio = await fetchStudio(param);
          if (studio) {
            set({ activeStudio: studio });
            // Tidy the URL so refreshes don't re-trigger
            const url = new URL(window.location.href);
            url.searchParams.delete('studio');
            window.history.replaceState({}, '', url.toString());
          }
        } else if (get().activeStudio) {
          // Refresh the persisted studio's config (principles may have changed)
          const fresh = await fetchStudio(get().activeStudio!.slug);
          if (fresh) set({ activeStudio: fresh });
        }
        // Every builder works inside a studio frame — the global commons is
        // always tapped underneath, so "no studio" isn't a state anymore
        if (!get().activeStudio) {
          const fallback = await fetchStudio(DEFAULT_STUDIO_SLUG);
          if (fallback) set({ activeStudio: fallback });
        }
        get().loadStudios();

        // Memberships follow the signed-in user
        let lastUserId: string | null = null;
        useAuthStore.subscribe((state) => {
          const id = state.user?.id ?? null;
          if (id !== lastUserId) {
            lastUserId = id;
            if (id) get().loadMemberships();
            else set({ memberships: [], membershipsLoaded: false });
          }
        });
        if (useAuthStore.getState().user) get().loadMemberships();
      },

      loadStudios: async () => {
        const studios = await listStudios();
        set({ studios, loaded: true });
      },

      loadMemberships: async () => {
        const memberships = await listMyStudioMemberships();
        set({ memberships, membershipsLoaded: true });
      },

      joinStudio: async (studio: StudioContext) => {
        const ok = await joinStudioCloud(studio.slug, studio.label);
        if (ok) await get().loadMemberships();
      },

      leaveStudio: async (slug: string) => {
        await leaveStudioCloud(slug);
        await get().loadMemberships();
      },

      setStudio: (studio) => set({ activeStudio: studio }),
    }),
    {
      name: 'rb-studio',
      partialize: (s) => ({ activeStudio: s.activeStudio }),
    },
  ),
);
