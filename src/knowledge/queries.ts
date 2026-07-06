import { supabase } from './supabase-client';
import type { Tool, Story, Prompt } from './types';

/**
 * RT Studio stores some gallery images as site-relative paths (e.g.
 * `/images/gallery/foo.png`) that only resolve on the Studio's own site.
 * Qualify those against the Studio origin so they load here too; fully
 * qualified URLs (Supabase storage buckets etc.) pass through untouched.
 */
const STUDIO_SITE_ORIGIN = 'https://studio.relationaltechproject.org';

export function resolveStudioAssetUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.startsWith('/') ? `${STUDIO_SITE_ORIGIN}${url}` : url;
}

function resolveToolImages(tool: Tool): Tool {
  return {
    ...tool,
    image_url: resolveStudioAssetUrl(tool.image_url),
    screenshot_urls: tool.screenshot_urls
      ?.map(u => resolveStudioAssetUrl(u))
      .filter((u): u is string => !!u) ?? tool.screenshot_urls,
  };
}

/** Fetch all tools ordered by sort_order */
export async function fetchTools(): Promise<Tool[]> {
  const { data, error } = await supabase
    .from('tools')
    .select('id, name, description, summary, tool_category, url, github_url, image_url, sort_order, created_at, screenshot_urls, hosted_url, hosted_by, lovable_url, creator_name, creator_url, lineage_note, is_joinable, tags')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Failed to fetch tools:', error.message);
    return [];
  }
  return (data ?? []).map(resolveToolImages);
}

/** Fetch all stories ordered by most recent */
export async function fetchStories(): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select('id, title, story_text, full_story_text, attribution, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch stories:', error.message);
    return [];
  }
  return data ?? [];
}

/** Fetch all prompts */
export async function fetchPrompts(): Promise<Prompt[]> {
  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, description, category, example_prompt, parent_tool_id, created_at');

  if (error) {
    console.error('Failed to fetch prompts:', error.message);
    return [];
  }
  return data ?? [];
}

/** Search tools by name, description, or category */
export function searchItems<T extends { name?: string; title?: string | null; description?: string | null; summary?: string | null; tool_category?: string; story_text?: string }>(
  items: T[],
  query: string,
): T[] {
  if (!query.trim()) return items;
  const q = query.toLowerCase();
  return items.filter(item => {
    const fields = [
      'name' in item ? (item as any).name : '',
      item.title ?? '',
      item.description ?? '',
      item.summary ?? '',
      item.tool_category ?? '',
      item.story_text ?? '',
    ];
    return fields.some(f => f.toLowerCase().includes(q));
  });
}
