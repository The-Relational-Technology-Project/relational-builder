import type { PlanCheck } from '../plan-types';

/**
 * Mechanical scoring for plan-phase replies — free, objective, and strictly
 * about the CONTRACT plan mode teaches (PLAN_INSTRUCTIONS in
 * knowledge/context-builder.ts): structure, discipline, and grounding that a
 * regex can verify. Whether a plan is warm, creative, or genuinely of its
 * place is the human layer's call; whether commons references are honest is
 * the judge's (bench/lib/judge.ts). Everything here is pure so the selftest
 * can run it on canned replies with no network.
 */

const wordCount = (text: string): number =>
  text.split(/\s+/).filter(Boolean).length;

/** The seven section headings a drafted plan is taught to carry. Detected on
 *  markdown headings (any level) so "## The vision" and "### Vision" both
 *  count. Features/Artifacts are one slot — project asks title it Artifacts. */
const SECTION_DETECTORS: Array<{ name: string; re: RegExp; core: boolean }> = [
  { name: 'The vision', re: /^#{1,4}\s.*vision/im, core: true },
  { name: 'People & practices', re: /^#{1,4}\s.*(people|practices)/im, core: true },
  { name: 'Features/Artifacts', re: /^#{1,4}\s.*(features|artifacts)/im, core: true },
  { name: 'Look & feel', re: /^#{1,4}\s.*look/im, core: true },
  { name: 'The first screen', re: /^#{1,4}\s.*first screen/im, core: true },
  { name: 'Pages & files', re: /^#{1,4}\s.*(pages|files)/im, core: false },
  { name: 'Data & services', re: /^#{1,4}\s.*(data|services)/im, core: true },
];

/** Real display/body faces the plan prompt points at (Google Fonts). A miss
 *  here on a font that exists is possible — the check's detail names what it
 *  looked at, and the human review catches false negatives. */
const KNOWN_FONTS = [
  'Alegreya', 'Amatic', 'Anton', 'Archivo', 'Atkinson', 'Barlow', 'Bebas',
  'Bitter', 'Bricolage', 'Cabin', 'Caprasimo', 'Caveat', 'Chivo', 'Cormorant',
  'Courier Prime', 'Crimson', 'DM Sans', 'DM Serif', 'Domine', 'EB Garamond',
  'Epilogue', 'Figtree', 'Fraunces', 'Gaegu', 'Gelasio', 'Grandstander',
  'IBM Plex', 'Inter', 'Instrument', 'Josefin', 'Kalam', 'Karla', 'Lato',
  'League Spartan', 'League Gothic', 'Libre Baskerville', 'Libre Franklin',
  'Literata', 'Lora', 'Manrope', 'Marcellus', 'Merriweather', 'Montserrat',
  'Newsreader', 'Nunito', 'Oswald', 'Outfit', 'Passion One', 'Patrick Hand',
  'Paytone One', 'Playfair', 'Poppins', 'Public Sans', 'Raleway', 'Righteous',
  'Roboto', 'Rubik', 'Shrikhand', 'Sora', 'Source Sans', 'Source Serif',
  'Space Grotesk', 'Space Mono', 'Special Elite', 'Spectral', 'Staatliches',
  'Vollkorn', 'Work Sans', 'Young Serif', 'Zilla Slab',
];

const HEX_RE = /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/;
const PROJECT_NAME_RE = /^PROJECT-NAME:\s*(.+)\s*$/gm;
const QUESTION_HEADING_RE = /^##\s*Question for you\s*$/im;

/** The slice of `text` from the heading `re` matches to the next heading of
 *  the same-or-higher level (or the end). Null when the heading is absent. */
function sectionSlice(text: string, re: RegExp): string | null {
  const lines = text.split('\n');
  const start = lines.findIndex(l => re.test(l));
  if (start === -1) return null;
  const level = (/^#+/.exec(lines[start])?.[0] ?? '##').length;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    const h = /^(#+)\s/.exec(lines[i]);
    if (h && h[1].length <= level) { end = i; break; }
  }
  return lines.slice(start + 1, end).join('\n');
}

const LIST_ITEM_RE = /^\s*(?:[-*]|\d+\.)\s+\S/;

const countListItems = (chunk: string): number =>
  chunk.split('\n').filter(l => LIST_ITEM_RE.test(l)).length;

/** First build vs Later split — headings or the bold inline form both count. */
function firstBuildSplit(text: string): { first: string; later: string } | null {
  const marker = /^(?:#{2,4}\s*|\s*\*\*)\s*(First build|Later)\b/im;
  const parts: Array<{ label: string; at: number }> = [];
  const lines = text.split('\n');
  let offset = 0;
  for (const line of lines) {
    const m = marker.exec(line);
    if (m) parts.push({ label: m[1].toLowerCase(), at: offset });
    offset += line.length + 1;
  }
  const first = parts.find(p => p.label === 'first build');
  const later = parts.find(p => p.label === 'later' && p.at > (first?.at ?? -1));
  if (!first) return null;
  return {
    first: text.slice(first.at, later?.at ?? text.length),
    later: later ? text.slice(later.at) : '',
  };
}

const FILE_BLOCK_RE = /```[a-zA-Z]+ +filename=/;
const EDIT_BLOCK_RE = /```edit\b|<<<<<<< SEARCH/;

const FLATTERY_RE =
  /^(i love|i really love|great (idea|question)|what a (great|wonderful|lovely)|love (this|that)|amazing|fantastic|wonderful)/i;

function sharedChecks(reply: string, surfacedCount: number, mentionedCount: number): PlanCheck[] {
  const checks: PlanCheck[] = [];

  checks.push({
    id: 'no-file-blocks',
    description: 'No filename-annotated code or edit blocks (plan mode must not create files)',
    pass: !FILE_BLOCK_RE.test(reply) && !EDIT_BLOCK_RE.test(reply),
  });

  const firstLine = reply.split('\n').find(l => l.trim().length > 0) ?? '';
  checks.push({
    id: 'no-flattery-open',
    description: 'Does not open with flattery',
    pass: !FLATTERY_RE.test(firstLine.trim()),
    detail: firstLine.trim().slice(0, 80),
  });

  checks.push({
    id: 'commons-grounded',
    description: 'Draws on at least one surfaced commons entry by name (production chip matcher)',
    pass: surfacedCount === 0 || mentionedCount > 0,
    detail:
      surfacedCount === 0
        ? 'nothing surfaced — auto-pass'
        : `mentioned ${mentionedCount}/${surfacedCount} surfaced`,
  });

  return checks;
}

export function runDraftChecks(
  reply: string,
  surfacedCount: number,
  mentionedCount: number,
): PlanCheck[] {
  const checks = sharedChecks(reply, surfacedCount, mentionedCount);

  const missing = SECTION_DETECTORS.filter(s => s.core && !s.re.test(reply)).map(s => s.name);
  const optionalMissing = SECTION_DETECTORS.filter(s => !s.core && !s.re.test(reply)).map(s => s.name);
  checks.push({
    id: 'sections-present',
    description: 'Carries the drafted plan\'s core sections (vision, people & practices, features/artifacts, look & feel, first screen, data & services)',
    pass: missing.length === 0,
    detail:
      missing.length > 0
        ? `missing: ${missing.join(', ')}`
        : optionalMissing.length > 0
          ? `all core present (optional missing: ${optionalMissing.join(', ')})`
          : 'all seven present',
  });

  const names = [...reply.matchAll(PROJECT_NAME_RE)].map(m => m[1].trim());
  const nameOk =
    names.length === 1 &&
    names[0].length <= 40 &&
    wordCount(names[0]) >= 1 &&
    wordCount(names[0]) <= 5;
  checks.push({
    id: 'project-name',
    description: 'Exactly one PROJECT-NAME line, a real name (1–5 words)',
    pass: nameOk,
    detail: names.length === 0 ? 'no PROJECT-NAME line' : names.join(' | '),
  });

  const split = firstBuildSplit(reply);
  const firstCount = split ? countListItems(split.first) : 0;
  const laterCount = split ? countListItems(split.later) : 0;
  checks.push({
    id: 'first-build-restraint',
    description: 'First build stays small (≤6 items) and Later exists with at least one',
    pass: split !== null && firstCount >= 1 && firstCount <= 6 && laterCount >= 1,
    detail: split
      ? `first build ${firstCount} items, later ${laterCount}`
      : 'no First build / Later split found',
  });

  const look = sectionSlice(reply, /^#{1,4}\s.*look/i);
  const hexes = look?.match(new RegExp(HEX_RE, 'g')) ?? [];
  const fonts = look ? KNOWN_FONTS.filter(f => look.includes(f)) : [];
  checks.push({
    id: 'look-concrete',
    description: 'Look & feel commits to real values — at least one hex color and a named font',
    pass: hexes.length > 0 && fonts.length > 0,
    detail: look
      ? `hex: ${hexes.slice(0, 4).join(' ') || 'none'} · fonts: ${fonts.join(', ') || 'none recognized'}`
      : 'no Look & feel section',
  });

  checks.push({
    id: 'no-question-section',
    description: 'The drafted plan asks no questions of its own',
    pass: !QUESTION_HEADING_RE.test(reply),
  });

  checks.push({
    id: 'invites-build',
    description: 'Ends by inviting refinement or "Build this plan"',
    pass: /build this plan/i.test(reply),
  });

  const words = wordCount(reply);
  checks.push({
    id: 'size-band',
    description: 'A readable draft, not a stub or a spec dump (250–1800 words)',
    pass: words >= 250 && words <= 1800,
    detail: `${words} words`,
  });

  return checks;
}

export function runExploreChecks(
  reply: string,
  surfacedCount: number,
  mentionedCount: number,
): PlanCheck[] {
  const checks = sharedChecks(reply, surfacedCount, mentionedCount);

  const sectionHits = SECTION_DETECTORS.filter(s => s.re.test(reply)).length;
  const hasName = PROJECT_NAME_RE.test(reply);
  PROJECT_NAME_RE.lastIndex = 0;
  checks.push({
    id: 'does-not-draft',
    description: 'A seed gets a conversation, not a document — no drafted plan, no PROJECT-NAME',
    pass: !hasName && sectionHits <= 1,
    detail: `${sectionHits} plan-section headings${hasName ? ', PROJECT-NAME present' : ''}`,
  });

  const qBlock = sectionSlice(reply, QUESTION_HEADING_RE);
  const questions = qBlock ? qBlock.split('\n').filter(l => /^\d+\.\s+\S/.test(l.trim())).length : 0;
  const options = qBlock ? qBlock.split('\n').filter(l => /^\s*-\s+\S/.test(l)).length : 0;
  checks.push({
    id: 'question-format',
    description: 'Uses "## Question for you" with 1–3 numbered questions and one-tap options',
    pass: qBlock !== null && questions >= 1 && questions <= 3 && options >= 2,
    detail: qBlock ? `${questions} questions, ${options} option bullets` : 'no question section',
  });

  const proseBefore = qBlock
    ? reply.slice(0, reply.search(QUESTION_HEADING_RE))
    : reply;
  const words = wordCount(proseBefore);
  checks.push({
    id: 'explore-brevity',
    description: 'Exploring reply stays short — prose before the questions ≤260 words',
    pass: words <= 260,
    detail: `${words} words before the question section`,
  });

  return checks;
}

export function runPlanChecks(
  reply: string,
  expect: 'draft' | 'explore',
  surfacedCount: number,
  mentionedCount: number,
): PlanCheck[] {
  return expect === 'draft'
    ? runDraftChecks(reply, surfacedCount, mentionedCount)
    : runExploreChecks(reply, surfacedCount, mentionedCount);
}
