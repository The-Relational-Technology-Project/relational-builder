import { create } from 'zustand';

/**
 * App-level view state that more than one surface needs to reach — e.g. the
 * Studio Gallery is toggled from the main nav AND from the home screen's
 * start-from options.
 */
interface UIState {
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
  /** The Projects page — a full-width space for cloud projects, live sites,
   *  and the prompt library. Opening it closes the Gallery (they share the
   *  main area). */
  projectsOpen: boolean;
  setProjectsOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>(set => ({
  galleryOpen: false,
  setGalleryOpen: open => set({ galleryOpen: open, ...(open ? { projectsOpen: false } : {}) }),
  projectsOpen: false,
  setProjectsOpen: open => set({ projectsOpen: open, ...(open ? { galleryOpen: false } : {}) }),
}));
