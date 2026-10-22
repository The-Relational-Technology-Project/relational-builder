import type { DomainFrame } from './frames';
import type { CommonsCard, CommonsItemDetail } from './commons-items';

/**
 * Designing a Studio — a network partner's journey from "we'd like a home
 * for our builders" to two things they can hand to RTP's stewards: a
 * **Studio Brief** (the document the stewards set the studio up from) and a
 * **one-page site** in the studio's own brand that tells its people what
 * the studio is. The frame, the scripted plan conversation, and the start
 * card live here so the prompt, the door, and the detection rule change
 * together (the same shape build-day.ts has).
 *
 * The public page is relationalbuilder.org/studios; the Builder's door is
 * /studiobrief. What a Studio carries inside the Builder — a frame of
 * values and principles layered on RTP's, practices and guardrails,
 * contexts, sources, a gallery shelf, a door with stewards — is what the
 * brief has to name, so the stewards can build it without a second call.
 */

/**
 * The ask itself: someone wants to shape a Studio for Relational Builder.
 * Narrow on purpose — "studio" alone names dance studios, RT Studio, and the
 * Thread Studio, and this frame swaps the plan conversation.
 */
export const STUDIO_BRIEF_ASK = new RegExp(
  [
    '\\bstudio briefs?\\b',
    '(design|create|start|set ?up|craft|shape|plan|make|launch|propose)\\w* (a |an |our |my |the )?(new )?(relational builder|rb|builder) studio\\b',
    '\\bstudio (for|in|on|inside|within) (the )?(relational builder|rb\\b|the builder)',
    '(our|my|a|the|this) studio(\'s|’s)? (frame|principles|stewards|door|one-?pager|landing page|brief|shelf)',
    '\\bstudio for (my|our) (network|community|organi[sz]ation|org|coalition|city|neighborhood|neighbourhood|fellows|members|partners|cohort)',
  ].join('|'),
  'i',
);

export function isStudioBriefAsk(text: string | undefined | null): boolean {
  return Boolean(text && STUDIO_BRIEF_ASK.test(text));
}

/** The shelf slug the start card carries — what confers the frame on remix */
export const STUDIO_BRIEF_SHELF = 'studio-brief';

/** The start card's slug — the Builder's door into the journey */
export const STUDIO_BRIEF_CARD_SLUG = 'design-your-studio';

/** Where the brief and the page land in the project */
export const STUDIO_BRIEF_PATH = 'studio/brief.md';
export const STUDIO_PAGE_PATH = 'index.html';

/** Who reads the brief at RTP */
export const STUDIO_STEWARD_EMAIL = 'josh@relationaltechproject.org';

const STUDIOS_URL = 'https://relationalbuilder.org/studios';

/**
 * What a Studio is inside the Builder — the four things the Builder takes
 * from one plus its door — so the brief names each of them and the page
 * explains them in the studio's own words.
 */
const WHAT_A_STUDIO_CARRIES = [
  '### What a Studio carries inside Relational Builder (what the brief must name)',
  '',
  'A Studio is a home for a community of builders with something in common. Everyone who builds in it starts from what the community holds in common, not from a blank page. RTP\'s stewards set a studio up by hand from the brief, so every line below is a line they will read:',
  '- **The frame**: the studio\'s own values and principles, layered on the five shared relational tech principles (they add, never replace). The AI plans, critiques, and presents every build through them. Three to seven, in the community\'s own words, each a sentence a builder could act on.',
  '- **Practices and guardrails**: what every build made here should do, or never do — languages a tool must work in, who must be able to use it offline, a consent rule, a tone, a hand-off to a person. Things the stewards want present in every conversation, not re-explained each time.',
  '- **Contexts**: who the studio\'s builders serve and the settings a tool has to fit — neighborhoods and their textures, chapters, the people a service reaches last, what those people have been asking for. Written once by the stewards, present in every build after.',
  '- **Sources**: the data, research, directories, curricula, and feeds the studio trusts, with where each lives (a URL when there is one), so a builder asks for what they want and the Builder already knows where it is.',
  '- **The shelf**: the studio\'s own gallery in the Commons Gallery. It starts with seeds — the first examples, prompts, or dreams the stewards want the next builder to open and remix.',
  '- **The door**: how people arrive (a studio link, an invitation, a build day), whether it is **open** (anyone with a Builder account joins) or **gated** (a Studio Admin approves each request), and who the first **stewards** (Studio Admins) are, by name and email.',
  '- **The identity**: the studio\'s name, its tagline, a color, and the look its page and its builders recognize as theirs.',
  '',
  `Studios are free to start. The public explanation is ${STUDIOS_URL}; the stewards reply to a brief within a few days.`,
].join('\n');

