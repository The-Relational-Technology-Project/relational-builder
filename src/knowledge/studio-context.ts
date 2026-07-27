import { supabase } from './supabase-client';

/**
 * Studio-aware building — the seam between the Builder and the (soon
 * multi-tenant) RT Studio. A Studio is a config record: branding + appended
 * principles + a local commons, layered on the shared base. Building "with"
 * a Studio means the AI speaks from the base RTP principles plus that
 * Studio's additions, and the Studio travels in the project's lineage.
 *
 * The multi-tenant schema (appended principles, tagline, join settings) is
 * drafted but not yet applied on the Studio project, so reads here are
 * tolerant: we select * and pick up richer fields as they appear. Until
 * then a Studio contributes its identity (name, color, description).
 */

export interface StudioContext {
  slug: string;
  label: string;
  color: string | null;
  description: string | null;
  tagline: string | null;
  /** Steward-added principles, layered on the base (multi-tenant schema; null until applied) */
  appendedPrinciples: string | null;
}

/** Future-schema column candidates, in preference order */
function pick(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const v = row[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return null;
}

function toContext(row: Record<string, unknown>): StudioContext {
  return {
    slug: String(row.slug ?? ''),
    label: String(row.label ?? row.name ?? row.slug ?? 'Studio'),
    color: pick(row, ['color', 'theme_color']),
    description: pick(row, ['description']),
    tagline: pick(row, ['tagline']),
    appendedPrinciples: pick(row, ['appended_principles', 'added_principles', 'principles_appended']),
  };
}

/**
 * Studios ready to appear in the switcher. Thread and Bloom exist in the
 * network but aren't ready to share with builders yet — they stay reachable
 * by deep link (?studio=slug) for their own stewards, invisible otherwise.
 */
export const PUBLIC_STUDIO_SLUGS = ['rt'];

/** Every builder starts inside this studio's frame */
export const DEFAULT_STUDIO_SLUG = 'rt';

export async function listStudios(): Promise<StudioContext[]> {
  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[])
    .map(toContext)
    .filter(s => s.slug && PUBLIC_STUDIO_SLUGS.includes(s.slug));
}

/** Every studio in the network, unlisted ones included — steward tooling only */
export async function listAllStudios(): Promise<StudioContext[]> {
  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map(toContext).filter(s => s.slug);
}

export async function fetchStudio(slug: string): Promise<StudioContext | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .eq('slug', clean)
    .maybeSingle();
  if (error || !data) return null;
  return toContext(data as Record<string, unknown>);
}

/** Format the studio frame for the system prompt — appended, never replacing */
export function formatStudioForPrompt(studio: StudioContext): string {
  const lines = [
    `## Studio Frame: ${studio.label}`,
    '',
    `This build is happening within **${studio.label}**, a studio in the relational tech network${studio.description ? ` — ${studio.description}` : ''}.${studio.tagline ? ` ("${studio.tagline}")` : ''}`,
    '',
    'The base Relational Technology Principles above always apply in full — a studio adds to them, never replaces them. Inhabit the studio; don\'t just mention it:',
    `- **The studio's community is the world of the build.** Seeded people, roles, places, and example content come from ${studio.label}'s actual community and city where you know them — never from a generic imagined neighborhood. If the studio has named roles for its people, the app's language and seeded personas use them.`,
    `- **Speak in the studio's voice.** What things are called, how invitations and empty states read, what gets celebrated — all of it should sound like ${studio.label}, not like default app copy.`,
    `- **Principles are build directives.** When ${studio.label}'s principles appear (below or in its library), let the two or three that bear most on this tool make visible decisions in the design — and say briefly which ones shaped what when you present a plan or finish a build.`,
  ];
  if (studio.appendedPrinciples) {
    lines.push(
      '',
      `### ${studio.label}'s added principles (from its stewards)`,
      '',
      studio.appendedPrinciples,
    );
  }
  return lines.join('\n');
}
