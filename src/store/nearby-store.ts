import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '@/store/safe-storage';
import {
  DEFAULT_NEARBY_RADIUS_MILES,
  geocodePlace,
  locateMe,
  type GeoPoint,
} from '@/knowledge/geo';

/**
 * Where the gallery's Nearby filter measures from. One place per browser,
 * remembered across visits: a person sets it once (their browser's location,
 * or a typed town) and the commons reads local from then on. Nothing here
 * leaves the device except the typed words sent to the geocoder.
 */
interface NearbyState {
  point: GeoPoint | null;
  radiusMiles: number;
  /** Something in flight: the browser locating, or a place being looked up */
  busy: boolean;
  /** What went wrong last time, in words for the person */
  error: string | null;
  setRadius: (miles: number) => void;
  setPoint: (point: GeoPoint | null) => void;
  /** Ask the browser */
  locate: () => Promise<boolean>;
  /** Look a typed place up */
  findPlace: (query: string) => Promise<boolean>;
}

export const useNearbyStore = create<NearbyState>()(
  persist(
    set => ({
      point: null,
      radiusMiles: DEFAULT_NEARBY_RADIUS_MILES,
      busy: false,
      error: null,
      setRadius: miles => set({ radiusMiles: miles }),
      setPoint: point => set({ point, error: null }),
      locate: async () => {
        set({ busy: true, error: null });
        const point = await locateMe();
        set({
          busy: false,
          ...(point
            ? { point }
            : { error: 'Your browser did not share a location. Type a town or neighborhood instead.' }),
        });
        return point !== null;
      },
      findPlace: async query => {
        set({ busy: true, error: null });
        const point = await geocodePlace(query);
        set({
          busy: false,
          ...(point ? { point } : { error: `Couldn't find "${query.trim()}". Try a town and state, or a city.` }),
        });
        return point !== null;
      },
    }),
    {
      name: 'rb-nearby',
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: s => ({ point: s.point, radiusMiles: s.radiusMiles }),
    },
  ),
);
