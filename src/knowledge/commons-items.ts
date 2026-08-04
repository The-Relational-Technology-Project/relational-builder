import { COMMONS_URL, COMMONS_ANON_KEY } from './commons-search';

/**
 * Direct reads of commons_items for the Commons Gallery — the remixable
 * practices and recipes that live in the RT Commons (the RTP site's
 * database) rather than the Studio KB's tools table.
 *
 * Card lists skip body/metadata to stay light; the full entry is fetched
 * on demand when someone opens a card or starts a plan from it.
 */

export interface CommonsAttribution {
  name?: string;
  neighborhood?: string;
  source?: string;
  source_repo?: string;
}

export interface CommonsCard {
  id: string;
  slug: string;
  kind: string;
  title: string;
  summary: string | null;
  attribution: CommonsAttribution | null;
  source_studio_slug: string | null;
  source_url: string | null;
  license: string | null;
  tags: string[] | null;
}

export interface CommonsItemDetail extends CommonsCard {
  body: string | null;
  metadata: Record<string, unknown> | null;
}

const CARD_COLUMNS = 'id,slug,kind,title,summary,attribution,source_studio_slug,source_url,license,tags';

async function rest<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${COMMONS_URL}/rest/v1/${path}`, {
    headers: { apikey: COMMONS_ANON_KEY, Authorization: `Bearer ${COMMONS_ANON_KEY}` },
    signal,
  });
  if (!res.ok) throw new Error(`Commons read failed (${res.status})`);
  return res.json() as Promise<T>;
}

/**
 * Civic Media: the whole Cookbook shelf — the ten recipes, the three starter
 * worksheets, the build prompts, and the 50 field-guide stories (real
 * projects, credited to their practitioners, there to remix for your
 * place). Cookable items lead; the field examples follow as references.
 * Patterns and formats stay retrieval-only.
 */
const CIVIC_SHELF_ORDER: Record<string, number> = { recipe: 0, framework: 1, prompt: 2, story: 3 };

export async function fetchCivicMediaCards(): Promise<CommonsCard[]> {
  const rows = await rest<CommonsCard[]>(
    `commons_items?select=${CARD_COLUMNS}` +
      `&source_studio_slug=eq.civic-media&status=eq.canonical` +
      `&kind=in.(recipe,framework,prompt,story)&order=title.asc`,
  );
  // frameworks include patterns; only the worksheets are gallery cards
  return rows
    .filter(r => r.kind !== 'framework' || (r.tags ?? []).includes('worksheet'))
    .sort((a, b) => (CIVIC_SHELF_ORDER[a.kind] ?? 9) - (CIVIC_SHELF_ORDER[b.kind] ?? 9));
}

/** Neighboring Recipes: the canonical neighboring practices shelf. */
export async function fetchNeighboringRecipeCards(): Promise<CommonsCard[]> {
  return rest<CommonsCard[]>(
    `commons_items?select=${CARD_COLUMNS}` +
      `&source_studio_slug=eq.rtp-canonical&status=eq.canonical` +
      `&kind=eq.recipe&order=title.asc`,
  );
}

/** Full entry (body + structured metadata) for a card's detail view / remix. */
export async function fetchCommonsItemDetail(
  slug: string,
  signal?: AbortSignal,
): Promise<CommonsItemDetail | null> {
  const rows = await rest<CommonsItemDetail[]>(
    `commons_items?select=${CARD_COLUMNS},body,metadata&slug=eq.${encodeURIComponent(slug)}&limit=1`,
    signal,
  );
  return rows[0] ?? null;
}
