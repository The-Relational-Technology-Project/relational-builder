import type { CommonsSearchResult } from './commons-search';

/**
 * Domain frames — principle sets that layer onto the base RTP principles the
 * way a studio's appended principles do, but decoupled from studio
 * membership. A frame arrives three ways:
 *
 *  1. Remixed from a commons gallery card (a civic media recipe stamps the
 *     civic-media frame at project birth),
 *  2. Sensed from retrieval (commons hits dominated by a frame's entries),
 *  3. Carried in project lineage from either of the above, so it persists.
 *
 * Frames are code-defined for now; when the multi-tenant studios schema
 * lands, steward-editable principles can supersede these entries.
 */

export interface DomainFrame {
  slug: string;
  label: string;
  /** Full prompt block, injected after the studio frame */
  principles: string;
}

export const CIVIC_MEDIA_FRAME: DomainFrame = {
  slug: 'civic-media',
  label: 'Civic Media',
  principles: [
    '## Civic Media Frame',
    '',
    'This project involves civic media — community information, journalism, storytelling, or media practice. The News Futures Charter principles apply alongside the base RTP principles (they add, never replace):',
    '',
    '1. **News as Care** — information is a public good and a service; design with care and empathy as primary values.',
    '2. **Hierarchy of Information Needs** — survival info first (housing, food, transport, economic opportunity), then connection, then abstract.',
    '3. **Information Equity** — a person\'s identity must not determine their information outcomes; design for multilingual, low-income, low-tech access.',
    '4. **Do-ocracy** — decisions by those doing the work; power to those who show up.',
    '5. **Reparative Journalism** — those excluded from media shape its future.',
    '6. **News as Public Infrastructure** — civic information as shared infrastructure, like parks or libraries, with community ownership.',
    '7. **Listening First** — start with community listening before producing anything.',
    '8. **Collaborative Over Competitive** — share resources and coordinate rather than compete.',
    '9. **Care for the Caregivers** — build in rest and anti-burnout practice.',
    '10. **Community Accountability** — media accountable to the communities it serves.',
    '',
    'Civic media requires two components together: **civic information** that meets a real human need (agency, belonging, or well-being) and a **participatory process** (collective sense-making, collective action, or collective care). Motivation is infrastructure — people need to see that their contribution mattered.',
    '',
    'Working in this frame:',
    '',
    '- **Software is optional — lead with the practice.** Relationships, listening, and format come first; an app or site only when it strengthens the practice. Many civic media plans need no software at all — say so plainly when that\'s true.',
    '- **Be transparent about the frame.** Tell the person you\'re approaching this as a civic media project, and agree on what "the build" is: a program plan, printable materials (flyers, info sheets, zines), software, or a mix.',
    '- **Listening First is the front door.** If they haven\'t heard from their community yet, offer to walk the "What Does Your Community Need?" worksheet from the commons together before choosing a recipe.',
    '- **Programs are builds too.** A program build produces real files: plan documents as filename-annotated markdown (e.g. `program/plan.md`), printable flyers as standalone, self-contained HTML pages with inline styles (e.g. `materials/flyer.html` — each gets its own preview tab beside the app), plus companion software only when warranted. Outputs can arrive one at a time across the conversation: a site now, a flyer next, a distribution plan after. Give plans This Week / This Month / This Quarter horizons.',
    '- **Attribution travels.** When a plan draws on a commons recipe, pattern, or example, name it and credit its source — e.g. the Civic Media Cookbook (Jihii Jolly & Jennifer Brandel, with the News Futures Working Group) or the practitioner behind a field example.',
  ].join('\n'),
};

export const PRACTICE_FIRST_FRAME: DomainFrame = {
  slug: 'practice-first',
  label: 'Practice-First',
  principles: [
    '## Practice-First Frame',
    '',
    'This project starts from (or strongly resembles) a community practice from the commons — a recipe for gathering, care, connection, or neighboring. Working in this frame:',
    '',
    '- **The practice is the unit, software is optional.** The right deliverable may be a program plan, printable materials (flyers, sign-up sheets, info cards), software, or a mix. Lead with relationships and assets; suggest software only when it genuinely strengthens the practice.',
    '- **Be transparent about which it is.** Say what you think "the build" should be and let the person confirm before producing it.',
    '- **Programs are builds too.** Plan documents are filename-annotated markdown files (e.g. `program/plan.md`); flyers are standalone, self-contained printable HTML pages with inline styles (e.g. `materials/flyer.html` — each gets its own preview tab). These are first-class outputs of a build, alongside any app, and can arrive one at a time across the conversation.',
    '- **Credit the recipe.** Name the commons recipe a plan draws from and its source; lineage travels with the build.',
  ].join('\n'),
};

export const FRAMES: Record<string, DomainFrame> = {
  [CIVIC_MEDIA_FRAME.slug]: CIVIC_MEDIA_FRAME,
  [PRACTICE_FIRST_FRAME.slug]: PRACTICE_FIRST_FRAME,
};

export function framesFromSlugs(slugs: string[] | undefined | null): DomainFrame[] {
  if (!slugs) return [];
  return slugs.map(s => FRAMES[s]).filter((f): f is DomainFrame => Boolean(f));
}

/** The frame a commons item confers when remixed from the gallery */
export function frameSlugsForCommonsItem(item: { source_studio_slug?: string | null; kind: string }): string[] {
  if (item.source_studio_slug === 'civic-media') return [CIVIC_MEDIA_FRAME.slug];
  if (item.kind === 'recipe') return [PRACTICE_FIRST_FRAME.slug];
  return [];
}

/**
 * Implicit sensing: infer frames from what retrieval surfaced for this
 * message. No mode switch — when the commons answers a question with civic
 * media entries, the civic media principles ride along; when a practice
 * recipe clearly leads, the practice-first stance does. Thresholds are
 * deliberately conservative: frames nudge the plan, so a passing mention
 * shouldn't stamp one.
 */
export function detectFrames(results: CommonsSearchResult[]): DomainFrame[] {
  const top = results.slice(0, 8);
  if (top.length === 0) return [];

  const civicHits = top.filter(r => r.source_studio_slug === 'civic-media').length;
  if (civicHits >= 2 || top[0]?.source_studio_slug === 'civic-media') {
    return [CIVIC_MEDIA_FRAME]; // includes the practice-first stance
  }

  const recipeHits = top.filter(r => r.kind === 'recipe').length;
  const recipesLeading = top.slice(0, 3).filter(r => r.kind === 'recipe').length;
  if (recipesLeading >= 2 || (top[0]?.kind === 'recipe' && recipeHits >= 3)) {
    return [PRACTICE_FIRST_FRAME];
  }

  return [];
}