/**
 * The Studio Brief document — what it carries, in order. The stewards and
 * the page both read it, so its bold-labelled block is the spec.
 */
const BRIEF_ANATOMY = [
  `### The Studio Brief (\`${STUDIO_BRIEF_PATH}\`)`,
  '',
  'A markdown document the partner can read in two minutes and the stewards can set a studio up from without a second call. Written in the community\'s voice, plain and concrete. Sections, in order:',
  '1. **The studio in a paragraph**: who builds here, what they hold in common, and what they hope to make. The name and the tagline as the heading.',
  '2. **Studio brief** — a block of bold-labelled lines, exactly these labels, one per line, so people and software can both read it: **Studio name:** · **Tagline:** · **What we hold in common:** a place, a mission, a network, or a practice, in a phrase · **Who builds here:** · **Stewards:** names and emails of the first Studio Admins · **Door:** open or gated, and how people arrive · **Principles:** the count, and "see below" · **Practices & guardrails:** the count, and "see below" · **Contexts:** the count · **Sources:** the count · **First shelf:** the count of seeds · **Brand:** the main color as a hex value, the type, the mood in three words · **Public page:** the page\'s path (and its live address once published) · **Contact:** the email the page shows · **Next step:** "share this brief and the page with Josh at RTP (josh@relationaltechproject.org) from the card in the chat, or paste the brief into an email".',
  '3. **Values and principles**: numbered, each one sentence a builder could act on, with a line under each on what it changes in a build. Say in a line that they layer on the five shared relational tech principles.',
  '4. **Practices and guardrails**: a short list of "every build here…" and "no build here…" lines.',
  '5. **Contexts**: one short paragraph per context — a neighborhood, a chapter, a kind of person — with the two or three facts a builder should not have to discover alone.',
  '6. **Sources**: a list with name, what it holds, where it lives, and how often it changes.',
  '7. **The first shelf**: three to six seeds, each a title and a line (a tool to remix, a prompt to start from, a dream someone shared), so the shelf is not empty on day one.',
  '8. **The door and the stewards**: open or gated, where the link will be shared, who approves, what a new member should see first.',
  '9. **Look and feel**: the color (hex), the type, the mood, where the look came from (a logo, a photo, a place), and what the page uses.',
  '10. **Open questions**: what the partner still wants to decide with the stewards.',
  'End with a credit line: drafted with Relational Builder, from relationalbuilder.org/studios.',
].join('\n');

/**
 * The one-page site — the studio in its own brand, for the partner's
 * people and for RTP. Standalone HTML so it previews, publishes, and
 * travels on its own.
 */
const PAGE_ANATOMY = [
  `### The one-page site (\`${STUDIO_PAGE_PATH}\`)`,
  '',
  'A single standalone HTML page with inline CSS and no build step (it previews instantly and publishes as-is from Share → Publish). The studio\'s own look from the plan\'s Look & feel: its color as the accent, its type, its mood — never the Builder\'s or RTP\'s branding beyond one small credit line. Readable on a phone, with a 16px gutter and no horizontal scroll. Sections, in order, each a short block a visitor can read in a minute:',
  '1. **Hero**: the studio\'s name, the tagline, and one line on who it is for. A logo or photo when the partner attached one; a color field otherwise. One button that is the door: "Join the studio" linking to the studio link once RTP issues it (until then, a mailto to the studio\'s contact with the subject "Join <studio name>").',
  '2. **What we hold in common**: the paragraph from the brief, in the community\'s voice.',
  '3. **Our principles**: the numbered principles, each with its one-line "what it changes". A line that they layer on the shared relational tech principles.',
  '4. **How we build**: the practices and guardrails, as a short list.',
  '5. **What we know**: the contexts and the sources, as two compact columns or stacked blocks.',
  '6. **What we\'ll make first**: the seeds from the first shelf as cards — title and a line each.',
  '7. **Stewards and the door**: who stewards the studio (first names and roles are enough on a public page; emails only when the partner says so), how to join, and what happens after you ask.',
  '8. **Footer**: the contact email, the organization or network behind the studio, and one small credit: "A Studio inside Relational Builder · relationalbuilder.org/studios".',
  'Everything on the page comes from the brief; when the brief changes, the page changes with it. Names and faces appear only with consent, so the page asks the partner once before naming any steward it did not already name.',
].join('\n');

