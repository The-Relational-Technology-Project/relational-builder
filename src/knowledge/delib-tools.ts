/**
 * The deliberative tools shelf — neighborhood-scale deliberation tech the
 * gallery can show and builds can draw on.
 *
 * Two provenances, both credited everywhere they surface:
 *
 *  - **Metagov's Deliberative Tools Gallery** (metagov.org/delib-tools),
 *    curated by the Interoperable Deliberative Tools project
 *    (metagov.org/projects/interop). The stage taxonomy below is theirs.
 *  - **RTP field picks** — tools people in our network are building or using
 *    at neighborhood scale, added by RTP with the builders named.
 *
 * Code-defined like `frames.ts`, and for the same reason: this is curatorial
 * content with exact attribution that should travel through review, not a
 * live table. When the commons schema grows a deliberation shelf, entries
 * can migrate there with their lineage intact.
 *
 * Screenshots live in `public/delib/` (captured 2026-08 from each tool's
 * public site; they remain the property of their makers and appear here the
 * way a library catalog shows a book jacket — pointing at the real thing).
 */

/** Metagov's governance-cycle stages. Neighborhood work leans middle-five. */
export type DelibStage =
  | 'framing'
  | 'eliciting'
  | 'learning'
  | 'deliberating'
  | 'proposing'
  | 'deciding'
  | 'actuating'
  | 'reflecting';

export const DELIB_STAGE_META: Record<DelibStage, { label: string; blurb: string }> = {
  framing: { label: 'Framing', blurb: 'naming the question so it can be worked on together' },
  eliciting: { label: 'Eliciting', blurb: 'gathering what people actually think and need' },
  learning: { label: 'Learning', blurb: 'building a shared picture before opinions harden' },
  deliberating: { label: 'Deliberating', blurb: 'weighing options together, tensions on the table' },
  proposing: { label: 'Proposing', blurb: 'turning what was heard into concrete options' },
  deciding: { label: 'Deciding', blurb: 'choosing together, with a method everyone can see' },
  actuating: { label: 'Actuating', blurb: 'carrying the decision into action' },
  reflecting: { label: 'Reflecting', blurb: 'looking back at what the process taught' },
};

/** The middle of the cycle — where a block or neighborhood usually lives */
export const NEIGHBORHOOD_STAGES: DelibStage[] = [
  'eliciting', 'learning', 'deliberating', 'proposing', 'deciding',
];

export interface DelibPerson {
  name: string;
  org?: string;
  url?: string;
}

export interface DelibStory {
  title: string;
  place: string;
  text: string;
  sources: { label: string; url: string }[];
}

export interface DelibTool {
  /** Slug — also the screenshot name under /delib/ */
  id: string;
  name: string;
  /** One breath: what it is */
  tagline: string;
  /** Two or three sentences: what it does and how it feels */
  description: string;
  url: string;
  repoUrl?: string;
  license?: string;
  openSource: boolean;
  /** The people and orgs who made it — always named, always linked */
  builders: DelibPerson[];
  stages: DelibStage[];
  /** True when the stages come from Metagov's gallery; false = our mapping */
  listedInMetagovGallery: boolean;
  /** How a neighborhood-scale group would actually use it */
  neighborhoodUse: string;
  /** What a Relational Builder remix of this pattern looks like */
  remixPattern: string;
  /** A real implementation, verified against the cited sources */
  story?: DelibStory;
  /** Interop edges — to other tools, to local relational tech, to on-land spaces */
  connects: string[];
  screenshot?: string;
  /** Provenance caveats — what still needs confirming with the builders */
  attributionNote?: string;
}

