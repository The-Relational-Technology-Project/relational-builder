import { builderClient } from '@/cloud/builder-client';

/**
 * Civic data endpoints — live open-data MCP servers, one per city, provided
 * by partner networks (currently the Responsive Cities Network). The
 * endpoint list lives in the Builder backend's `city_data_endpoints` table,
 * deliberately not in this repo: code here is generic, rows are provisioned
 * by stewards.
 *
 * What they power:
 *  (a) build context — when a builder is in/near a covered city, or is
 *      building for one, the matching endpoints ride into the system prompt
 *      so plans and chat can lean on real civic data;
 *  (b) live apps — the prompt teaches the model how to wire a generated
 *      app to the city's endpoint directly (plain JSON-RPC over HTTP), so
 *      civic data sources work in the tools people ship, not just in chat.
 */

export interface CityDataEndpoint {
  slug: string;
  city: string;
  kind: string;
  mcp_url: string;
}

let cache: CityDataEndpoint[] | null = null;
let cacheAt = 0;
const CACHE_MS = 10 * 60_000;

export async function loadCityEndpoints(): Promise<CityDataEndpoint[]> {
  if (!builderClient) return [];
  if (cache && Date.now() - cacheAt < CACHE_MS) return cache;
  const { data, error } = await builderClient
    .from('city_data_endpoints')
    .select('slug, city, kind, mcp_url')
    .eq('active', true);
  if (error || !data) return cache ?? [];
  cache = data as CityDataEndpoint[];
  cacheAt = Date.now();
  return cache;
}

/**
 * Lowercase and strip diacritics, so the city's own styling still matches:
 * people write "San José" (as the city does) far more often than "San Jose".
 */
function fold(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/** Folded name variants a city can be recognized by in free text */
function aliases(e: CityDataEndpoint): string[] {
  const out = new Set<string>();
  // "St. Paul, MN" → "st. paul"; "Philadelphia, PA (OpenDataPhilly)" → "philadelphia"
  const base = fold(e.city.split(',')[0].replace(/\(.*\)/, '').trim());
  if (base) out.add(base);
  if (base.startsWith('st. ')) {
    out.add(base.replace('st. ', 'st '));
    out.add(base.replace('st. ', 'saint '));
  }
  // slug words: "west-palm-beach-fl" → "west palm beach fl" adds nothing new,
  // but short slugs like "philly" are their own name
  const slugName = e.slug.replace(/-[a-z]{2}$/, '').replace(/-/g, ' ').trim();
  if (slugName.length > 3) out.add(slugName);
  return [...out];
}

/**
 * Which cities does this build seem to touch? Matches city names against
 * the combined signal text (message, project, profile place). Word-ish
 * boundaries keep "columbia" from matching "columbian coffee" poorly — a
 * false positive costs one harmless prompt section, so matching stays
 * simple on purpose.
 */
export function matchCityEndpoints(
  signalText: string,
  endpoints: CityDataEndpoint[],
): CityDataEndpoint[] {
  const text = ` ${fold(signalText).replace(/\s+/g, ' ')} `;
  return endpoints.filter(e =>
    aliases(e).some(a => new RegExp(`[^a-z]${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[^a-z]`).test(text)),
  );
}

/** Load + match in one call; never throws (context enriches, never breaks). */
export async function retrieveCivicDataContext(signals: (string | null | undefined)[]): Promise<CityDataEndpoint[]> {
  try {
    const endpoints = await loadCityEndpoints();
    if (endpoints.length === 0) return [];
    return matchCityEndpoints(signals.filter(Boolean).join('\n'), endpoints);
  } catch {
    return [];
  }
}

/** The system-prompt section for matched endpoints */
export function formatCivicDataForPrompt(matches: CityDataEndpoint[]): string {
  const list = matches
    .map(e => `- **${e.city}** — MCP endpoint: \`${e.mcp_url}\` (${e.kind}-backed open data)`)
    .join('\n');
  return [
    '## Live Civic Data Available',
    '',
    'This build appears to touch a city whose open data is reachable through a live MCP endpoint (provided by the Responsive Cities Network):',
    '',
    list,
    '',
    'How to use this:',
    '- **In plans and conversation:** treat the city\'s open data as a first-class ingredient. Name the real datasets a build could stand on (service requests, permits, capital projects, facilities…) and prefer "read it live from the city endpoint" over pasted snapshots or invented sample data.',
    '- **In live builds:** these endpoints speak MCP over plain HTTP JSON-RPC, so a generated app can call them directly with `fetch` — no SDK, no key, and they send permissive CORS headers, so a browser app can call them straight from the page. Discover what a city offers with `tools/list` (tool names differ by portal — `arcgis__*`, `ckan__*`, and others), then read data with `tools/call`:',
    '',
    '```ts',
    "// list available data tools",
    "const rpc = (method: string, params?: unknown) =>",
    "  fetch(MCP_URL, {",
    "    method: 'POST',",
    "    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },",
    "    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),",
    "  }).then(r => r.json());",
    "const tools = await rpc('tools/list');",
    "const result = await rpc('tools/call', { name: '<tool>', arguments: { /* … */ } });",
    '```',
    '',
    'What comes back, and the traps in it (each of these has bitten a real build):',
    '- **The payload is prose, not JSON.** A `tools/call` reply carries `result.content[0].text` — a human-readable listing (`Record 1:` followed by `FIELD: value` lines). There is no `structuredContent`. An app has to parse that text into objects itself, so write the parser defensively and keep working if a field is missing or the shape shifts.',
    '- **Rows come back oldest-first and capped** (roughly 1000; these tools take no sort parameter). A returned slice is therefore *not* the newest data. Never compute "last updated", "recent requests", or any freshness label from whatever a query happened to return — it will read as current and be silently, confidently wrong. Get recency from a date-filtered `where` instead (e.g. `DATE_FIELD > timestamp \'2026-01-01 00:00:00\'`), narrowing until you find the real edge of the data.',
    '- **Check the data\'s true age before you promise anything about it.** Some city datasets lag by a year or more even though the endpoint answers instantly — a live endpoint is not the same as live data. Probe for the newest record first, then state the period plainly in the UI ("service requests through June 2025"), never a bare "live".',
    '- **Aggregation tools aggregate the catalog, not the records.** `get_aggregations` counts *datasets* by tag or type; it will not count service requests by ward. Record-level rollups mean pulling rows within the cap and counting client-side — and saying so when the count covers only part of the data.',
    '- **A city may expose more than one endpoint** (different portals behind the same name). Run `tools/list` on each and use whichever actually carries the dataset the build needs, rather than assuming the first one listed.',
    '',
    'Ground rules when civic data is in play:',
    '- Show data honestly: name the source and its freshness in the UI, and design a graceful state for when the endpoint is unreachable — a civic tool that silently shows stale data breaks trust.',
    '- Use data about conditions and services, never to identify, score, or track individual people.',
    '- Efficiency for current users of a service can widen gaps: when the data shows who asks, also ask who is missing from it.',
    '- Keep a human path visible alongside anything data-driven: a name, a desk, a number, a door.',
  ].join('\n');
}
