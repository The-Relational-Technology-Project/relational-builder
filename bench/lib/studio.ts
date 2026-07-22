import { fetchStudio, type StudioContext } from '@/knowledge/studio-context';
import type { StudioLibraryPromptItem } from '@/knowledge/context-builder';

/**
 * Studio-framed bench runs — the "building as an approved member of a gated
 * studio" path. In production an approved member gets two things woven into
 * every system prompt: the studio's frame (its identity, layered on the base
 * RTP principles) and the studio's private library (its principles, example
 * apps, and build prompts). This helper assembles the same two inputs so a
 * bench trial sees exactly what a member sees.
 *
 * The studio config row is public (KB anon read, via fetchStudio). The
 * library items are studio-private (RLS-gated for members), so the harness
 * reads them through the Supabase Management API with the run's own
 * SUPABASE_ACCESS_TOKEN — never the app's stored keys, matching the bench's
 * env-only credential rule.
 */

export interface StudioFrame {
  studio: StudioContext;
  libraryItems: StudioLibraryPromptItem[];
}

interface RawItem {
  kind: string;
  title: string;
  summary: string | null;
  body: string | null;
  attribution: string | null;
  url: string | null;
  sort_order: number | null;
  created_at: string;
}

const ALLOWED_KINDS = new Set<StudioLibraryPromptItem['kind']>([
  'principle', 'example', 'story', 'prompt', 'tool', 'recipe',
]);

async function fetchLibraryItems(slug: string): Promise<StudioLibraryPromptItem[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  if (!token || !ref) {
    throw new Error(
      'Studio-framed runs need SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF ' +
        '(the builder backend that holds studio_library_items).',
    );
  }
  const sql =
    `select kind, title, summary, body, attribution, url, sort_order, created_at ` +
    `from studio_library_items ` +
    `where studio_slug = '${slug.replace(/'/g, "''")}' ` +
    `and coalesce(status, 'published') <> 'pending' ` +
    `order by sort_order asc nulls last, created_at asc`;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  if (!res.ok) {
    throw new Error(`studio_library_items query failed: ${res.status} ${await res.text()}`);
  }
  const rows = (await res.json()) as RawItem[];
  return rows
    .filter(r => ALLOWED_KINDS.has(r.kind as StudioLibraryPromptItem['kind']))
    .map(r => ({
      kind: r.kind as StudioLibraryPromptItem['kind'],
      title: r.title,
      summary: r.summary,
      body: r.body,
      attribution: r.attribution,
      url: r.url,
    }));
}

/** Assemble a studio's member context (frame + private library) for the bench. */
export async function loadStudioFrame(slug: string): Promise<StudioFrame> {
  const studio = await fetchStudio(slug);
  if (!studio) throw new Error(`Studio '${slug}' not found (KB studios table).`);
  const libraryItems = await fetchLibraryItems(slug);
  return { studio, libraryItems };
}
