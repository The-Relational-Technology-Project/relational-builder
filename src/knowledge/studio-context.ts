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
 * Studios the app knows natively — identity and appended principles that
 * ride even before (or without) a row in the KB project's `studios` table.
 * A DB row with richer fields wins field-by-field; the builtin fills gaps.
 * Responsive Cities lives here because its principles were authored in the
 * Builder repo's own studio work, and the KB's multi-tenant columns
 * (tagline, appended_principles) haven't landed yet.
 */
const RESPONSIVE_CITIES_PRINCIPLES = `Builders in this studio work in and around city government: city managers,
mayor's offices, IT and data teams, and the community partners alongside
them. City staff are local relational technologists. The infrastructure
they tend (service systems, open data, internal knowledge) is relational
infrastructure, and every build here should strengthen the relationship
between a city and its residents, not just the city's throughput.

### Responsive Cities principles

1. **Cities are made of neighborhoods.** Every build lands somewhere: a
   block, a corridor, a district. Ground the build in the real place with
   its real names, and let the builder's own neighborhood knowledge shape
   it, not just their job title.

2. **Build for the resident who never calls 311.** Efficiency gains for
   the people already using a service can widen the gap for those who
   don't. Before optimizing a channel, ask who isn't in it and why, and
   make reaching them part of the build.

3. **Community in the loop.** Wherever AI acts on the city's behalf,
   design a checkpoint a resident could understand: what was decided,
   by what, and where a person re-enters the loop.

4. **Glass box, not black box.** A resident should be able to see what a
   system does, what data it reads, and who answers for it. If a request
   disappears into the machine, the build isn't done.

5. **Detect conditions, not people.** Point cameras and models at
   potholes, dumping, broken lights, and downed limbs. Never at faces,
   plates, or patterns of individual behavior.

6. **Public data flows both ways.** Read from the city's open data, and
   treat community-generated knowledge (values, dreams, deliberation
   outcomes) as a dataset worth contributing back to the commons.

7. **Community organizations build here too.** The network commits to
   equipping community groups with access and insights so they can
   engage with and influence city decisions. Take that seriously: the
   tools built in this studio should be usable, and remixable, by the
   community organizations alongside each city, and the studio door
   should be open to them as members, not just as subjects of
   engagement.

### Guardrails

Every build in this studio should:
- Name the neighborhood and the residents it serves before the first
  screen is designed
- Read from the city's live open data (MCP endpoint) rather than pasted
  snapshots, and note what a resident would need to see to trust it
- Keep a human path visible: a name, a desk, a number, a door
- Work for the resident with no smartphone, no broadband, or a different
  first language
- Say which community voices shaped it and which are still missing

No build in this studio may:
- Simulate resident input or generate synthetic "community feedback" as
  a stand-in for real engagement
- Use detection or automation to identify, score, or track individual
  people
- Make eligibility, enforcement, or prioritization decisions about a
  resident without human review
- Ship anything resident-facing without a named steward in city hall who
  answers for it
- Collect more resident data than the tool needs, or move resident data
  across city or network lines`;

const BUILTIN_STUDIOS: Record<string, StudioContext> = {
  'responsive-cities': {
    slug: 'responsive-cities',
    label: 'Responsive Cities Studio',
    color: 'hsl(210 60% 45%)',
    description:
      'A studio for the Responsive Cities Network — city builders and community partners in ten cities, building with their residents, not just for them.',
    tagline: 'Every city worker is a community builder.',
    appendedPrinciples: RESPONSIVE_CITIES_PRINCIPLES,
  },
};

/** Builtin fields fill whatever the DB row doesn't carry yet */
function withBuiltin(ctx: StudioContext): StudioContext {
  const base = BUILTIN_STUDIOS[ctx.slug];
  if (!base) return ctx;
  return {
    ...ctx,
    color: ctx.color ?? base.color,
    description: ctx.description ?? base.description,
    tagline: ctx.tagline ?? base.tagline,
    appendedPrinciples: ctx.appendedPrinciples ?? base.appendedPrinciples,
  };
}

/**
 * Studios ready to appear in the switcher. Thread, Bloom, and Responsive
 * Cities exist in the network but aren't listed for every builder — they
 * stay reachable by deep link (?studio=slug), which is each studio's door.
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
  const fromDb = error || !data
    ? []
    : (data as Record<string, unknown>[]).map(toContext).filter(s => s.slug).map(withBuiltin);
  const seen = new Set(fromDb.map(s => s.slug));
  return [...fromDb, ...Object.values(BUILTIN_STUDIOS).filter(s => !seen.has(s.slug))];
}

export async function fetchStudio(slug: string): Promise<StudioContext | null> {
  const clean = slug.trim().toLowerCase();
  if (!clean) return null;
  const { data, error } = await supabase
    .from('studios')
    .select('*')
    .eq('slug', clean)
    .maybeSingle();
  if (error || !data) return BUILTIN_STUDIOS[clean] ?? null;
  return withBuiltin(toContext(data as Record<string, unknown>));
}

/** Format the studio frame for the system prompt — appended, never replacing */
export function formatStudioForPrompt(studio: StudioContext): string {
  const lines = [
    `## Studio Frame: ${studio.label}`,
    '',
    `This build is happening within **${studio.label}**, a studio in the relational tech network${studio.description ? ` — ${studio.description}` : ''}.${studio.tagline ? ` ("${studio.tagline}")` : ''}`,
    '',
    'The base Relational Technology Principles above always apply in full — a studio adds to them, never replaces them. How to hold the studio:',
    `- **The builder chooses the audience; the studio informs the build.** Members build for many communities — sometimes their ${studio.label} family, just as often their block, apartment complex, school, congregation, or crew. Read WHO each build is for from what the person says (and their profile), and make THAT community the world of the build: its people, its places, its language. Never transplant ${studio.label} personas or program names into a build that's for somewhere else. When the audience is genuinely unclear, ask — it's one of the most build-shaping questions.`,
    `- **Know ${studio.label}'s world fluently.** When the person mentions the studio's community — its people, named roles, programs, places, or ways of doing things — use them accurately and naturally, drawing on the studio's library where present. A build FOR the studio community should feel unmistakably like it: seeded personas carry the studio's real roles and relationships, and the UI speaks its language.`,
    `- **Values travel even when the cast doesn't.** ${studio.label}'s principles shape every build whoever it's for: let the two or three that bear most on this tool make visible decisions in the design — and say briefly which ones shaped what when you present a plan or finish a build.`,
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
