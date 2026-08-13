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

/** Lowercased name variants a city can be recognized by in free text */
function aliases(e: CityDataEndpoint): string[] {
  const out = new Set<string>();
  // "St. Paul, MN" → "st. paul"; "Philadelphia, PA (OpenDataPhilly)" → "philadelphia"
  const base = e.city.split(',')[0].replace(/\(.*\)/, '').trim().toLowerCase();
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
  const text = ` ${signalText.toLowerCase().replace(/\s+/g, ' ')} `;
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
    '- **In live builds:** these endpoints speak MCP over plain HTTP JSON-RPC, so a generated app can call them directly with `fetch` — no SDK needed. Discover what a city offers with `tools/list`, then read data with `tools/call`:',
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
    'Ground rules when civic data is in play:',
    '- Show data honestly: name the source and its freshness in the UI, and design a graceful state for when the endpoint is unreachable — a civic tool that silently shows stale data breaks trust.',
    '- Use data about conditions and services, never to identify, score, or track individual people.',
    '- Efficiency for current users of a service can widen gaps: when the data shows who asks, also ask who is missing from it.',
    '- Keep a human path visible alongside anything data-driven: a name, a desk, a number, a door.',
  ].join('\n');
}