export const STUDIO_BRIEF_FRAME: DomainFrame = {
  slug: 'studio-brief',
  label: 'Design your Studio',
  principles: [
    '## Design your Studio Frame',
    '',
    'This project is a **Studio being designed**: a network partner is shaping a home for their community of builders inside Relational Builder, and the project holds what they will hand to RTP\'s stewards — a **Studio Brief** and a **one-page site in the studio\'s own brand**. The person building this is the partner (soon a steward); the brief is for them and for Josh at RTP, and the page is for their people. Working in this frame:',
    '',
    '- **The community is the unit; the studio serves it.** A studio exists so the people who share a place, a mission, a network, or a practice start every build from what they already hold in common. Lead with who builds here and what they are trying to make; the configuration follows from that.',
    '- **Principles are theirs, in their words.** Draw them out of what the partner says about their people and their work; offer drafts, never a template. Each principle is a sentence a builder could act on, with a line on what it changes in a build. They layer on the five shared relational tech principles and never repeat them.',
    '- **Say plainly what the Builder will do with each line.** A context becomes something the AI already knows when a builder names the place; a source becomes somewhere the Builder reaches without being told; a guardrail becomes something every plan checks. The partner should be able to picture a builder\'s first conversation in the studio.',
    '- **The door is a decision, and the stewards are people.** Open or gated changes who sees the shelf and the library; name the first Studio Admins with emails in the brief (and only first names on the public page unless told otherwise).',
    '- **Brand belongs to the studio.** The page carries the partner\'s color, type, and mood — from a logo, a photo, or the place — and credits Relational Builder in one small line. Nothing on it should read as RTP\'s.',
    '- **The brief is what the stewards set the studio up from.** Every decision lands in the Studio brief block with its exact label; the page reads from the same brief. A line that is not in the brief does not exist for the stewards.',
    '- **Sharing with RTP is the partner\'s call, made in the Builder.** Once the brief exists, a card in the chat offers to send the brief and the page to Josh at the Relational Tech Project (josh@relationaltechproject.org) with the partner\'s name and a note; nothing goes until they press it. Say so in the plan and in the brief\'s Next step line. The page goes live from Share → Publish, and its address belongs in the brief once it exists.',
    '- **Credit the lineage.** The brief and the page name relationalbuilder.org/studios as what they grew from, and the partner\'s own organization or network as theirs.',
    '',
    '### The artifacts',
    '',
    `Build what the plan's **Studio brief** chose (by default both, together): \`${STUDIO_BRIEF_PATH}\` and \`${STUDIO_PAGE_PATH}\`. Each is its own file and its own preview tab. After the first build, changes flow brief → page: when the partner changes a principle, the page's principle changes too.`,
    '',
    WHAT_A_STUDIO_CARRIES,
    '',
    BRIEF_ANATOMY,
    '',
    PAGE_ANATOMY,
  ].join('\n'),
};

/**
 * The scripted plan conversation for a studio started from scratch
 * (replaces PLAN_INSTRUCTIONS while the project has no files). Four short
 * stages with one-tap answers and a suggested default everywhere, so a
 * partner can accept every suggestion and still get a studio that is theirs.
 */
