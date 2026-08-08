import { builderClient } from '@/cloud/builder-client';
import { PREVIEW_DAYS } from '@/project/share-preview';

/**
 * The event demo wall — public showcase entries pinned by event
 * participants when they make a Share Live deck. Reads are anonymous;
 * writes go through RLS (a participant pins only to their own event, only
 * as themselves). The event CODE column is write-only for clients (a live
 * code is a key), so every select names its columns explicitly.
 */

export interface ShowcaseEntry {
  id: string;
  event_name: string;
  owner_id: string;
  builder_name: string | null;
  project_name: string;
  one_liner: string | null;
  screenshot_url: string | null;
  deck_url: string;
  demo_url: string | null;
  created_at: string;
}

const COLUMNS =
  'id, event_name, owner_id, builder_name, project_name, one_liner, screenshot_url, deck_url, demo_url, created_at';

/** The signed-in builder's event, if they joined through an event code */
export async function fetchMyEvent(): Promise<{ code: string; name: string } | null> {
  if (!builderClient) return null;
  const { data, error } = await builderClient.rpc('my_event');
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row?.code ? { code: String(row.code), name: String(row.name) } : null;
}

/**
 * Wall entries whose deck links are still alive — Share Live decks are
 * preview links, so the wall naturally fades PREVIEW_DAYS after an event.
 */
export async function fetchShowcase(): Promise<ShowcaseEntry[]> {
  if (!builderClient) return [];
  const since = new Date(Date.now() - PREVIEW_DAYS * 86400_000).toISOString();
  const { data, error } = await builderClient
    .from('event_showcase')
    .select(COLUMNS)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return [];
  return (data as ShowcaseEntry[]) ?? [];
}

/** Pin (or re-pin) a project to its event's wall — replaces any prior entry */
export async function pinToShowcase(entry: {
  eventCode: string;
  eventName: string;
  ownerId: string;
  builderName: string | null;
  projectName: string;
  oneLiner: string | null;
  screenshotUrl: string | null;
  deckUrl: string;
  demoUrl: string | null;
}): Promise<void> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  // Replace-not-upsert: an upsert would need UPDATE grants on the key
  // columns; delete-then-insert stays inside the simple policy set
  await builderClient
    .from('event_showcase')
    .delete()
    .eq('owner_id', entry.ownerId)
    .eq('project_name', entry.projectName);
  const { error } = await builderClient.from('event_showcase').insert({
    event_code: entry.eventCode,
    event_name: entry.eventName,
    owner_id: entry.ownerId,
    builder_name: entry.builderName,
    project_name: entry.projectName,
    one_liner: entry.oneLiner,
    screenshot_url: entry.screenshotUrl,
    deck_url: entry.deckUrl,
    demo_url: entry.demoUrl,
  });
  if (error) throw new Error(error.message);
}

/** Take an entry off the wall — only works on your own */
export async function removeFromShowcase(id: string): Promise<void> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { error } = await builderClient.from('event_showcase').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
