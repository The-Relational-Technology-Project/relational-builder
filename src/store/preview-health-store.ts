import { create } from 'zustand';

/**
 * One shared answer to "is the preview standing right now?" — reported by
 * whichever engine is mounted (the esbuild bundler or Sandpack) and read by
 * the chat's first-build "cooking" state, which only reveals the finished
 * build once the preview actually compiled.
 *
 * 'idle' means no engine is reporting (preview unmounted, or nothing built
 * yet) — treat it as "nothing to wait for", never as a failure.
 */
export type PreviewHealth = 'idle' | 'building' | 'ok' | 'error';

interface PreviewHealthState {
  health: PreviewHealth;
  setHealth: (health: PreviewHealth) => void;
}

export const usePreviewHealthStore = create<PreviewHealthState>(set => ({
  health: 'idle',
  setHealth: health => set(state => (state.health === health ? state : { health })),
}));
