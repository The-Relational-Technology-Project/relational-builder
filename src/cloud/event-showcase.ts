import { builderClient } from '@/cloud/builder-client';

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
  deck_url: string;
  demo_url: string | null;
  /** One way to reach the builder, only if they offered it in Share Live —
   *  the label is theirs ("Email", "Phone", "Website", or their own word) */
  contact_label: string | null;
  contact_value: string | null;
  created_at: string;
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
