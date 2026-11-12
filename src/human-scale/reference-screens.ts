/**
 * Reference screens: a small library of well-made first screens, one per
 * shape of neighborhood tool, shown to an open model beside a first build.
 *
 * Why: on Nov 11 the bench showed Gemma a screenshot of a DIFFERENT
 * well-made app (docs/human-scale/LOG.md). It took on the layout, type and
 * use of color without copying the subject: 12 of 12 builds worked, and
 * laptop layouts moved toward Opus's. A library like this is something a
 * community can keep and choose for itself, with no closed model involved.
 *
 * The first five screens are Opus 5.5 builds from the bench (Nov 6 and 10)
 * until people choose their own; the files live in
 * public/human-scale/references/. Behind the human-scale flag, open
 * builder models only, first build of an empty project, and only when the
 * person attached no image of their own (ChatPanel's send).
 */

export interface ReferenceScreen {
  id: string;
  file: string;
  /** What kind of tool this screen shows, in plain words */
  shape: string;
  /** Prompt words that call for this shape */
  calls: RegExp;
  /** The subject on screen: a prompt about the same thing gets another
   *  shape's screen, so the reference lifts quality without being copied */
  subject: RegExp;
}

export const REFERENCE_SCREENS: ReferenceScreen[] = [
  {
    id: 'schedule',
    file: 'schedule.png',
    shape: 'a schedule of sessions people sign up for (a library skill swap)',
    calls: /\b(schedule|sessions?|calendar|events?|rsvp|sign[- ]?ups?|slots?|shifts?|meal train|potluck|gatherings?|club|classes)\b/i,
    subject: /\bskill[- ]?(swap|share)\b/i,
  },
  {
    id: 'content-wall',
    file: 'content-wall.png',
    shape: 'a wall of short posts people add and respond to (a listening wall)',
    calls: /\b(wall|questions?|responses?|answers?|feedback|survey|ideas?|posts?|stories|share|me too|listening)\b/i,
    subject: /\blistening wall\b/i,
  },
  {
    id: 'guide',
    file: 'guide.png',
    shape: 'a plain-language guide with logistics (a ballot guide)',
    calls: /\b(guide|ballot|vote|voting|explain|how to|resources?|directory|faq|help desk|rights|benefits|where to)\b/i,
    subject: /\b(ballot|voting) guide\b/i,
  },
  {
    id: 'archive',
    file: 'archive.png',
    shape: 'an archive of places and memories (a street\'s oral history)',
    calls: /\b(archive|history|histories|oral|interviews?|museum|memories|digest|newsletter|issues?|zine|heritage)\b/i,
    subject: /\b(street stories|oral history of main street|westminster)\b/i,
  },
  {
    id: 'status-tool',
    file: 'status-tool.png',
    shape: 'a status tool with a live state and a feed (a community fridge)',
    calls: /\b(status|stock(ed)?|restock|available|borrow|lend(ing)?|tools?|supplies|inventory|pantry|fridge|claim|needs?|offers?)\b/i,
    subject: /\b(community )?fridge\b/i,
  },
];

const DEFAULT_ID = 'status-tool';

/** The screen for a prompt: the shape its words call for most, never one
 *  showing the prompt's own subject */
export function pickReferenceScreen(text: string): ReferenceScreen {
  const allowed = REFERENCE_SCREENS.filter(s => !s.subject.test(text));
  const scored = allowed
    .map(s => ({ s, n: (text.match(new RegExp(s.calls.source, 'gi')) ?? []).length }))
    .sort((a, b) => b.n - a.n);
  if (scored[0] && scored[0].n > 0) return scored[0].s;
  return allowed.find(s => s.id === DEFAULT_ID) ?? allowed[0] ?? REFERENCE_SCREENS[0];
}

/** What the model is told about the attached screen (the Nov 11 wording) */
export function referenceNote(screen: ReferenceScreen): string {
  return (
    `The attached screenshot is a reference screen from the Builder's library: ${screen.shape}, a different app, built well. ` +
    'Use it as the reference for quality, not subject: match its layout density, hierarchy, type, how it uses color and how ' +
    'specific its content is, while building this app for its own place and people. Do not copy its subject or its words.'
  );
}

export function referenceUrl(screen: ReferenceScreen): string {
  return `/human-scale/references/${screen.file}`;
}

/** The screen as a data URL, so any provider can read it (a localhost or
 *  private URL can't be fetched by a hosted model) */
export async function referenceDataUrl(screen: ReferenceScreen): Promise<string | null> {
  try {
    const res = await fetch(referenceUrl(screen));
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>(resolve => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
