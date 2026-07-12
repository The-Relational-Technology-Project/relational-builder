import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';
import { submitToCommons } from '@/project/commons-submit';

/**
 * A studio's private library — principles, examples, prompts, and tools that
 * live behind a gated studio's door. Approved members see them in the gallery
 * and get them woven into the AI's context while they build; everyone else
 * doesn't know they exist until a Studio Admin explicitly shares an item
 * with the broader commons.
 *
 * All reads and writes go through RLS on the Builder backend: SELECT needs
 * approved membership (or the item to be shared), writes need the studio
 * admin role.
 */

export type StudioItemKind = 'principle' | 'example' | 'story' | 'prompt' | 'tool' | 'recipe';
export type StudioItemVisibility = 'studio' | 'shared';

export const STUDIO_ITEM_KINDS: { key: StudioItemKind; label: string }[] = [
  { key: 'principle', label: 'Principle' },
  { key: 'example', label: 'Example' },
  { key: 'story', label: 'Story' },
  { key: 'prompt', label: 'Prompt' },
  { key: 'tool', label: 'Tool' },
  { key: 'recipe', label: 'Recipe' },
];

export type StudioItemStatus = 'pending' | 'approved';

export interface StudioLibraryItem {
  id: string;
  studio_slug: string;
  kind: StudioItemKind;
  title: string;
  summary: string | null;
  body: string | null;
  url: string | null;
  image_url: string | null;
  attribution: string | null;
  tags: string[];
  visibility: StudioItemVisibility;
  /** pending = a member's offer awaiting a Studio Admin; approved = on the shelf */
  status: StudioItemStatus;
  /** Lineage within the studio: the shelf item this one was remixed from */
  remix_of: string | null;
  created_by: string | null;
  commons_submitted_at: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface StudioItemInput {
  studio_slug: string;
  kind: StudioItemKind;
  title: string;
  summary?: string | null;
  body?: string | null;
  url?: string | null;
  image_url?: string | null;
  attribution?: string | null;
  tags?: string[];
  sort_order?: number;
}

const SELECT_COLUMNS =
  'id, studio_slug, kind, title, summary, body, url, image_url, attribution, tags, ' +
  'visibility, status, remix_of, created_by, commons_submitted_at, sort_order, ' +
  'created_at, updated_at';

/**
 * Every studio item this builder can see: their approved studios' shelves
 * plus anything other studios have shared. RLS is the filter — the query
 * itself asks for everything.
 */
export async function fetchVisibleStudioItems(): Promise<StudioLibraryItem[]> {
  if (!builderClient || !useAuthStore.getState().user) return [];
  const { data } = await builderClient
    .from('studio_library_items')
    .select(SELECT_COLUMNS)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });
  // The generated DB types don't know this table yet — shape is ours to assert
  return (data ?? []) as unknown as StudioLibraryItem[];
}

// --- Member share-back: the studio remix loop's on-ramp ---

/**
 * Offer a build back to the studio's gallery. It lands as `pending` and
 * studio-private; a Studio Admin approves it onto the shelf, where the next
 * member can find and remix it (remix_of keeps the lineage).
 */
export async function submitStudioItem(
  input: StudioItemInput & { remix_of?: string | null },
): Promise<StudioLibraryItem | null> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return null;
  const { data, error } = await builderClient
    .from('studio_library_items')
    .insert({
      ...input,
      tags: input.tags ?? [],
      status: 'pending',
      visibility: 'studio',
      created_by: user.id,
    })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  // The offer is studio life — members see "X shared ..." in Network Updates
  void import('@/cloud/studios').then(({ recordStudioActivity }) =>
    recordStudioActivity('share', input.studio_slug, input.title, input.url ?? undefined),
  );
  return data as unknown as StudioLibraryItem;
}

// --- Studio Admin curation (RLS enforces the admin role) ---

export async function createStudioItem(input: StudioItemInput): Promise<StudioLibraryItem | null> {
  const user = useAuthStore.getState().user;
  if (!builderClient || !user) return null;
  const { data, error } = await builderClient
    .from('studio_library_items')
    .insert({ ...input, tags: input.tags ?? [], created_by: user.id })
    .select(SELECT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as StudioLibraryItem;
}

/** Approve a member's pending offer onto the shelf (Studio Admin, via RLS) */
export async function approveStudioItem(id: string): Promise<void> {
  await updateStudioItem(id, { status: 'approved' });
}

export async function updateStudioItem(
  id: string,
  patch: Partial<StudioItemInput> & {
    visibility?: StudioItemVisibility;
    status?: StudioItemStatus;
    commons_submitted_at?: string;
  },
): Promise<void> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { error } = await builderClient
    .from('studio_library_items')
    .update(patch)
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteStudioItem(id: string): Promise<void> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { error } = await builderClient
    .from('studio_library_items')
    .delete()
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Share an item beyond the studio. Two things happen, both explicit:
 * visibility flips to 'shared' (every signed-in builder now sees it in the
 * gallery), and the item goes to the RT Commons review queue so it can join
 * the canonical commons with attribution intact.
 */
export async function shareStudioItemToCommons(
  item: StudioLibraryItem,
  studioLabel: string,
): Promise<{ ok: boolean; error?: string }> {
  const profile = useAuthStore.getState().profile;
  const result = await submitToCommons({
    title: item.title,
    summary: item.summary ?? item.title,
    body: item.body ?? undefined,
    builderName: item.attribution ?? profile?.display_name ?? studioLabel,
    sourceUrl: item.url ?? undefined,
    tags: [...item.tags, `studio:${item.studio_slug}`].slice(0, 8),
    contributionType: item.kind === 'tool' ? 'tool' : 'program',
  });
  if (!result.ok) return { ok: false, error: result.error };
  await updateStudioItem(item.id, {
    visibility: 'shared',
    commons_submitted_at: new Date().toISOString(),
  });
  return { ok: true };
}

/** Share within Relational Builder only — no commons submission */
export async function setStudioItemVisibility(
  id: string,
  visibility: StudioItemVisibility,
): Promise<void> {
  await updateStudioItem(id, { visibility });
}
