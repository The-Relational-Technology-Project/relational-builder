import { builderClient } from '@/cloud/builder-client';
import { adminCall } from '@/cloud/account-requests';
import type { Tool } from '@/knowledge/types';

/**
 * Studio ↔ gallery-tool links: which Commons Gallery tools belong to which
 * studios, so the gallery can highlight the viewer's studios' work.
 *
 * Two sources merge here:
 *  1. steward-curated links in the Builder backend (studio_gallery_links,
 *     managed from the super admin dashboard), because the KB project that
 *     owns the tools rows can't carry studio columns yet;
 *  2. `studio:<slug>` tags on the tools rows themselves — nothing writes
 *     these today, but when RT Studio grows native studio tagging the
 *     gallery picks it up with no further changes here.
 */

export interface GalleryLink {
  studio_slug: string;
  tool_id: string;
}

export async function fetchGalleryLinks(): Promise<GalleryLink[]> {
  if (!builderClient) return [];
  const { data } = await builderClient
    .from('studio_gallery_links')
    .select('studio_slug, tool_id');
  return (data ?? []) as GalleryLink[];
}

const STUDIO_TAG_PREFIX = 'studio:';

/** Studio slugs a tool belongs to, from curated links + its own tags */
export function studioSlugsForTool(tool: Tool, links: GalleryLink[]): string[] {
  const slugs = new Set<string>();
  for (const link of links) {
    if (link.tool_id === tool.id) slugs.add(link.studio_slug);
  }
  for (const tag of tool.tags ?? []) {
    if (tag.startsWith(STUDIO_TAG_PREFIX)) {
      const slug = tag.slice(STUDIO_TAG_PREFIX.length).trim().toLowerCase();
      if (slug) slugs.add(slug);
    }
  }
  return [...slugs];
}

// --- Steward curation (super admin dashboard) ---

export async function adminAddGalleryLink(
  studioSlug: string,
  toolId: string,
  toolName?: string,
): Promise<void> {
  await adminCall({ action: 'gallery_add', studio_slug: studioSlug, tool_id: toolId, tool_name: toolName });
}

export async function adminRemoveGalleryLink(studioSlug: string, toolId: string): Promise<void> {
  await adminCall({ action: 'gallery_remove', studio_slug: studioSlug, tool_id: toolId });
}
