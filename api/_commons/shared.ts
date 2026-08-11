/**
 * Data layer for the public commons pages (/commons/...).
 *
 * Everything here reads the same public shelves the app reads — the RT
 * Commons project for entries, the Builder backend for steward-confirmed
 * gallery connections — with the same anon keys the SPA ships with. The
 * pages are server-rendered so search engines and AI crawlers (which
 * largely don't run JS) get real HTML in the first response.
 */

export const SITE = 'https://relationalbuilder.org';

// Vercel's edge runtime exposes env through `process.env`; typed here so the
// api/ tree doesn't need Node types.
declare const process: { env: Record<string, string | undefined> };

const COMMONS_URL =
  process.env.VITE_COMMONS_SUPABASE_URL ?? 'https://odowkowcinyoxejyzhwl.supabase.co';
const COMMONS_ANON =
  process.env.VITE_COMMONS_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc';

const BUILDER_URL =
  process.env.VITE_BUILDER_SUPABASE_URL ?? 'https://texakzqqenzpxawktbgx.supabase.co';
const BUILDER_ANON =
  process.env.VITE_BUILDER_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleGFrenFxZW56cHhhd2t0Ymd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDczMDQsImV4cCI6MjA5ODUyMzMwNH0.NnNhDvYMPsDfC5T4QkExUtSrflG5VP76gkFY-KxiV8M';

/** Studio gallery images are stored site-relative; qualify so they resolve here. */
const STUDIO_SITE_ORIGIN = 'https://studio.relationaltechproject.org';
export const qualifyAsset = (u: string | null | undefined): string | null =>
  u ? (u.startsWith('/') ? `${STUDIO_SITE_ORIGIN}${u}` : u) : null;

// --- Types -----------------------------------------------------------------

export interface Attribution {
  name?: string;
  neighborhood?: string;
  source?: string;
  source_repo?: string;
}

export interface Entry {
  id: string;
  slug: string;
  kind: string;
  title: string;
  summary: string | null;
  body?: string | null;
  attribution: Attribution | null;
  source_studio_slug: string | null;
  source_url: string | null;
  tags: string[] | null;
  image_urls?: string[] | null;
  parent_slug?: string | null;
  metadata?: Record<string, unknown> | null;
  license: string | null;
  created_at: string;
  updated_at?: string;
  published_at?: string | null;
}

export interface GalleryRef {
  from_source: string;
  from_id: string;
  from_title: string;
  from_kind: string | null;
  to_source: string;
  to_id: string;
  to_title: string;
  to_kind: string | null;
  relation: string;
}

// --- Fetch -----------------------------------------------------------------

async function rest<T>(base: string, key: string, path: string): Promise<T> {
  const res = await fetch(`${base}/rest/v1/${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

const SLIM_COLUMNS =
  'id,slug,kind,title,summary,attribution,source_studio_slug,source_url,tags,parent_slug,license,created_at,updated_at,published_at';
const FULL_COLUMNS = `${SLIM_COLUMNS},body,image_urls,metadata`;

/** Every canonical entry, without bodies — the map, indexes and sitemap. */
export function fetchAllSlim(): Promise<Entry[]> {
  return rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${SLIM_COLUMNS}&status=eq.canonical&order=title.asc&limit=2000`,
  );
}

export async function fetchEntry(kind: string, slug: string): Promise<Entry | null> {
  const rows = await rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${FULL_COLUMNS}&status=eq.canonical` +
      `&kind=eq.${encodeURIComponent(kind)}&slug=eq.${encodeURIComponent(slug)}&limit=1`,
  );
  return rows[0] ?? null;
}

export function fetchBySlugs(slugs: string[]): Promise<Entry[]> {
  if (!slugs.length) return Promise.resolve([]);
  const list = slugs.map(encodeURIComponent).join(',');
  return rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${FULL_COLUMNS}&status=eq.canonical&slug=in.(${list})`,
  );
}

