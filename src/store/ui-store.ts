import { create } from 'zustand';
import {
  isNewProjectPath,
  pathForView,
  pushPath,
  replacePath,
  viewForPath,
} from '@/router';
import { startNewProject } from '@/project/new-project';

/**
 * App-level view state that more than one surface needs to reach — e.g. the
 * The Commons Gallery is opened from the main nav AND from the home screen's
 * start-from options.
 *
 * The main area shows exactly one view at a time: the builder itself, or one
 * of the full-width pages (Gallery, Projects, Connections, Steward). Every
 * one of them is a real address (see `src/router.ts`): `setView` writes it to
 * the URL, so pages can be linked, bookmarked, reloaded, and walked back
 * through with the browser's own back button.
 */
export type AppView =
  | 'builder'
  | 'home'
  | 'gallery'
  | 'dream'
  | 'projects'
  | 'connections'
  | 'profile'
  | 'steward'
  | 'studio-admin';

interface UIState {
  view: AppView;
  setView: (view: AppView) => void;
  /** A commons entry the gallery should open on arrival (e.g. a "Drew on
   *  the commons" chip in chat) — consumed and cleared by CommonsGallery */
  galleryFocusSlug: string | null;
  openGalleryItem: (slug: string) => void;
  clearGalleryFocus: () => void;
}

export const useUIStore = create<UIState>(set => ({
  // The address bar is the source of truth from the first paint — initRouting
  // adopts it on mount, and this is the fallback until then
  view: 'builder',
  setView: view => {
    set({ view });
    pushPath(pathForView(view));
  },
  galleryFocusSlug: null,
  openGalleryItem: slug => {
    set({ galleryFocusSlug: slug, view: 'gallery' });
    pushPath(pathForView('gallery'));
  },
  clearGalleryFocus: () => set({ galleryFocusSlug: null }),
}));

/**
 * Adopt the view from the address bar, and keep it in step with the browser's
 * back/forward buttons. Called once from App.
 */
let routingStarted = false;

export function initRouting(): void {
  if (routingStarted) return;
  routingStarted = true;
  applyLocation(true);
  window.addEventListener('popstate', () => applyLocation(false));
}

function applyLocation(initial: boolean): void {
  const { pathname } = window.location;

  // /new is an action, not a page: do the thing, then sit at the builder's
  // own address so a reload doesn't wipe the work that just started
  if (isNewProjectPath(pathname)) {
    startNewProject();
    useUIStore.setState({ view: 'builder' });
    replacePath(pathForView('builder'));
    return;
  }

  const view = viewForPath(pathname);
  if (view) {
    useUIStore.setState({ view });
    return;
  }

  // An address we don't know: the builder is home. Tidy the URL on arrival,
  // but never rewrite history underneath a back button.
  useUIStore.setState({ view: 'builder' });
  if (initial) replacePath(pathForView('builder'));
}
