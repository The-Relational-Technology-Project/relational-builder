import { builderClient } from '@/cloud/builder-client';
import { PREVIEW_DAYS } from '@/project/share-preview';
import type { ShowcaseEntry } from '@/cloud/event-showcase';

/**
 * Joining an event from an existing account.
 *
 * The room key is a ?ref=CODE link. A newcomer spends it at the door (the
 * request form → request-account → the profile trigger). A builder who
 * already has an account used to land in the app with the code stashed and
 * nothing to spend it on. Now the landing keeps the code here as well —
 * localStorage, because the magic-link round trip can come back in another
 * tab — and the first signed-in load hands it to join_event(), which stamps
 * the profile and seats them in the code's studio. One shot, then cleared,
 * whatever the answer.
 */

const PENDING_KEY = 'rb-pending-event';

export interface JoinedEvent {
  code: string;
  name: string;
  studio_slug: string | null;
  studio_label: string | null;
}

export function stashPendingEvent(code: string): void {
  try {
    localStorage.setItem(PENDING_KEY, code.trim().toUpperCase());
  } catch {
    // Storage blocked — the code just doesn't survive the sign-in round trip
  }
}

/** Read and clear the stashed code — a key is spent once */
export function takePendingEvent(): string | null {
  try {
    const code = localStorage.getItem(PENDING_KEY);
    if (code !== null) localStorage.removeItem(PENDING_KEY);
    return code?.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Hand a code to the server. Null means it wasn't a live event code — a
 * personal referral code, a switched-off or lapsed event — which is not an
 * error, just nothing to join.
 */
export async function joinEvent(code: string): Promise<JoinedEvent | null> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { data, error } = await builderClient.rpc('join_event', { p_code: code });
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.code) return null;
  return {
    code: String(row.code),
    name: String(row.name),
    studio_slug: row.studio_slug ? String(row.studio_slug) : null,
    studio_label: row.studio_label ? String(row.studio_label) : null,
  };
}

// --- The event's presentation: every pinned deck, in publish order ---

/** The page a steward projects: /show/CODE, public like /buildtogether */
export const SHOW_PATH_PREFIX = '/show/';

export function eventShowLink(code: string): string {
  const base =
    (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
    window.location.origin;
  return `${base}${SHOW_PATH_PREFIX}${encodeURIComponent(code.toUpperCase())}`;
}

/** The code in a /show/CODE address, or null when this isn't that page */
export function readShowCode(pathname: string = window.location.pathname): string | null {
  const p = pathname.replace(/\/+$/, '');
  if (!p.toLowerCase().startsWith(SHOW_PATH_PREFIX)) return null;
  const code = decodeURIComponent(p.slice(SHOW_PATH_PREFIX.length)).trim();
  return /^[A-Za-z0-9]{3,12}$/.test(code) ? code.toUpperCase() : null;
}

export interface EventShow {
  code: string;
  /** Null when no event carries this code */
  name: string | null;
  /** Oldest first — the order they were shared with the room */
  entries: ShowcaseEntry[];
}

export async function fetchEventShow(code: string): Promise<EventShow> {
  if (!builderClient) return { code, name: null, entries: [] };
  const [nameRes, rowsRes] = await Promise.all([
    builderClient.rpc('event_name_for', { p_code: code }),
    builderClient.rpc('event_showcase_for', { p_code: code }),
  ]);
  const name = !nameRes.error && nameRes.data ? String(nameRes.data) : null;
  const entries = (rowsRes.error ? [] : ((rowsRes.data as ShowcaseEntry[]) ?? [])).map(lapseLinks);
  return { code, name, entries };
}

/** A Builder preview link (/s/p-…): the kind that expires after PREVIEW_DAYS */
const PREVIEW_LINK = /\/s\/p-[0-9a-f]+\/?/;

/**
 * Decks and demos are preview links that expire after PREVIEW_DAYS. The build
 * stays on the wall past that (picture, name, line, builder: a record of what
 * the room made); only the links that would point at nothing come off.
 * A link outside the preview host (a builder's own site) is kept.
 */
function lapseLinks(entry: ShowcaseEntry): ShowcaseEntry {
  const since = Date.now() - PREVIEW_DAYS * 86400_000;
  if (new Date(entry.created_at).getTime() >= since) return entry;
  const deck_url = entry.deck_url && PREVIEW_LINK.test(entry.deck_url) ? null : entry.deck_url;
  const demo_url = entry.demo_url && PREVIEW_LINK.test(entry.demo_url) ? null : entry.demo_url;
  if (deck_url === entry.deck_url && demo_url === entry.demo_url) return entry;
  return { ...entry, deck_url, demo_url, lapsed: true };
}