export function fetchKind(kind: string): Promise<Entry[]> {
  return rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${FULL_COLUMNS}&status=eq.canonical&kind=eq.${kind}&order=title.asc&limit=1000`,
  );
}

/** Entries whose slug matches (both kinds of a colliding slug come back). */
export function fetchSlug(slug: string): Promise<Entry[]> {
  return rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${SLIM_COLUMNS}&status=eq.canonical&slug=eq.${encodeURIComponent(slug)}`,
  );
}

export function fetchChildren(slug: string): Promise<Entry[]> {
  return rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${SLIM_COLUMNS}&status=eq.canonical&parent_slug=eq.${encodeURIComponent(slug)}&limit=50`,
  );
}

/** Steward-confirmed cross-references touching one commons slug. */
export function fetchRefsFor(slug: string): Promise<GalleryRef[]> {
  const s = encodeURIComponent(slug);
  return rest<GalleryRef[]>(
    BUILDER_URL, BUILDER_ANON,
    `gallery_references?select=from_source,from_id,from_title,from_kind,to_source,to_id,to_title,to_kind,relation` +
      `&status=eq.confirmed&or=(and(from_source.eq.commons,from_id.eq.${s}),and(to_source.eq.commons,to_id.eq.${s}))&limit=50`,
  );
}

/** All confirmed commons↔commons references — the constellation's edges. */
export function fetchAllRefs(): Promise<GalleryRef[]> {
  return rest<GalleryRef[]>(
    BUILDER_URL, BUILDER_ANON,
    `gallery_references?select=from_source,from_id,from_title,from_kind,to_source,to_id,to_title,to_kind,relation` +
      `&status=eq.confirmed&from_source=eq.commons&to_source=eq.commons&limit=2000`,
  );
}

/** What the search-commons edge function returns per hit (slimmer than Entry). */
export interface SearchHit {
  slug: string;
  kind: string;
  title: string;
}

/**
 * Hybrid retrieval — the same semantic+full-text `search-commons` edge
 * function the Builder uses, so "help seniors feel less alone" finds the
 * right recipes even when no entry contains those words. Returns [] on any
 * failure or timeout; callers fall back to plain word matching.
 */
export async function searchCommonsHybrid(query: string, matchCount = 40): Promise<SearchHit[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${COMMONS_URL}/functions/v1/search-commons`, {
      method: 'POST',
      headers: {
        apikey: COMMONS_ANON,
        Authorization: `Bearer ${COMMONS_ANON}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query, match_count: matchCount }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { results?: SearchHit[] };
    return Array.isArray(data.results) ? data.results : [];
  } catch {
    return [];
  }
}

/** Entries sharing tags with this one — "related by topic" fill. */
export async function fetchRelatedByTag(entry: Entry, limit = 6): Promise<Entry[]> {
  const tags = (entry.tags ?? []).slice(0, 6);
  if (!tags.length) return [];
  const list = `{${tags.map(t => `"${t.replace(/"/g, '')}"`).join(',')}}`;
  const rows = await rest<Entry[]>(
    COMMONS_URL, COMMONS_ANON,
    `commons_items?select=${SLIM_COLUMNS}&status=eq.canonical&tags=ov.${encodeURIComponent(list)}&limit=40`,
  );
  return rows.filter(r => r.id !== entry.id && hasOwnPage(r)).slice(0, limit);
}

// --- Curation --------------------------------------------------------------

/**
 * Which entries get their own page. References are citations of other
 * people's work — they belong inside pages and in the Reading Room, not as
 * two hundred thin pages competing with their original authors. Short
 * stories read better together on the story wall than alone.
 */
const PAGE_KINDS = new Set(['recipe', 'prompt', 'framework', 'methodology', 'tool']);
export const STORY_PAGE_MIN_CHARS = 500;

export function hasOwnPage(e: Entry): boolean {
  if (PAGE_KINDS.has(e.kind)) return true;
  if (e.kind === 'story') return (e.body?.length ?? e.summary?.length ?? 0) >= STORY_PAGE_MIN_CHARS;
  return false;
}

export const entryPath = (e: Pick<Entry, 'kind' | 'slug'>): string =>
  `/commons/${e.kind}/${e.slug}`;

/**
 * Where a bare slug should land. Slugs are not unique across kinds (a
 * prompt and its parent tool routinely share one), so cross-references —
 * which address commons entries by slug alone — resolve through this
 * preference order, and non-page kinds land on their collection.
 */
const KIND_PREFERENCE = ['recipe', 'tool', 'framework', 'methodology', 'prompt', 'story', 'reference'];

export function resolveSlugTarget(candidates: Entry[]): string {
  const sorted = [...candidates].sort(
    (a, b) => KIND_PREFERENCE.indexOf(a.kind) - KIND_PREFERENCE.indexOf(b.kind),
  );
  for (const e of sorted) if (hasOwnPage(e)) return entryPath(e);
  const first = sorted[0];
  if (!first) return '/commons';
  if (first.kind === 'reference') return `/commons/reading-room#${first.slug}`;
  if (first.kind === 'story') return `/commons/stories#${first.slug}`;
  return '/commons';
}

// --- Kind vocabulary -------------------------------------------------------

export const KIND_LABEL: Record<string, [string, string]> = {
  recipe: ['Recipe', 'Recipes'],
  tool: ['Tool', 'Tools'],
  story: ['Story', 'Stories'],
  prompt: ['Build prompt', 'Build prompts'],
  framework: ['Framework', 'Frameworks'],
  methodology: ['Methodology', 'Methodologies'],
  reference: ['Reference', 'References'],
  program: ['Program', 'Programs'],
};

export const kindLabel = (k: string, plural = false): string =>
  (KIND_LABEL[k] ?? [k, `${k}s`])[plural ? 1 : 0];

export const KIND_COLOR: Record<string, string> = {
  recipe: '#e0662f',
  tool: '#2f6fe0',
  story: '#c2452f',
  prompt: '#0f8a7a',
  framework: '#4a8f3c',
  methodology: '#7a4fc2',
  reference: '#8a7f72',
  program: '#b0812f',
};

// --- Small utilities -------------------------------------------------------

export const esc = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const SAFE_HREF = /^https?:\/\//;

/**
 * Minimal Markdown for commons bodies (headings, lists, links, bold,
 * images, blockquotes). Content is steward-curated but escaped anyway;
 * only http(s) links survive.
 */
export function renderMarkdown(md: string): string {
  const lines = esc(md).split('\n');
  const out: string[] = [];
  let list: 'ul' | 'ol' | null = null;
  let para: string[] = [];

  const inline = (s: string): string =>
    s
      .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt, url) =>
        SAFE_HREF.test(url) ? `<img src="${url}" alt="${alt}" loading="lazy">` : '',
      )
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) =>
        SAFE_HREF.test(url) ? `<a href="${url}" rel="noopener">${text}</a>` : m,
      )
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[\s(])((?:https?:\/\/)[^\s<)]+)/g, (m, pre, url) =>
        m.includes('href=') ? m : `${pre}<a href="${url}" rel="noopener">${url}</a>`,
      );

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list) out.push(`</${list}>`);
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{2,4})\s+(.*)/);
    const li = line.match(/^\s*[-*]\s+(.*)/);
    const oli = line.match(/^\s*\d+[.)]\s+(.*)/);
    const bq = line.match(/^&gt;\s?(.*)/);

    if (h) {
      flushPara(); flushList();
      const level = Math.min(h[1].length, 4);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (li || oli) {
      flushPara();
      const want = li ? 'ul' : 'ol';
      if (list !== want) { flushList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline((li ?? oli)![1])}</li>`);
    } else if (bq) {
      flushPara(); flushList();
      out.push(`<blockquote><p>${inline(bq[1])}</p></blockquote>`);
    } else if (!line.trim()) {
      flushPara(); flushList();
    } else {
      flushList();
      para.push(line.trim());
    }
  }
  flushPara(); flushList();
  return out.join('\n');
}

export const monthKey = (e: Entry): string => (e.published_at ?? e.created_at).slice(0, 7);

/** Stable tiny hash for deterministic layouts. */
export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}
