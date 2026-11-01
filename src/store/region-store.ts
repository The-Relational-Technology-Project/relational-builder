import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { isRegionMode, type RegionMode } from '@/regions/regions';

/**
 * The active regional mode, mirrored locally so preview, publish, and the
 * prompt can read it synchronously. The profile row is the source of truth
 * for a signed-in builder (`profiles.region_mode`): auth-store adopts it on
 * every profile load, and the profile page saves through `saveProfile`.
 * Signed out, the local value stands on its own — a person can still build
 * in EU mode in this browser.
 */
interface RegionState {
  mode: RegionMode;
  setMode: (mode: RegionMode) => void;
  /** Adopt the profile's value (ignores anything unrecognised) */
  adopt: (value: unknown) => void;
}

export const useRegionStore = create<RegionState>()(
  persist(
    (set) => ({
      mode: 'global',
      setMode: (mode) => set({ mode }),
      adopt: (value) => {
        if (isRegionMode(value)) set({ mode: value });
      },
    }),
    { name: 'rb-region-mode' },
  ),
);

/** Snapshot read for non-React modules (bundler, publish, prompt assembly) */
export function currentRegionMode(): RegionMode {
  return useRegionStore.getState().mode;
}