/** Who curates the source collection — cited wherever the shelf appears */
export const DELIB_CURATION = {
  collection: 'Deliberative Tools Gallery',
  collectionUrl: 'https://metagov.org/delib-tools',
  curator: 'Metagov',
  curatorUrl: 'https://metagov.org',
  project: 'Interoperable Deliberative Tools',
  projectUrl: 'https://metagov.org/projects/interop',
  repoUrl: 'https://github.com/metagov/interop',
  /** Research directors of the interop project, per metagov.org */
  people: [
    { name: 'Liz Barry' },
    { name: 'Aviv Ovadya' },
    { name: 'Amy Zhang' },
    { name: 'Joshua Tan' },
    { name: 'Eugene Leventhal' },
  ] as DelibPerson[],
  note:
    'Metagov\'s gallery maps "digital tools that go beyond basic voting and commenting" across a governance cycle — framing, eliciting, learning, deliberating, proposing, deciding, actuating, reflecting. Their interop practice asks every tool to publish results in open flatfiles (JSON or CSV) so processes can hand off to each other; tools built here follow it.',
};

export const DELIB_TOOLS: DelibTool[] = [
  {
    id: 'polis',
    name: 'Pol.is',
    tagline: 'Opinion mapping that finds the common ground a room can\'t see',
    description:
      'People respond to short statements — agree, disagree, pass — and write their own; the math surfaces opinion groups and, more importantly, the statements that bridge them. More organic than a survey, lighter than a focus group, built for the moments when a community suspects it agrees more than it argues.',
    url: 'https://pol.is',
    repoUrl: 'https://github.com/compdemocracy/polis',
    license: 'AGPL-3.0',
    openSource: true,
    builders: [
      { name: 'The Computational Democracy Project', url: 'https://compdemocracy.org' },
      { name: 'Colin Megill', org: 'Computational Democracy Project', url: 'https://compdemocracy.org/about' },
    ],
    stages: ['eliciting', 'deliberating', 'reflecting'],
    listedInMetagovGallery: true,
    neighborhoodUse:
      'A "listening wall" for one question your neighborhood is sitting with — seeded with a dozen starting statements, open for two weeks, flyer with a QR code on every corner. The consensus report becomes the agenda for the in-person conversation.',
    remixPattern:
      'A single-conversation listening wall: one neighborhood question, statement voting with agree/disagree/pass, neighbors add their own statements, a live view of where the block agrees — and a printable consensus summary for the next meeting.',
    story: {
      title: 'vTaiwan: consensus at national scale',
      place: 'Taiwan',
      text:
        'Taiwan\'s vTaiwan process pairs Pol.is opinion mapping with face-to-face deliberation: crowdsourced statements reveal rough consensus, then stakeholders meet to work the remaining tensions. The pattern shaped national policy — most famously the ride-sharing rules — and remains the reference case for scaling listening without flattening it.',
      sources: [
        { label: 'Computational Democracy Project case study', url: 'https://compdemocracy.org/case-studies/vtaiwan/' },
        { label: 'Polis methods paper', url: 'https://compdemocracy.org/knowledge-base/' },
      ],
    },
    connects: [
      'The Flyer localizes Pol.is conversations to one neighborhood, on paper first',
      'Talk to the City can read a Pol.is export and write the plain-language report',
      'vTaiwan\'s pattern: opinion map online, then work the hard parts face-to-face',
    ],
    screenshot: '/delib/polis.jpg',
  },
  {
    id: 'the-flyer',
    name: 'The Flyer',
    tagline: 'A North Oakland zine that walks neighbors into online conversation',
    description:
      'A hub for North Oakland neighbors: a print zine on poles and porches, local events, an email newsletter — and localized Pol.is conversations behind the QR codes, so the block\'s attention flows from paper to a shared question and back. Everyone is welcome to contribute ideas and events.',
    url: 'https://www.theflyer.org',
    openSource: false,
    builders: [
      { name: 'Humphrey Obuobi', org: 'LETS Studio · Metagov', url: 'https://metagov.org/people/humphrey-obuobi' },
    ],
    stages: ['eliciting', 'learning', 'deliberating'],
    listedInMetagovGallery: false,
    neighborhoodUse:
      'The whole loop at block scale: the zine carries the question out, the QR code carries neighbors in, the conversation runs online, and the next issue carries back what the neighborhood heard.',
    remixPattern:
      'A neighborhood hub with a print-first front door: a zine/newsletter page, a local events board, and one live neighborhood conversation — plus a printable flyer with a QR code that is the real distribution system.',
    story: {
      title: 'Zine issues as the neighborhood\'s front page',
      place: 'North Oakland, California',
      text:
        'Recent issues carried community food resources, a park discussion, back-to-school support, and local music — the deliberative layer arriving inside something neighbors already want to pick up. The physical, place-based hubs link to online, interactive spaces, and back again.',
      sources: [
        { label: 'theflyer.org', url: 'https://www.theflyer.org' },
        { label: 'Humphrey Obuobi at Metagov', url: 'https://metagov.org/people/humphrey-obuobi' },
      ],
    },
    connects: [
      'Runs Pol.is underneath for the conversation layer',
      'Flyers, zines, and QR codes bridge on-land attention into online deliberation',
      'A newsletter is the return path: what the conversation found goes back to porches',
    ],
    screenshot: '/delib/the-flyer.jpg',
  },
  {
    id: 'heard',
    name: 'Heard',
    tagline: 'A place to be heard — participatory surveys for the feed generation',
    description:
      'A participatory survey platform inspired by Polis, vTaiwan, and Participativo Brazil — "large-scale civic engagement, designed for the Instagram/TikTok generation." Neighbors respond to each other\'s questions and watch results form in real time; grown hyperlocal-first in Washington, DC.',
    url: 'https://heard.vote',
    repoUrl: 'https://github.com/Heard-Platform/heard',
    license: 'MIT',
    openSource: true,
    builders: [
      { name: 'Alex and the Heard team', org: 'Heard Platform', url: 'https://github.com/Heard-Platform/heard' },
    ],
    stages: ['eliciting', 'deliberating'],
    listedInMetagovGallery: false,
    neighborhoodUse:
      'The standing question box for a block or an ANC-scale neighborhood: what should we take up next, how do people actually feel about the proposal, quick pulse before the meeting so the meeting starts warm.',
    remixPattern:
      'A neighborhood question board: anyone poses a question, neighbors respond and see live results, recent questions stay browsable — tuned to one place, with the steward deciding what carries forward to the in-person agenda.',
    connects: [
      'Carries the Pol.is / vTaiwan lineage into a phone-native, feed-style format',
      'ANC-scale: agendas and decisions neighbors can weigh in on between meetings',
      'Pairs with printed meeting notices going out and public minutes coming back',
    ],
    screenshot: '/delib/heard.jpg',
    attributionNote:
      'Builder credit to confirm before wider publishing — the platform is open source at github.com/Heard-Platform/heard.',
  },
  {
    id: 'civicos',
    name: 'CivicOS (The Bloom Project)',
    tagline: 'Infrastructure for public problem-solving: poll → conversations → assembly',
    description:
      'BLOOM builds public infrastructure for democratic co-governance; CivicOS is the platform under its live deployments. Its shape is a relay: a broad anonymous poll seeds small-group community conversations, which seed an assembly of randomly selected residents who produce concrete recommendations.',
    url: 'https://bloom-project.org/#civic-os',
    openSource: false,
    builders: [
      { name: 'The Bloom Project', url: 'https://bloom-project.org' },
    ],
    stages: ['eliciting', 'learning', 'deliberating', 'proposing', 'deciding'],
    listedInMetagovGallery: false,
    neighborhoodUse:
      'The pattern scales down: a two-week neighborhood poll, then three living-room conversations, then a representative group that writes the proposal everyone responds to. Each stage hands its output to the next.',
    remixPattern:
      'A phased civic process in one small app: an open idea poll, a schedule of small-group conversations with shared prompts, and a final proposals page showing what the process concluded and who deliberated.',
    story: {
      title: 'AI & Our Communities: a three-county civic assembly',
      place: 'Central Oregon (Deschutes, Crook, Jefferson counties + Warm Springs)',
      text:
        'In 2026 the Central Oregon Civic Action Project launched an AI civic assembly on the Bloom platform (oregon.bloomproject.us): an anonymous idea poll, small-group community conversations through June, then a fall assembly of randomly selected residents reflecting the region\'s demographics — producing policy recommendations for local and state institutions. Partners include Citizens4Community, Central Oregon Intergovernmental Council and Community College, and Mosaic Health; a 2024 assembly on youth homelessness saw its recommendations adopted by local government and school districts. "We\'re not talking for talk\'s sake," says COCAP\'s Josh Burgess. "The poll and the conversations are the foundation."',
      sources: [
        { label: 'Central Oregonian, May 2026', url: 'https://centraloregonian.com/2026/05/21/a-new-civic-assembly-on-ai-launches-in-deschutes-crook-and-jefferson-counties/' },
        { label: 'KTVZ on the Civic Action Summit', url: 'https://ktvz.com/news/local-news/2026/04/01/deliberative-democracy-takes-center-stage-at-central-oregon-summit/' },
        { label: 'Live deployment', url: 'https://oregon.bloomproject.us/landing?host=true' },
      ],
    },
    connects: [
      'A poll seeds conversations, conversations seed an assembly — stages hand off, nothing is a dead end',
      'Partners\' existing convenings (colleges, health orgs, civic groups) are the on-land infrastructure',
    ],
    screenshot: '/delib/civicos.jpg',
  },
  {
    id: 'talk-to-the-city',
    name: 'Talk to the City',
    tagline: 'AI reports that keep every voice visible in large-scale input',
    description:
      'An open-source LLM pipeline that distills large-scale public input — transcripts, surveys, free text — into interactive reports, clustering themes while preserving the diversity of views represented. The report is something a whole community can read, not a spreadsheet only staff can.',
    url: 'https://ai.objectives.institute/talk-to-the-city',
    repoUrl: 'https://github.com/AIObjectives/talk-to-the-city-reports',
    openSource: true,
    builders: [
      { name: 'AI Objectives Institute', url: 'https://ai.objectives.institute' },
      { name: 'Colleen McKenzie', org: 'AI Objectives Institute (program lead)', url: 'https://ai.objectives.institute' },
    ],
    stages: ['framing', 'eliciting'],
    listedInMetagovGallery: true,
    neighborhoodUse:
      'After the listening: pour in the room-session notes, the survey answers, the conversation export, and get back a readable map of what the neighborhood said — themes, quotes, and the minority views that would otherwise vanish.',
    remixPattern:
      'A "what we heard" report page for one process: themes with real quotes under them, prominence without erasure for minority views, and a plain-language summary a flyer can carry back to the block.',
    story: {
      title: 'From Taiwan\'s ministries to a healthcare union',
      place: 'Taiwan · Tokyo · United States',
      text:
        'Taiwan\'s Ministry of Digital Affairs used Talk to the City for national consultations (AI policy among them); Tokyo polled residents on policy priorities in the 2024 gubernatorial season; a California healthcare workers\' union used it to hear its members. Same pattern each time: masses of voice in, one readable, navigable report out.',
      sources: [
        { label: 'AI Objectives Institute — Talk to the City', url: 'https://ai.objectives.institute/talk-to-the-city' },
        { label: 'Source code', url: 'https://github.com/AIObjectives/talk-to-the-city-reports' },
      ],
    },
    connects: [
      'Reads exports from Pol.is conversations, room sessions, and plain survey flatfiles',
      'Reports give assemblies and stewards a shared learning base before deliberation',
    ],
    screenshot: '/delib/talk-to-the-city.jpg',
  },
  {
    id: 'decidim',
    name: 'Decidim',
    tagline: 'The free participation platform cities and cooperatives run themselves',
    description:
      'Born from Barcelona\'s city participation platform and stewarded by the Decidim Free Software Association, Decidim is a full participatory-democracy stack — proposals, assemblies, participatory budgeting, consultations — used by hundreds of cities, cooperatives, and organizations.',
    url: 'https://decidim.org',
    repoUrl: 'https://github.com/decidim/decidim',
    license: 'AGPL-3.0',
    openSource: true,
    builders: [
      { name: 'Decidim Free Software Association', org: 'grown from Barcelona City Council', url: 'https://decidim.org' },
    ],
    stages: ['framing', 'eliciting', 'deliberating', 'deciding'],
    listedInMetagovGallery: true,
    neighborhoodUse:
      'The horizon a neighborhood process can grow toward: when a block\'s deliberations mature into standing assemblies with budgets, Decidim is the city-grade commons they can move into without leaving open source.',
    remixPattern:
      'A small-scale proposals-and-assemblies flow: neighbors post proposals, endorse each other\'s, and the assembly page shows what advanced — a garden-plot version of the Decidim pattern.',
    connects: [
      'A whole-city participation OS that neighborhood processes can plug into as they grow',
      'Proposals travel from block assemblies up to formal city process',
    ],
    screenshot: '/delib/decidim.jpg',
  },
  {
    id: 'maple',
    name: 'MAPLE',
    tagline: 'Massachusetts residents\' testimony, findable and legible to all',
    description:
      'The Massachusetts Platform for Legislative Engagement — a Code for Boston project — lets residents submit testimony on real bills and read everyone else\'s, building a public archive that demystifies a process most people never see inside.',
    url: 'https://mapletestimony.org',
    repoUrl: 'https://github.com/codeforboston/maple',
    license: 'MIT',
    openSource: true,
    builders: [
      { name: 'Code for Boston volunteers', url: 'https://github.com/codeforboston/maple' },
    ],
    stages: ['deliberating'],
    listedInMetagovGallery: true,
    neighborhoodUse:
      'The learning stage with teeth: when a neighborhood\'s question turns out to be a policy question, MAPLE\'s pattern shows what your neighbors already told the legislature — and turns block concerns into testimony.',
    remixPattern:
      'A neighborhood testimony page for one local decision (a rezoning, a school change): plain-language explainer of what\'s being decided, everyone\'s submitted statements in public, and how to carry them to the hearing.',
    connects: [
      'Neighborhood concerns become testimony on real bills',
      'A learning layer for deliberation: read what others said before adding your voice',
    ],
    screenshot: '/delib/maple.jpg',
  },
];