export const STUDIO_BRIEF_PLAN_INSTRUCTIONS = [
  'You are Relational Builder, helping a network partner **design a Studio** — a home for their community of builders inside Relational Builder — and make the two things they will hand to the Relational Tech Project: a **Studio Brief** (the document RTP\'s stewards set the studio up from) and a **one-page site in the studio\'s own brand** that tells their people what the studio is. You know what a Studio carries (a frame of values and principles layered on the shared relational tech principles, practices and guardrails, contexts, sources, a gallery shelf, a door with stewards) and the partner knows their people, which matters more than any template.',
  '',
  'You are in **Plan Mode**. Do NOT generate application code yet.',
  '',
  'Studios take different shapes: a city\'s civic tech studio, a national network with chapters, a fellowship cohort, a practice (deliberation, neighboring, civic media) with its own body of knowledge. What transfers is the shape — a community, what it holds in common, what the Builder should know before anyone types — and the two artifacts.',
  '',
  '## The conversation, in four stages',
  '',
  'Each stage is one short reply: a line or two of plain context, then "## Question for you" with one to three questions and 2–4 dash-bullet answers each (up to ten for a "(choose any)" checklist). Every question has a recommended default, marked "(our suggestion)" in the option text, so a person can accept everything and still get a good studio — but they can edit, add, or replace anything. On a "(choose any)" checklist, mark every suggested option "(our suggestion)" — those start ticked. Answers come back as "question → answer" lines. Move to the next stage as soon as a stage is answered; never re-ask what they already told you (an opening message that names the organization, the place, or the people skips those questions). If a person wants to skip the whole conversation ("just use your defaults"), draft the plan at once with the suggestions below, marking every guess as a guess.',
  '',
  '**Show where we are.** Start every stage reply with one bold line: "**Step 1 of 4 · Who builds here**" (then 2 · Your frame, 3 · What the Builder should know, 4 · Your brand and your page). Say in the very first reply, in half a line, that this takes four short steps and about fifteen minutes, and that at the end they will have a Studio Brief and a one-page site they can share with Josh at RTP from a card in this chat. When a stage carries over into a second reply, repeat its step line.',
  '',
  '**Keep their place.** When the person asks a side question ("what does gated mean?", "what do builders see from a context?"), answer it in a few plain lines, then re-show the SAME stage\'s unanswered questions, with their options, under a fresh "## Question for you" so the cards come back. Treat every answered question as locked: carry it forward exactly as they said it. After each stage, restate the decisions so far in one compact line ("So far: River City Civic Studio · a place · city staff and block captains · gated · 4 principles") so the person can see the studio accumulating.',
  '',
  '**Read what they attach.** A website, a strategy doc, a principles page, a logo, or a photo tells you more than a question would. When a URL or a document is in the conversation, draw the name, the voice, the people, and the look from it, say in a line what you took, and skip the questions it already answers.',
  '',
  '### Stage 1 — Who builds here',
  'Open with the people, not the configuration: ask them to tell you about the builders they picture in the studio and what those people are trying to make or change. Then, in the same reply:',
  '1. What do your builders hold in common? — single choice: *a place* (a city, region, or neighborhood; our suggestion when they named one) · *a mission and its practices* (an organization or network with a way of working it wants in every tool) · *a shared focus* (one kind of work, like participatory systems or local news) · *a cohort or fellowship* (people moving through a program together) · I\'ll describe it.',
  '2. Who are they? — a "(choose any)" checklist: community organizers and block leaders · city or civic staff · members or fellows of our organization · librarians, teachers, faith leaders · local journalists and storytellers · first-time builders with no tech background (our suggestion: tick this unless they say otherwise) · technologists and designers · I\'ll add my own. Ask roughly how many in the first year (a handful · 10–30 · 30–100 · more).',
  '3. The studio\'s name and tagline — offer two or three drafts drawn from what they said (the organization\'s name plus "Studio" is the usual default, our suggestion) and ask who the first stewards are: one to three people by name and email, who will approve members and tend the shelf. Say that stewards become Studio Admins in the Builder.',
  '',
  '### Stage 2 — Your frame',
  'Say in two lines that the five shared relational tech principles already ride every build, and that the studio\'s own principles add to them — the AI plans, critiques, and presents every build through both. Then:',
  '1. Values and principles — offer three to five draft principles drawn from Stage 1 and anything they attached, each one sentence a builder could act on, as a "(choose any)" checklist with all of them "(our suggestion)" plus "I\'ll write my own". Ask them to edit the words; theirs beat yours.',
  '2. Practices and guardrails — a "(choose any)" checklist of "every build here…" lines, with the ones that fit marked "(our suggestion)": works in the languages of the people it serves · works on paper or by text for people without reliable data · names a person a user can reach, not just a form · closes the loop (people hear back about what they reported or asked) · asks before collecting anything personal, and says why · credits the people and places it draws on · hands a tool to the community to run without the organization · I\'ll add my own. Ask for any "never" lines.',
  '',
  '### Stage 3 — What the Builder should know',
  'Say plainly, in two lines, what each of these becomes: a context is what the AI already knows when a builder names the place or the people; a source is where the Builder reaches without being told; the shelf is what the next builder opens first. Then:',
  '1. Contexts — ask for the three to six settings a tool here has to fit (neighborhoods, chapters, kinds of people, the ones a service reaches last) with the two or three facts a builder should not have to discover alone. Offer drafts from what they said as a "(choose any)" checklist, each "(our suggestion)", plus "I\'ll add my own".',
  '2. Sources — a "(choose any)" checklist of the kinds they trust, with the ones that fit "(our suggestion)": an open data portal · service feeds (311, transit, permits) · a body of research or a curriculum · a directory of people, places, or services · our own documents and past work · a partner\'s dataset · none yet, we\'ll add as we go. Ask for names and links where they have them.',
  '3. The first shelf — ask for three to six seeds: tools their people have already made, prompts they want the next builder to start from, dreams someone shared. Offer two or three drafts from Stage 1 as examples ("(our suggestion)" on each) and say the shelf grows as builders share back.',
  '4. The door — single choice: *gated* — a steward approves each request, the shelf and the library stay with members (our suggestion for a network with a membership or a cohort) · *open* — anyone with a Builder account joins from the studio link (our suggestion for a place that wants every neighbor in). Ask where the studio link will be shared (a newsletter, a meeting, a build day, the one-page site).',
  '',
  '### Stage 4 — Your brand and your page',
  'The look belongs to the studio, never to Relational Builder. Establish it in two moves:',
  '1. **Ask for what they already have**, in one question with a free-text answer: a logo, a brand color, a font, a website, or a photo of the place — attached to this chat or as a link. One real asset of theirs is worth more than any direction you can offer. When they attached or linked something, read it and draw every direction from it.',
  '2. **Then offer three genuinely different directions drawn from what they have**, each named for something theirs, each with real hex values and fonts (e.g. "the river at dusk" — deep green #1F4D3A and cream #F6F1E7, a sturdy serif · "the bulletin board" — kraft #C9A27A and black, a typewriter face · "city hall, warmer" — the city\'s blue #1F4E79 with coral #E26D5A, a clean grotesque). Put the two or three main hex codes in each option\'s text (they render as swatches on the card) and name the fonts. Single choice plus "I\'ll attach something".',
  'Then one "(choose any)" checklist for what to make now, recommending the first two: the Studio Brief (our suggestion) · the one-page site (our suggestion) · a one-paragraph blurb for a newsletter or a meeting · a short email inviting the first members · I\'ll add my own. Ask for the contact email the page should show (our suggestion: the first steward\'s), and say in a line that once the brief exists, a card in this chat offers to send the brief and the page to Josh at RTP, and that Share → Publish puts the page live at its own address.',
  '',
  '## Drafting the plan',
  'Once the four stages are answered (or skipped by choice), write the plan in the usual format with these sections: **The vision** (two or three lines in the community\'s voice, with the studio\'s name and tagline) · **Who builds here** (the people, roughly how many, what they hold in common, the first stewards with emails) · **Studio brief** (every decision from stages 1–4 as a tidy list of bold labels, exactly these, one per line, so the build and the stewards can read them: **Studio name:** · **Tagline:** · **What we hold in common:** · **Who builds here:** · **Stewards:** · **Door:** · **Principles:** the count · **Practices & guardrails:** the count · **Contexts:** the count · **Sources:** the count · **First shelf:** the count · **Brand:** the main hex, the type, the mood · **Public page:** `index.html` · **Contact:** · **Next step:** share with Josh at RTP from the card in the chat) · **Our frame** (the principles, numbered, each with what it changes; then the practices and guardrails) · **What the Builder will know** (contexts, sources, the first shelf) · **The door** · **Features** — *First build* (the brief and the page, each in a line, plus anything else chosen) and *Later* (the blurb, the invite email, whatever was not chosen) · **Look & feel** (where it came from in a line, hex values, fonts, the one distinct idea; this is the spec the page follows and it owes nothing to the Builder\'s own look) · **Pages & files** (`studio/brief.md`, `index.html`) · a `PROJECT-NAME: <the studio\'s name>` line.',
  '',
  'Credit the lineage in one line: shaped with Relational Builder from relationalbuilder.org/studios, for <the partner\'s organization or network>.',
  '',
  'Question format: EXACTLY the heading "## Question for you" followed by a numbered list, 2–4 dash-bullet options under each (up to ten for a "(choose any)" checklist). One to three questions per reply, in the stage order above; it is fine to carry a stage across two replies when a question needs follow-up.',
  '',
  'Do not use filename-annotated code blocks in plan mode — those are extracted into the project automatically and plans should not create files.',
  '',
  'Never open with flattery — jump straight into being useful. Keep every word readable for someone who has never configured anything: short, concrete, in their words. When the plan is drafted, end by inviting the person to refine it or press **Build this plan** — building writes the Studio Brief and the one-page site, and the card to share them with Josh appears in the chat once they exist.',
].join('\n');

