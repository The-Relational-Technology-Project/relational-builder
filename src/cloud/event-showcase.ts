import { builderClient } from '@/cloud/builder-client';
import { parseLocation, type GeoLocation } from '@/knowledge/geo';

/**
 * The event demo wall — showcase entries pinned by event participants
 * when they make a Share Live deck. Reads and writes go through RLS: a
 * participant sees their own event's wall and pins only to it, only as
 * themselves. Reading one event by code (the gallery shelf, the /show/CODE
 * presentation) lives in event-join.ts. The event CODE column is write-only for clients (a live
 * code is a key), so every select names its columns explicitly.
 */

export interface ShowcaseEntry {
  id: string;
  event_name: string;
  owner_id: string;
  /** The cloud project this deck came from — the team's key on the wall.
   *  Null for decks made from a device-local project. */
  project_id: string | null;
  builder_name: string | null;
  project_name: string;
  one_liner: string | null;
  screenshot_url: string | null;
  /** The Share Live deck. Null for a build pinned from outside the Builder
   *  (the RT MCP server or the build day inbox): no deck, just the card. */
  deck_url: string | null;
  demo_url: string | null;
  /** One way to reach the builder, only if they offered it in Share Live —
   *  the label is theirs ("Email", "Phone", "Website", or their own word) */
  contact_label: string | null;
  contact_value: string | null;
  /** Which door the entry came through: Share Live in the Builder, an AI
   *  tool through the RT MCP server, the build day inbox, or the host
   *  typing it in on the Event Admin page */
  submitted_via: 'builder' | 'mcp' | 'email' | 'host';
  created_at: string;
  /** Set client-side once the deck and demo links have expired and been
   *  dropped (see fetchEventShow): the card stays, without its links */
  lapsed?: boolean;
}

/** True when a card came from a builder working in their own tools —
 *  there is no deck to present, and the wall says so instead of pretending */
export function isOutsideBuild(entry: Pick<ShowcaseEntry, 'submitted_via' | 'deck_url' | 'lapsed'>): boolean {
  // submitted_via is absent until the open-door migration runs; a missing
  // value means the Builder's own door
  // (a lapsed Builder deck is still the Builder's own build)
  return (entry.submitted_via ?? 'builder') !== 'builder' || (!entry.deck_url && !entry.lapsed);
}

/** The gallery's scope value for one event's shelf — a token no studio
 *  slug can collide with (slugs are [a-z0-9-]; codes are uppercase) */
const EVENT_SCOPE_PREFIX = 'event:';
export function eventScopeFor(code: string): string {
  return `${EVENT_SCOPE_PREFIX}${code.toUpperCase()}`;
}
/** The event code in a gallery scope, or null when it's a studio/commons */
export function eventCodeOfScope(scope: string): string | null {
  return scope.startsWith(EVENT_SCOPE_PREFIX) ? scope.slice(EVENT_SCOPE_PREFIX.length) : null;
}

/** A shelf the gallery offers: the event the viewer joined through a room
 *  key, or one they administer (the host sees the wall without joining) */
export interface EventShelfInfo {
  code: string;
  name: string;
  admin: boolean;
  /** The studio this event belongs to, if any — decides which gallery its
   *  freshly shared builds surface on */
  studioSlug: string | null;
  /** Where the event was — every build on its wall is Nearby there */
  location: GeoLocation | null;
  /** The day, when the steward recorded one */
  eventDate: string | null;
  /** A finished event: its gallery stays, its door is closed */
  archived: boolean;
}

/** An event the signed-in builder has been part of — any of them, ever */
export interface MyEvent {
  code: string;
  name: string;
  studioSlug: string | null;
  location: GeoLocation | null;
  eventDate: string | null;
  archived: boolean;
  /** The one their profile carries right now (the wall they can pin to) */
  current: boolean;
}

/**
 * Every event this builder has joined, newest first. A room's gallery
 * outlives the room: the shelf is theirs after the event, after they join
 * the next one, after the steward archives the code.
 */