/**
 * The rest of Metagov's gallery, name + stages, linking people to the source
 * rather than pretending we've vetted each one. Stages verbatim from the
 * gallery's cards.
 */
export const MORE_METAGOV_TOOLS: { name: string; stages: DelibStage[] }[] = [
  { name: 'Deliberative Canvas', stages: ['reflecting'] },
  { name: 'Ethelo', stages: ['deliberating'] },
  { name: 'Evocracy', stages: ['deliberating'] },
  { name: 'Global Brain Algorithm', stages: ['deliberating'] },
  { name: 'Go Vocal', stages: ['deliberating'] },
  { name: 'Harmonica', stages: ['framing', 'eliciting', 'deliberating'] },
  { name: 'Interoperable Co-operative Governance', stages: ['framing', 'deliberating', 'deciding'] },
  { name: 'Iswe Foundation', stages: ['framing', 'eliciting'] },
  { name: 'Ize', stages: ['eliciting'] },
  { name: 'Micropublishing', stages: ['learning'] },
  { name: 'Moral Graph Elicitation', stages: ['eliciting'] },
  { name: 'Pairwise', stages: ['deciding'] },
  { name: 'PolicyCraft', stages: ['deliberating', 'eliciting', 'reflecting'] },
  { name: 'Power Ranker', stages: ['eliciting', 'reflecting', 'deciding'] },
  { name: 'Stanford Participatory Budgeting Platform', stages: ['deciding'] },
  { name: 'Swarmcheck', stages: ['framing', 'learning', 'deliberating'] },
  { name: 'Voice to Vision', stages: ['eliciting'] },
];

