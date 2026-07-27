import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { listStudios, fetchStudio, DEFAULT_STUDIO_SLUG, type StudioContext } from '@/knowledge/studio-context';
import {
  listMyStudioMemberships,
  joinStudio as joinStudioCloud,
  leaveStudio as leaveStudioCloud,
  fetchStudioAccessMap,
  type StudioMembership,
  type MembershipStatus,
  type StudioAccess,
} from '@/cloud/studios';
import { fetchVisibleStudioItems, type StudioLibraryItem } from '@/cloud/studio-library';
import { useAuthStore } from '@/store/auth-store';

/**
 * Active studio frame + studio membership. A builder can work inside a
 * Studio's frame — its principles layered on the base, its identity in the
 * project lineage — and can BELONG to studios: membership makes the studio's
 * life (shares, new joins) show up on their home, and their joining shows
 * up for everyone else in the studio.
 *
 * Gated studios (like Thread Studio) add a door and a shelf: joining files a
 * request for a Studio Admin, and approved members get the studio's private
 * library — in the gallery and woven into the AI's context as they build.
 *
 * Deep links work: /?studio=thread activates that studio on load, so a
 * Studio can link its members straight into a studio-framed Builder.
 */

interface StudioState {
  activeStudio: StudioContext | null;
  /**
   * True once the builder explicitly picked a studio (switcher or deep
   * link). Until then the active studio is only a fallback, and an approved
   * membership in a non-default studio wins over it — signing in is enough
   * to put a Thread fellow inside the Thread frame.
   */
  studioChosen: boolean;
  studios: StudioContext[];
  loaded: boolean;
  /** Studios this builder belongs to — including pending gated requests */
  memberships: StudioMembership[];
  membershipsLoaded: boolean;
  /** slug → 'open' | 'gated', from studio_settings (public read) */
  accessMap: Map<string, StudioAccess>;
  /** Every studio library item this builder can see (RLS decides) */
  library: StudioLibraryItem[];
  libraryLoaded: boolean;
  init: () => Promise<void>;
  loadStudios: () => Promise<void>;
  loadMemberships: () => Promise<void>;
  loadLibrary: () => Promise<void>;
  joinStudio: (studio: StudioContext) => Promise<MembershipStatus | null>;
  leaveStudio: (slug: string) => Promise<void>;
  setStudio: (studio: StudioContext | null) => void;
}

/** Approved memberships only — pending requests don't grant anything yet */
export function approvedMemberships(memberships: StudioMembership[]): StudioMembership[] {
  return memberships.filter(m => m.status === 'approved');
}

/** Studios where this builder holds the Studio Admin role */
export function adminMemberships(memberships: StudioMembership[]): StudioMembership[] {
  return memberships.filter(m => m.status === 'approved' && m.role === 'admin');
}

export const useStudioStore = create<StudioState>()(
  persist(
    (set, get) => ({
      activeStudio: null,
      studioChosen: false,
      studios: [],
      loaded: false,
      memberships: [],
      membershipsLoaded: false,
      accessMap: new Map(),
      library: [],
      libraryLoaded: false,

      init: async () => {
        // URL param wins over the persisted choice — this is how a Studio
        // links its members in, including studios not yet listed publicly
        const param = new URLSearchParams(window.location.search).get('studio');
        if (param) {
          const studio = await fetchStudio(param);
          if (studio) {
            set({ activeStudio: studio, studioChosen: true });
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
        fetchStudioAccessMap().then(accessMap => set({ accessMap })).catch(() => {});

        // Memberships follow the signed-in user
        let lastUserId: string | null = null;
        useAuthStore.subscribe((state) => {
          const id = state.user?.id ?? null;
          if (id !== lastUserId) {
            lastUserId = id;
            if (id) get().loadMemberships();
            else set({ memberships: [], membershipsLoaded: false, library: [], libraryLoaded: false });
          }
        });
        if (useAuthStore.getState().user) get().loadMemberships();
      },

      loadStudios: async () => {
        const studios = await listStudios();
        // Keep member studios (merged below) that the public list doesn't carry
        const extras = get().studios.filter(
          s => !studios.some(pub => pub.slug === s.slug),
        );
        set({ studios: [...studios, ...extras], loaded: true });
      },

      loadMemberships: async () => {
        const memberships = await listMyStudioMemberships();
        set({ memberships, membershipsLoaded: true });
        // Approved membership makes a studio yours even when it isn't listed
        // publicly — pull its config so the switcher and gallery can show it
        const known = new Set(get().studios.map(s => s.slug));
        const missing = approvedMemberships(memberships)
          .map(m => m.studio_slug)
          .filter(slug => !known.has(slug));
        if (missing.length > 0) {
          const fetched = await Promise.all(missing.map(fetchStudio));
          const extras = fetched.filter((s): s is StudioContext => !!s);
          if (extras.length > 0) {
            set(state => ({
              studios: [
                ...state.studios,
                ...extras.filter(e => !state.studios.some(s => s.slug === e.slug)),
              ],
            }));
          }
        }
        // Membership decides the frame until the builder chooses one
        // themselves: an approved member of a non-default studio who signed
        // in via the plain URL should land inside THEIR studio, not the
        // default fallback. (The July workshop cohort built outside the
        // Thread frame because only the deep link ever activated it.)
        if (!get().studioChosen) {
          const memberSlugs = approvedMemberships(memberships)
            .map(m => m.studio_slug)
            .filter(slug => slug !== DEFAULT_STUDIO_SLUG);
          const current = get().activeStudio?.slug;
          if (memberSlugs.length > 0 && !memberSlugs.includes(current ?? '')) {
            const home =
              get().studios.find(s => s.slug === memberSlugs[0]) ??
              (await fetchStudio(memberSlugs[0]));
            // Re-check: the builder may have picked a studio while we fetched
            if (home && !get().studioChosen) set({ activeStudio: home });
          }
        }
        void get().loadLibrary();
      },

      loadLibrary: async () => {
        const library = await fetchVisibleStudioItems();
        set({ library, libraryLoaded: true });
      },

      joinStudio: async (studio: StudioContext) => {
        const status = await joinStudioCloud(studio.slug, studio.label);
        if (status) await get().loadMemberships();
        return status;
      },

      leaveStudio: async (slug: string) => {
        await leaveStudioCloud(slug);
        await get().loadMemberships();
      },

      setStudio: (studio) => set({ activeStudio: studio, studioChosen: true }),
    }),
    {
      name: 'rb-studio',
      partialize: (s) => ({ activeStudio: s.activeStudio, studioChosen: s.studioChosen }),
    },
  ),
);
