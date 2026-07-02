import { supabase } from './supabase-client';

/**
 * Fetch a shared build plan from RTP Studio by id, share id, or share URL.
 * Studio RLS only exposes rows with is_shared = true, so this can never
 * read someone's private plan.
 */

export interface StudioBuildPlan {
  id: string;
  title: string;
  plan_markdown: string;
  detailed_prompt: string | null;
  recommended_track: string | null;
  created_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Pull a plan reference out of a raw id, share id, or pasted Studio URL */
function extractRef(input: string): string {
  const trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    for (const key of ['plan', 'share', 'id']) {
      const v = url.searchParams.get(key);
      if (v) return v;
    }
    const segments = url.pathname.split('/').filter(Boolean);
    return segments[segments.length - 1] ?? trimmed;
  } catch {
    return trimmed;
  }
}

/** Recent shared plans from the Studio — RLS only ever exposes shared rows */
export async function listSharedBuildPlans(limit = 4): Promise<Pick<StudioBuildPlan, 'id' | 'title' | 'recommended_track' | 'created_at'>[]> {
  const { data, error } = await supabase
    .from('build_plans')
    .select('id, title, recommended_track, created_at')
    .eq('is_shared', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data;
}

export async function fetchStudioBuildPlan(input: string): Promise<StudioBuildPlan | null> {
  const ref = extractRef(input);
  if (!ref) return null;

  let query = supabase
    .from('build_plans')
    .select('id, title, plan_markdown, detailed_prompt, recommended_track, created_at')
    .eq('is_shared', true);

  query = UUID_RE.test(ref) ? query.eq('id', ref) : query.eq('share_id', ref);

  const { data, error } = await query.maybeSingle();
  if (error || !data) return null;
  return data as StudioBuildPlan;
}

/** Compose the imported plan as chat-ready markdown */
export function studioPlanToMarkdown(plan: StudioBuildPlan): string {
  const parts = [`# Build plan: ${plan.title}`, '', plan.plan_markdown.trim()];
  if (plan.detailed_prompt?.trim()) {
    parts.push('', '## Detailed guidance (from RTP Studio)', '', plan.detailed_prompt.trim());
  }
  return parts.join('\n');
}
