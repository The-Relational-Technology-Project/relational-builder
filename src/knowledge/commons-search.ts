/**
 * Hybrid retrieval against the RT Commons — the canonical, growing knowledge
 * base behind the whole ecosystem (tools, stories, prompts, recipes, the
 * Neighboring Commons reference library, frameworks, and RTP methodology).
 *
 * Calls the commons `search-commons` edge function, which combines semantic
 * (embedding) search with Postgres full-text search over commons_items.
 * The Builder falls back to its local TF-IDF scoring when this is
 * unreachable, so retrieval never blocks building.
 */

export const COMMONS_URL =
  import.meta.env.VITE_COMMONS_SUPABASE_URL ?? 'https://odowkowcinyoxejyzhwl.supabase.co';

export const COMMONS_ANON_KEY =
  import.meta.env.VITE_COMMONS_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc';

export interface CommonsSearchResult {
  id: string;
  slug: string;
  kind: string; // tool | story | prompt | recipe | reference | framework | methodology | program
  title: string;
  summary: string | null;
  attribution: { name?: string; neighborhood?: string } | null;
  /** Which studio's shelf this entry sits on (e.g. 'civic-media', 'rtp-canonical') */
  source_studio_slug?: string | null;
  tags: string[] | null;
  similarity?: number;
  match: 'semantic' | 'text' | 'both';
  /** Full-body excerpt attached client-side for the strongest hits
   *  (see knowledge/retrieval.ts) — never returned by the edge function */
  body_excerpt?: string;
}

const SEARCH_TIMEOUT_MS = 3500;

/**
 * Search the commons. Returns [] on any failure or timeout — callers fall
 * back to local scoring.
 */
export async function searchCommons(
  query: string,
  matchCount = 8,
  kinds: string[] | null = null,
): Promise<CommonsSearchResult[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const res = await fetch(`${COMMONS_URL}/functions/v1/search-commons`, {
      method: 'POST',
      headers: {
        apikey: COMMONS_ANON_KEY,
        Authorization: `Bearer ${COMMONS_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, match_count: matchCount, kinds }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.results) ? (data.results as CommonsSearchResult[]) : [];
  } catch {
    return [];
  }
}
