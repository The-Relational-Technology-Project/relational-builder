/**
 * Pictures the preview asked for and did not get, as the shell's
 * RESOURCE_RELAY reports them: one entry per host, with a running count and
 * the HTTP status where the relay could read one (0 when it could not).
 */
export interface ResourceFailure {
  host: string;
  count: number;
  status: number;
}

/** The message comes from the previewed app's own window, so trust nothing in it */
export function parseResourceFailures(raw: unknown): ResourceFailure[] {
  if (!Array.isArray(raw)) return [];
  const byHost = new Map<string, ResourceFailure>();
  for (const item of raw.slice(0, 24)) {
    if (!item || typeof item !== 'object') continue;
    const { host, count, status } = item as Record<string, unknown>;
    if (typeof host !== 'string' || !/^[a-z0-9.-]{1,120}$/i.test(host)) continue;
    if (typeof count !== 'number' || !(count > 0)) continue;
    // A map spreads its tiles over a., b., c. of one service: one host to a person
    const name = host.toLowerCase().replace(/^[a-d]\.(?=[^.]+\.[^.]+)/, '');
    const seen = byHost.get(name) ?? { host: name, count: 0, status: 0 };
    seen.count += Math.floor(count);
    if (typeof status === 'number' && status > 0) seen.status = Math.floor(status);
    byHost.set(name, seen);
  }
  return [...byHost.values()].slice(0, 6);
}

/** "tile.openstreetmap.org: 12 refused (403), example.org: 1 failed" */
export function describeResourceFailures(failures: ResourceFailure[]): string {
  return failures
    .map(f => {
      const refused = f.status === 401 || f.status === 403 || f.status === 429;
      const what = refused ? 'refused' : f.status === 404 ? 'missing' : 'failed';
      return `${f.host}: ${f.count} ${what}${f.status ? ` (${f.status})` : ''}`;
    })
    .join(', ');
}
