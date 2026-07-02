import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listStudios, fetchStudio, type StudioContext } from '@/knowledge/studio-context';

/**
 * Active studio frame. A builder can work inside a Studio's frame — its
 * principles layered on the base, its identity in the project lineage —
 * or with the global commons alone (the default).
 *
 * Deep links work: /?studio=thread activates that studio on load, so a
 * Studio can link its members straight into a studio-framed Builder.
 */

interface StudioState {
  activeStudio: StudioContext | null;
  studios: StudioContext[];
  loaded: boolean;
  init: () => Promise<void>;
  loadStudios: () => Promise<void>;
  setStudio: (studio: StudioContext | null) => void;
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      activeStudio: null,
      studios: [],
      loaded: false,

      init: async () => {
        // URL param wins over the persisted choice
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
        get().loadStudios();
      },

      loadStudios: async () => {
        const studios = await listStudios();
        set({ studios, loaded: true });
      },

      setStudio: (studio) => set({ activeStudio: studio }),
    }),
    {
      name: 'rb-studio',
      partialize: (s) => ({ activeStudio: s.activeStudio }),
    },
  ),
);