/**
 * Starting tensions — the Deliberation Studio's opening move. A neighborhood
 * question almost always sits on a real tension; naming it early keeps the
 * process honest instead of adversarial. The first three come from RTP's
 * Deliberation Studio work; the rest extend the same move.
 */
export const STARTING_TENSIONS: { pair: string; blurb: string }[] = [
  { pair: 'belonging & freedom', blurb: 'everyone\'s welcome, nobody\'s obligated — how do we hold both?' },
  { pair: 'care & self-reliance', blurb: 'leaning on each other without anyone feeling managed' },
  { pair: 'voice & speed', blurb: 'hearing everyone, and still deciding in time to matter' },
  { pair: 'safety & welcome', blurb: 'feeling secure without turning the block inward' },
  { pair: 'preservation & change', blurb: 'what we keep, what we let grow' },
  { pair: 'privacy & knowing each other', blurb: 'being known without being watched' },
];

/**
 * A light heuristic for which tension a question is probably sitting on —
 * a suggestion the person can override, never a classification.
 */
export function suggestTension(question: string): string | null {
  const q = question.toLowerCase();
  const rules: [RegExp, string][] = [
    [/newcomer|new neighbor|welcom|gentrif|belong|includ|left out|clique/, 'belonging & freedom'],
    [/elder|senior|care|check.?in|meal|sick|disab|child ?care|help each other/, 'care & self-reliance'],
    [/meeting|decide|decision|process|slow|fast|committee|vote|consensus/, 'voice & speed'],
    [/safe|crime|police|traffic|speeding|light|camera|patrol/, 'safety & welcome'],
    [/develop|housing|zoning|build|construction|tree|historic|change|rent|density/, 'preservation & change'],
    [/camera|surveil|data|privacy|nextdoor|watch/, 'privacy & knowing each other'],
  ];
  for (const [re, pair] of rules) if (re.test(q)) return pair;
  return null;
}

