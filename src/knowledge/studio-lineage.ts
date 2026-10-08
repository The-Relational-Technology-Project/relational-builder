import type { StudioLibraryItem } from '@/cloud/studio-library';

/**
 * The remix chain of a studio shelf item, oldest ancestor last, read off
 * `remix_of` pointers within the library the viewer can see. A link that
 * points at an item the viewer cannot see (or that was deleted) ends the
 * chain quietly.
 */
export function studioLineageChain(
  item: StudioLibraryItem,
  library: StudioLibraryItem[],
): StudioLibraryItem[] {
  const chain: StudioLibraryItem[] = [item];
  const seen = new Set<string>([item.id]);
  let cursor: StudioLibraryItem | undefined = item;
  while (cursor?.remix_of && !seen.has(cursor.remix_of)) {
    const parent = library.find(x => x.id === cursor!.remix_of);
    if (!parent) break;
    seen.add(parent.id);
    chain.push(parent);
    cursor = parent;
  }
  return chain;
}

/**
 * One line a person can read: "Mission Neighbors Deliberation, remix of
 * Sunset Schools Deliberation, from the Neighborhood deliberation kit".
 * Null when the item has no visible ancestor.
 */
export function formatLineageChain(chain: StudioLibraryItem[]): string | null {
  if (chain.length < 2) return null;
  const parts = [chain[0].title];
  for (let i = 1; i < chain.length; i++) {
    const last = i === chain.length - 1;
    parts.push(last ? `from the ${chain[i].title}` : `remix of ${chain[i].title}`);
  }
  return parts.join(', ');
}
