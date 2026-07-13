import { builderClient } from '@/cloud/builder-client';
import { adminCall } from '@/cloud/account-requests';
import type { GalleryReference, RefRelation, RefSource, RefStatus } from '@/knowledge/gallery-references';

/**
 * IO half of gallery connections (see src/knowledge/gallery-references.ts
 * for the types and direction-aware helpers): reads from the Builder
 * backend's public gallery_references table, steward writes through the
 * admin-requests edge function.
 */

const SELECT_COLUMNS =
  'id, from_source, from_id, from_title, from_kind, ' +
  'to_source, to_id, to_title, to_kind, relation, note, status';

export async function fetchGalleryReferences(): Promise<GalleryReference[]> {
  if (!builderClient) return [];
  const { data } = await builderClient
    .from('gallery_references')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: true });
  return (data ?? []) as unknown as GalleryReference[];
}

// The whole set is small (a few hundred links at most) and changes rarely —
// one fetch per session serves every chat send and gallery open.
let cache: Promise<GalleryReference[]> | null = null;

export function loadGalleryReferences(): Promise<GalleryReference[]> {
  if (!cache) {
    cache = fetchGalleryReferences().catch(() => {
      cache = null; // a failed fetch shouldn't stick for the whole session
      return [];
    });
  }
  return cache;
}

export function invalidateGalleryReferences(): void {
  cache = null;
}

// --- Steward curation (super admin dashboard) ---

export interface ReferenceInput {
  from_source: RefSource;
  from_id: string;
  from_title: string;
  from_kind?: string | null;
  to_source: RefSource;
  to_id: string;
  to_title: string;
  to_kind?: string | null;
  relation?: RefRelation;
  note?: string | null;
}

export async function adminAddReference(input: ReferenceInput): Promise<void> {
  await adminCall({ action: 'reference_add', ...input });
  invalidateGalleryReferences();
}

export async function adminConfirmReference(id: string): Promise<void> {
  await adminCall({ action: 'reference_set_status', id, status: 'confirmed' satisfies RefStatus });
  invalidateGalleryReferences();
}

export async function adminRemoveReference(id: string): Promise<void> {
  await adminCall({ action: 'reference_remove', id });
  invalidateGalleryReferences();
}