export async function fetchMyEvents(): Promise<MyEvent[]> {
  if (!builderClient) return [];
  const { data, error } = await builderClient.rpc('my_events');
  if (error) return [];
  return ((data as Array<Record<string, unknown>>) ?? []).map(r => ({
    code: String(r.code),
    name: String(r.name),
    studioSlug: r.studio_slug ? String(r.studio_slug) : null,
    location: parseLocation(r.location),
    eventDate: r.event_date ? String(r.event_date) : null,
    archived: !!r.archived_at,
    current: r.current === true,
  }));
}

/** The event's place, for a shelf opened by code */
export async function fetchEventLocation(code: string): Promise<GeoLocation | null> {
  if (!builderClient) return null;
  const { data, error } = await builderClient.rpc('event_location_for', { p_code: code });
  return error ? null : parseLocation(data);
}

/** The signed-in builder's event, if they joined through an event code */
export async function fetchMyEvent(): Promise<
  { code: string; name: string; studioSlug: string | null } | null
> {
  if (!builderClient) return null;
  const { data, error } = await builderClient.rpc('my_event');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.code
    ? {
        code: String(row.code),
        name: String(row.name),
        studioSlug: row.studio_slug ? String(row.studio_slug) : null,
      }
    : null;
}

/** Pin (or re-pin) a project to its event's wall — replaces any prior
 *  entry for the same project, whichever teammate pinned it */
export async function pinToShowcase(entry: {
  eventCode: string;
  eventName: string;
  ownerId: string;
  projectId: string | null;
  builderName: string | null;
  projectName: string;
  oneLiner: string | null;
  screenshotUrl: string | null;
  deckUrl: string;
  demoUrl: string | null;
  contact: { label: string; value: string } | null;
}): Promise<void> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  // Replace-not-upsert: an upsert would need UPDATE grants on the key
  // columns; delete-then-insert stays inside the simple policy set
  // A saved project is the team's: its card is replaced whoever pinned it
  // last (RLS lets any member delete it). A local-only project keeps the
  // old per-person key.
  const prior = builderClient.from('event_showcase').delete();
  await (entry.projectId
    ? prior.eq('project_id', entry.projectId)
    : prior.eq('owner_id', entry.ownerId).eq('project_name', entry.projectName));
  const { error } = await builderClient.from('event_showcase').insert({
    event_code: entry.eventCode,
    event_name: entry.eventName,
    owner_id: entry.ownerId,
    project_id: entry.projectId,
    builder_name: entry.builderName,
    project_name: entry.projectName,
    one_liner: entry.oneLiner,
    screenshot_url: entry.screenshotUrl,
    deck_url: entry.deckUrl,
    demo_url: entry.demoUrl,
    contact_label: entry.contact?.label ?? null,
    contact_value: entry.contact?.value ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Take an entry off the wall — your own, or your team's */
export async function removeFromShowcase(id: string): Promise<void> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { error } = await builderClient.from('event_showcase').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * The host's door: a build made outside the Builder (someone's own AI
 * tool, a notebook, a paper prototype) typed in by an event admin from the
 * Event Admin page. Goes through the commons-bridge function like the MCP
 * server's share does — the room key is the credential, the card has no
 * deck, and the wall says "built with their own tools".
 */
export async function addOutsideBuild(input: {
  eventCode: string;
  projectName: string;
  builderName: string | null;
  oneLiner: string | null;
  demoUrl: string | null;
  /** Already shrunk (shrinkScreenshot) — the bridge caps uploads at 4MB */
  screenshotDataUrl: string | null;
  contact: { label: string; value: string } | null;
  /** The builder's email, so re-adding the same project replaces the card */
  email: string | null;
}): Promise<void> {
  const base = import.meta.env.VITE_BUILDER_SUPABASE_URL ?? '';
  if (!base) throw new Error('Cloud backend not configured');
  const res = await fetch(`${base}/functions/v1/commons-bridge`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'share',
      via: 'host',
      event_code: input.eventCode,
      project_name: input.projectName,
      builder_name: input.builderName,
      one_liner: input.oneLiner,
      demo_url: input.demoUrl,
      screenshot: input.screenshotDataUrl,
      contact_label: input.contact?.label ?? null,
      contact_value: input.contact?.value ?? null,
      email: input.email,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Could not add that build to the wall');
}
