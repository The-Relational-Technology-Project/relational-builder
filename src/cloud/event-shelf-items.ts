import { builderClient } from '@/cloud/builder-client';

/**
 * An event's inspiration shelf — curated cards a steward puts on an event's
 * gallery beneath the demo wall: the real neighborhood tools behind the
 * generic commons cards, as they actually run (screenshot, what it is, how
 * it works, the live site, the repo when there is one).
 *
 * Read by event code the way the demo wall is: public, because a live code
 * is already the key to the room. The presentation page (/show/CODE) never
 * touches these; it walks the decks only.
 */

export interface EventShelfItem {
  id: string;
  title: string;
  summary: string | null;
  /** Markdown */
  body: string | null;
  image_url: string | null;
  site_url: string | null;
  repo_url: string | null;
  attribution: string | null;
  tags: string[];
  sort_order: number;
}

export async function fetchEventShelfItems(code: string): Promise<EventShelfItem[]> {
  if (!builderClient) return [];
  const { data, error } = await builderClient.rpc('event_shelf_items_for', { p_code: code });
  if (error) return [];
  return ((data as EventShelfItem[] | null) ?? []).map(i => ({ ...i, tags: i.tags ?? [] }));
}
