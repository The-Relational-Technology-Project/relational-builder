import { create } from 'zustand';

/**
 * App-level view state that more than one surface needs to reach — e.g. the
 * Studio Gallery is toggled from the main nav AND from the home screen's
 * start-from options.
 *
 * Gallery, Projects, and Steward are full-width pages that share the main
 * area — opening one closes the others.
 */
interface UIState {
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
  projectsOpen: boolean;
  setProjectsOpen: (open: boolean) => void;
  stewardOpen: boolean;
  setStewardOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>(set => ({
  galleryOpen: false,
  setGalleryOpen: open =>
    set({ galleryOpen: open, ...(open ? { projectsOpen: false, stewardOpen: false } : {}) }),
  projectsOpen: false,
  setProjectsOpen: open =>
    set({ projectsOpen: open, ...(open ? { galleryOpen: false, stewardOpen: false } : {}) }),
  stewardOpen: false,
  setStewardOpen: open =>
    set({ stewardOpen: open, ...(open ? { galleryOpen: false, projectsOpen: false } : {}) }),
}));
