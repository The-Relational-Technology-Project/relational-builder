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
  /** The screen in words, for models that can't read images (GLM 4.5 Air
   *  and GPT-OSS are text-only): layout, hierarchy and how specific the
   *  content is, without the subject's own words */
  layout: string;
}

export const REFERENCE_SCREENS: ReferenceScreen[] = [
  {
    id: 'schedule',
    file: 'schedule.png',
    shape: 'a schedule of sessions people sign up for (a library skill swap)',
    calls: /\b(schedule|sessions?|calendar|events?|rsvp|sign[- ]?ups?|slots?|shifts?|meal train|potluck|gatherings?|club|classes)\b/i,
    subject: /\bskill[- ]?(swap|share)\b/i,
    layout:
      "At laptop width, two columns: about 60% on the left for the next date's sessions, 40% on the right for a wall of short thank-you quotes. A large serif date heads the page, with a bold count of what is still open, the address and hours with a pin icon, and one line naming the person who runs it and where to find them. Each session card has the person's initials, the skill as a title, a chip saying who teaches, a line with their full name, time and room, one concrete sentence of what you will learn, and one full-width button naming the person. Warm off-white page, white cards, one deep accent color for buttons, a thin gold rule on quotes. Every item names a real person and a local detail.",
  },
  {
    id: 'content-wall',
    file: 'content-wall.png',
    shape: 'a wall of short posts people add and respond to (a listening wall)',
    calls: /\b(wall|questions?|responses?|answers?|feedback|survey|ideas?|posts?|stories|share|me too|listening)\b/i,
    subject: /\blistening wall\b/i,
    layout:
      "A row of three tabs across the top, one per topic, each with a count. Below, the active topic as a large bold question on the left with its answer form (a textarea with a characters-left count, a first-name field that can stay blank, one button) and a line naming the organizer who reads every note; on the right, answers in two columns as cards with the quote at reading size, who and when, and a small 'me too' count button. Pale page, near-white cards, one dark accent for the active tab and button, a thin warm line along the top of each card. Answers are written by hand in different voices and name real local places.",
  },
  {
    id: 'guide',
    file: 'guide.png',
    shape: 'a plain-language guide with logistics (a ballot guide)',
    calls: /\b(guide|ballot|vote|voting|explain|how to|resources?|directory|faq|help desk|rights|benefits|where to)\b/i,
    subject: /\bballot\b/i,
    layout:
      "A slim top bar with section tabs and a language switch. Two columns: about 58% for the main guide, 42% for logistics. The first card is the most important fact, very large (a date), with hours, where to go, one orange line of emphasis and one primary button. Below, one card per item with a plain heading, 'What it is' and 'Who it affects' in two or three plain sentences, and a short list of names with their neighborhoods. The right column has location cards with name, street address, hours in bold and a transit line, then a tinted card for the alternative, then two buttons for offering and asking for help. White and pale blue-grey, deep navy for headers, plain readable sans.",
  },
  {
    id: 'archive',
    file: 'archive.png',
    shape: 'an archive of places and memories (a street\'s oral history)',
    calls: /\b(archive|history|histories|oral|interviews?|museum|memories|digest|newsletter|issues?|zine|heritage)\b/i,
    subject: /\b(street stories|oral history of main street|westminster)\b/i,
    layout:
      "A warm paper-toned page with a serif masthead and the place under it. Two columns: about 62% for the main list, 38% for a featured card and a suggestions list. The hero card has a small-caps place line, a large serif headline that counts what exists ('8 buildings, 16 voices so far'), one evocative sentence, one button and a line naming who tends the project. Each item card has a serif name, a decade chip, where it is, one line of what it was, a pull quote with a gold left rule and who said it, and a button. The side card is tinted and shows one quote large. Real places and plain local voices throughout.",
  },
  {
    id: 'status-tool',
    file: 'status-tool.png',
    shape: 'a status tool with a live state and a feed (a community fridge)',
    calls: /\b(status|stock(ed)?|restock|available|borrow|lend(ing)?|tools?|supplies|inventory|pantry|fridge|claim|needs?|offers?)\b/i,
    subject: /\b(community )?fridge\b/i,
    layout:
      "Two columns under a slim top bar with two pill tabs and an 'acting as' switcher. Left (about 45%): a large colored status block whose color follows the state, a big bold headline stating the state, one plain line and who checked it when, three equal buttons to update it, a line naming the steward and where they are, then a short post form with two toggle buttons and a textarea with a concrete placeholder. Right: a feed of cards with avatar, first name, relative time, a small status tag, one sentence naming specific items and where they are, and a status chip or a thank-you button. Cool grey page, white cards, one deep accent for actions.",
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
    'specific its content is, while building this app for its own place and people. Do not copy its subject or its words.' +
    // The layout named beside the image: over 16 Gemma builds each (Nov 14),
    // image plus words gave 16 of 16 working and 6 desktop classes, against
    // 15 of 16 and 4 for the image alone
    ` The screen, described: ${screen.layout}`
  );
}

/** The same reference in words, for a model that can't read images */
export function referenceTextNote(screen: ReferenceScreen): string {
  return (
    `A reference screen from the Builder's library, described in words: ${screen.shape}, a different app, built well. ${screen.layout} ` +
    'Use it as the reference for quality, not subject: match its layout, hierarchy and how specific its content is, while building this app for its own place and people. Do not copy its subject or its words.'
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