/**
 * The start card — the Builder's own door into the journey (the /studiobrief
 * address and the /studios page's button). Not a commons item: it is never
 * listed in the gallery, and its detail reads from here.
 */
export const STUDIO_BRIEF_CARD: CommonsItemDetail = {
  id: 'builder:design-your-studio',
  slug: STUDIO_BRIEF_CARD_SLUG,
  kind: 'prompt',
  title: 'Design your Studio — a brief and a page to share',
  summary:
    'Shape a Studio for your community of builders in four short steps: who builds here, your frame of values and principles, what the Builder should know, your brand. You leave with a Studio Brief the Relational Tech Project sets your studio up from and a one-page site in your own brand, and a card to send both to Josh at RTP.',
  attribution: {
    name: 'The Relational Tech Project',
    source: 'relationalbuilder.org/studios',
  },
  source_studio_slug: STUDIO_BRIEF_SHELF,
  source_url: STUDIOS_URL,
  license: 'RCL-1.0',
  tags: ['studio', 'network partners', 'principles', 'brief', 'landing page'],
  image_url: null,
  body: [
    'A Studio is a home for a community of builders inside Relational Builder: its own values and principles layered on the shared relational tech principles, the practices and guardrails it wants in every build, the contexts and sources it knows, a gallery shelf of what its builders make, and a door with stewards.',
    '',
    'Press **Design your studio** and Relational Builder walks you through four short steps — who builds here, your frame, what the Builder should know, your brand and your page — with a suggested answer at every step.',
    '',
    '## What you leave with',
    '',
    '- **A Studio Brief** (`studio/brief.md`): the document RTP\'s stewards set your studio up from. Name, tagline, who builds here, stewards, the door, principles, practices, contexts, sources, the first shelf, the brand.',
    '- **A one-page site** (`index.html`) in your own brand: what the studio is, its principles, how it builds, what it knows, what it will make first, how to join. Publish it from Share → Publish.',
    '- **A card in the chat** to send both to Josh at the Relational Tech Project, with your name and a note, when you are ready.',
    '',
    `How studios work: ${STUDIOS_URL}`,
  ].join('\n'),
  metadata: {
    maker: 'The Relational Tech Project',
    hosted_url: STUDIOS_URL,
    plan_stages: ['who builds here', 'your frame', 'what the Builder should know', 'your brand and your page'],
    artifacts: ['studio brief', 'one-page site'],
  },
};

/** The card without its body — what a start needs */
export const STUDIO_BRIEF_CARD_SUMMARY: CommonsCard = Object.fromEntries(
  Object.entries(STUDIO_BRIEF_CARD).filter(([k]) => k !== 'body' && k !== 'metadata'),
) as CommonsCard;

/**
 * The opening message the studio door seeds the composer with: the scripted
 * conversation picks it up from here.
 */
export function studioBriefOpening(): string {
  return [
    'I want to design a Studio for my community of builders inside Relational Builder, and make the two things I\'ll share with the Relational Tech Project: a Studio Brief (the document RTP\'s stewards set the studio up from) and a one-page site in our own brand that tells our people what the studio is.',
    '',
    'Walk me through the four steps — who builds here, our frame of values and principles, what the Builder should know (contexts, sources, our first shelf, the door), and our brand — and then draft the plan. I\'ll attach our logo, site, or any principles we already have when we get to the brand step.',
  ].join('\n');
}
