/**
 * Map with bounded concurrency — forge APIs start rejecting bursts well
 * before a large diff's worth of parallel fetches completes, and every
 * rejected fetch used to look like "file skipped".
 *
 * Rejects on the first error; callers that apply results only after all
 * items resolve stay all-or-nothing.
 */
export async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

/** How many file fetches we run against a forge at once */
export const FORGE_FETCH_CONCURRENCY = 6;
