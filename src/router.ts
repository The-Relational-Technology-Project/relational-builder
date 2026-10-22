/**
 * Real addresses for the app's pages.
 *
 * Gallery, Projects and the builder used to be one in-memory `view` with no
 * URL: a page you could reach but not link to, not bookmark, and not come
 * back to after a reload — and the browser's back button had nothing to go
 * back to. Each destination now has a path, so guessing `/gallery` works,
 * sharing a link works, and back/forward behave the way they do everywhere
 * else on the web.
 *
 * Deliberately tiny: a map, two history helpers, no router library. The app
 * has one axis of navigation (which page fills the main area) and no route
 * params — anything more would be scaffolding around a `Record`.
 *
 * `#privacy` / `#contact` stay hash pages: they're published links that
 * predate this, and they render above the app shell (see Landing).
 */

import type { AppView } from '@/store/ui-store';

/** Every view that has an address. The builder is the app's root. */
const VIEW_PATHS: Record<AppView, string> = {
  builder: '/',
  // The lobby: reachable any time (the wordmark points here) while an open
  // project stays warm at '/'. An empty workspace shows the same dashboard
  // at '/' — two addresses, one screen, no project lost either way.
  home: '/home',
  gallery: '/gallery',
  dream: '/dream',
  projects: '/projects',
  connections: '/connections',
  profile: '/profile',
  steward: '/steward',
  'studio-admin': '/studio-admin',
  'event-admin': '/event-admin',
};

/**
 * An address that *does* something rather than showing something: opening it
 * starts a fresh project and lands in the builder. Kept as a path because
 * "new project" is a place people link to and bookmark.
 */
export const NEW_PROJECT_PATH = '/new';

/**
 * Another doing-address: opening it starts the community build day
 * conversation (the featured commons card's "Build yours") and lands in the
 * builder. The /buildtogether page links here, so it is a place people
 * share and bookmark.
 */
export const BUILD_DAY_PATH = '/buildday';

/**
 * And a third: opening it starts the "design your studio" conversation for a
 * network partner (a Studio Brief and a one-page site to share with RTP).
 * The /studios page links here.
 */
export const STUDIO_BRIEF_PATH = '/studiobrief';

export function pathForView(view: AppView): string {
  return VIEW_PATHS[view] ?? '/';
}

/** Trailing slashes and casing are the same address to a person */
function normalize(pathname: string): string {
  const p = pathname.replace(/\/+$/, '').toLowerCase();
  return p === '' ? '/' : p;
}

export function viewForPath(pathname: string): AppView | null {
  const p = normalize(pathname);
  for (const [view, path] of Object.entries(VIEW_PATHS) as [AppView, string][]) {
    if (path === p) return view;
  }
  return null;
}

export function isNewProjectPath(pathname: string): boolean {
  return normalize(pathname) === NEW_PROJECT_PATH;
}

export function isBuildDayPath(pathname: string): boolean {
  return normalize(pathname) === BUILD_DAY_PATH;
}

export function isStudioBriefPath(pathname: string): boolean {
  return normalize(pathname) === STUDIO_BRIEF_PATH;
}

/**
 * The query string carries things the app is mid-way through — an invite's
 * params, a shared prompt — so navigation keeps it. The hash doesn't survive:
 * it's either a page that isn't ours (#privacy) or a spent magic-link token.
 */
function urlFor(path: string): string {
  // The gallery's shelf (?shelf=) is the gallery's own: it rides reloads
  // and back/forward there, and is dropped on the way to any other page
  const params = new URLSearchParams(window.location.search);
  if (normalize(path) !== VIEW_PATHS.gallery) params.delete(SHELF_PARAM);
  const q = params.toString();
  return path + (q ? `?${q}` : '');
}

/**
 * Which shelf the gallery is open on: the commons when absent, a studio's
 * slug, or an event's `event:CODE`. A studio or event gallery is a place
 * people link to and come back from, so it has an address.
 */
const SHELF_PARAM = 'shelf';

export function readShelfParam(): string | null {
  const v = new URLSearchParams(window.location.search).get(SHELF_PARAM)?.trim();
  return v ? v : null;
}

/** Write the shelf into the address as a new history entry (null = the commons) */
export function writeShelfParam(shelf: string | null): void {
  const params = new URLSearchParams(window.location.search);
  if (shelf) params.set(SHELF_PARAM, shelf); else params.delete(SHELF_PARAM);
  const q = params.toString();
  const next = window.location.pathname + (q ? `?${q}` : '');
  if (next === window.location.pathname + window.location.search) return;
  window.history.pushState(null, '', next);
}

export function pushPath(path: string): void {
  if (normalize(window.location.pathname) === normalize(path)) return;
  window.history.pushState(null, '', urlFor(path));
}

export function replacePath(path: string): void {
  window.history.replaceState(null, '', urlFor(path));
}
