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

async function rest<T>(path: string): Promise<T> {
  const res = await fetch(`${COMMONS_URL}/rest/v1/${path}`, {
    headers: { apikey: COMMONS_ANON_KEY, Authorization: `Bearer ${COMMONS_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`Commons read failed (${res.status})`);
  return res.json() as Promise<T>;
}

/**
 * Civic Media Recipes: the actionable civic-media shelf — the Cookbook's ten
 * recipes, the three starter worksheets, and the build prompts. Patterns,
 * formats, and the 50 field-guide examples stay retrieval-only so the
 * gallery reads as a set of things you can pick up and cook.
 */
export async function fetchCivicMediaCards(): Promise<CommonsCard[]> {
  const rows = await rest<CommonsCard[]>(
    `commons_items?select=${CARD_COLUMNS}` +
      `&source_studio_slug=eq.civic-media&status=eq.canonical` +
      `&kind=in.(recipe,framework,prompt)&order=kind.desc,title.asc`,
  );
  // frameworks include patterns; only the worksheets are gallery cards
  return rows.filter(r => r.kind !== 'framework' || (r.tags ?? []).includes('worksheet'));
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
export async function fetchCommonsItemDetail(slug: string): Promise<CommonsItemDetail | null> {
  const rows = await rest<CommonsItemDetail[]>(
    `commons_items?select=${CARD_COLUMNS},body,metadata&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  return rows[0] ?? null;
}