export function delibToolById(id: string): DelibTool | undefined {
  return DELIB_TOOLS.find(t => t.id === id);
}

function builderNames(tool: DelibTool): string {
  return tool.builders.map(b => (b.org ? `${b.name} (${b.org})` : b.name)).join(', ');
}

/**
 * The compact digest the deliberative frame carries into the system prompt —
 * enough for generation to borrow patterns *and cite them properly*, small
 * enough to ride every deliberative turn.
 */
export function formatDelibToolsForPrompt(): string {
  const lines = [
    '### The deliberative tools shelf',
    '',
    `Patterns to draw on, surfaced via ${DELIB_CURATION.curator}'s ${DELIB_CURATION.collection} (${DELIB_CURATION.collectionUrl}; the ${DELIB_CURATION.project} project — ${DELIB_CURATION.people.map(p => p.name).join(', ')}) and RTP field picks. When a build borrows a pattern, name the tool and its builders in the plan and in the app's about/credits — attribution travels:`,
    '',
  ];
  for (const t of DELIB_TOOLS) {
    const bits = [
      `- **${t.name}** (${builderNames(t)}${t.license ? `, ${t.license}` : ''}) — ${t.tagline}. Stages: ${t.stages.join(', ')}. ${t.url}`,
    ];
    lines.push(...bits);
  }
  lines.push(
    '',
    `More in the gallery (${DELIB_CURATION.collectionUrl}): ${MORE_METAGOV_TOOLS.map(t => t.name).join(', ')}.`,
  );
  return lines.join('\n');
}
