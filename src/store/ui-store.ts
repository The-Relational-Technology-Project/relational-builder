import { create } from 'zustand';

/**
 * App-level view state that more than one surface needs to reach — e.g. the
 * The Commons Gallery is opened from the main nav AND from the home screen's
 * start-from options.
 *
 * The main area shows exactly one view at a time: the builder itself, or one
 * of the full-width pages (Gallery, Projects, Connections, Steward). Pages
 * are plain destinations — the nav navigates between them, and returning to
 * the builder happens through the header (project name / wordmark), not
 * per-page close buttons.
 */
export type AppView = 'builder' | 'gallery' | 'projects' | 'connections' | 'steward';

interface UIState {
  view: AppView;
  setView: (view: AppView) => void;
}

export const useUIStore = create<UIState>(set => ({
  view: 'builder',
  setView: view => set({ view }),
}));
