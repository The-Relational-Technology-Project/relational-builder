import { create } from 'zustand';
import {
  isBuildDayPath,
  isNewProjectPath,
  isStudioBriefPath,
  pathForView,
  pushEntryPath,
  pushPath,
  readEntryParam,
  replacePath,
  viewForPath,
} from '@/router';
import { startNewProject } from '@/project/new-project';
import { entryKey, type EntryRef } from '@/knowledge/entry-links';
import type { RefSource } from '@/knowledge/gallery-references';

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
  | 'studio-admin'
  | 'event-admin';

interface UIState {
  view: AppView;
  setView: (view: AppView) => void;
  /** A commons entry the gallery should open on arrival (e.g. a "Drew on
   *  the commons" chip in chat) — consumed and cleared by CommonsGallery */
  galleryFocusSlug: string | null;
  openGalleryItem: (slug: string) => void;
  clearGalleryFocus: () => void;
  /** A studio library item (by id) the gallery should open on arrival — the
   *  "Drew on the studio" twin of galleryFocusSlug */
  galleryFocusStudioItemId: string | null;
  openStudioLibraryItem: (id: string) => void;
  clearStudioFocus: () => void;
  /** A KB tool or story the gallery should open on arrival — consumed by
   *  CommonsGallery once the knowledge store has it */
  galleryFocusRef: EntryRef | null;
  clearGalleryFocusRef: () => void;
  /** Open any gallery entry by (source, id) — the one door every in-line
   *  link uses (see src/knowledge/entry-links.ts) */
  openGalleryEntry: (source: RefSource, id: string) => void;
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
    pushEntryPath(entryKey('commons', slug));
  },
  clearGalleryFocus: () => set({ galleryFocusSlug: null }),
  galleryFocusStudioItemId: null,
  openStudioLibraryItem: id => {
    set({ galleryFocusStudioItemId: id, view: 'gallery' });
    pushEntryPath(entryKey('studio', id));
  },
  clearStudioFocus: () => set({ galleryFocusStudioItemId: null }),
  galleryFocusRef: null,
  clearGalleryFocusRef: () => set({ galleryFocusRef: null }),
  openGalleryEntry: (source, id) => {
    focusEntry({ source, id });
    pushEntryPath(entryKey(source, id));
  },
}));

/** Point the gallery at an entry without touching the address bar */
function focusEntry(ref: EntryRef): void {
  if (ref.source === 'commons') {
    useUIStore.setState({ galleryFocusSlug: ref.id, view: 'gallery' });
  } else if (ref.source === 'studio') {
    useUIStore.setState({ galleryFocusStudioItemId: ref.id, view: 'gallery' });
  } else {
    useUIStore.setState({ galleryFocusRef: ref, view: 'gallery' });
  }
}

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
  // /buildday the same way: start the community build day conversation
  // (the composer fills as the card's detail arrives) and sit at the builder
  if (isBuildDayPath(pathname)) {
    void import('@/project/start-build-day').then(m => m.startBuildDay());
    useUIStore.setState({ view: 'builder' });
    replacePath(pathForView('builder'));
    return;
  }
  // /studiobrief: a network partner designing their Studio, the same way
  if (isStudioBriefPath(pathname)) {
    void import('@/project/start-studio-brief').then(m => m.startStudioBrief());
    useUIStore.setState({ view: 'builder' });
    replacePath(pathForView('builder'));
    return;
  }

  const view = viewForPath(pathname);
  if (view) {
    useUIStore.setState({ view });
    // /gallery?item=commons:mutual-aid-pod — a shared link to one card
    if (view === 'gallery') {
      const entry = readEntryParam();
      if (entry) focusEntry(entry);
    }
    return;
  }

  // An address we don't know: the builder is home. Tidy the URL on arrival,
  // but never rewrite history underneath a back button.
  useUIStore.setState({ view: 'builder' });
  if (initial) replacePath(pathForView('builder'));
}
