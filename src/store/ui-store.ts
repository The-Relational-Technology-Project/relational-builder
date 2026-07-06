import { create } from 'zustand';

/**
 * App-level view state that more than one surface needs to reach — e.g. the
 * Studio Gallery is toggled from the main nav AND from the home screen's
 * start-from options.
 */
interface UIState {
  galleryOpen: boolean;
  setGalleryOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>(set => ({
  galleryOpen: false,
  setGalleryOpen: open => set({ galleryOpen: open }),
}));
