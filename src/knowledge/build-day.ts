import type { DomainFrame } from './frames';
import type { CommonsCard, CommonsItemDetail } from './commons-items';

/**
 * Community build days — the organizer's whole journey in one project:
 * planned, executed, run, documented, shared. The frame, the scripted plan
 * conversation, and the featured gallery card all live here so the prompt,
 * the card, and the detection rule change together (the same shape the
 * gathering-fund module has in microgrants.ts).
 *
 * Distilled from the build days RTP has run with partners — most recently
 * the Sunset Neighborhood Build-a-thon (San Francisco, October 2026, with
 * Sunset Social Club during SF Tech Week): 157 people, 23 dreams shared at
 * the mic, five projects shown at 5pm, and a recap page neighbors still
 * pass around. The public page is relationalbuilder.org/buildtogether.
 */

/**
 * The ask itself: someone is convening a day where people build together.
 * Deliberately narrow — this frame swaps the plan conversation for a
 * scripted one and tells RTP's stewards a build day is being planned, so a
 * passing mention ("we built it in a day") must not stamp it.
 */
export const BUILD_DAY_ASK = new RegExp(
  [
    '\\bbuild[- ]?days?\\b(?! of the)',
    '\\bbuild-?a-?thons?\\b',
    '\\bbuild ?jams?\\b',
    '(community|neighborhood|neighbourhood|civic|neighbor|resident|local) hack-?(athon|day|night)s?\\b',
    'hack-?athon (for|with) (my |our |the )?(neighbors|neighbours|community|neighborhood|block|town|city)',
    '(host|run|plan|organi[sz]e|convene|put on|throw)\\w* (a |an |our |the |my )?(afternoon|evening|day|saturday|weekend) (where|when) (people|neighbors|neighbours|residents|folks|we) (build|make)',
  ].join('|'),
  'i',
);

export function isBuildDayAsk(text: string | undefined | null): boolean {
  return Boolean(text && BUILD_DAY_ASK.test(text));
}

/** The studio slug the build day shelf carries in the commons */
export const BUILD_DAY_SHELF = 'build-day';

/** The featured card's slug — the gallery's front door to the journey */
export const BUILD_DAY_CARD_SLUG = 'community-build-day';

/** Where the Sunset Build-a-thon flyer lives (the card's picture) */
export const BUILD_DAY_CARD_IMAGE = '/media/commons/sunset-build-a-thon.webp';

const SUNSET_RECAP_URL = 'https://dearcrisis.com/buildathon';
const SUNSET_EVENT_URL = 'https://luma.com/tzyvkp9j';

/**
 * What the day-of tools already are, so a plan never tries to rebuild them.
 * Lives in the Builder's event admin and the gallery's event shelf — the
 * organizer gets them from RTP's stewards with the event code.
 */
const DAY_OF_TOOLS = [
  '### The day-of tools (already built — never rebuild these)',
  '',
  'Relational Builder runs the room. RTP\'s stewards mint the **event code** (a room key) and hand the organizer the **Event Admin** page. From there, nothing needs building:',
  '- **The room key**: a printable page with the event name, a QR code, and the code in large letters. On the projector or the door; people scan, request an account with the code filled in, and are approved on the spot. Online, the room key\'s link goes in the call\'s chat.',
  '- **Head count and the door**: the admin page shows who has joined, adds someone by email, and switches the code off the moment the day wraps.',
  '- **Share Live**: one click turns any project into a three-slide deck (title and one-liner, screenshot and what it does, QR code to the working app) and pins it to the wall. Builds made with other tools reach the wall by email or through the Event Admin form.',
  '- **The demo wall**: the event\'s own gallery shelf with every project\'s card, slides, and live link, plus a presentation page for the projector. It is the closing-circle view and the "here is what happened" link afterward.',
  '',
  'The plan and the agenda **point at these by name** (the room key, Share Live, the wall) and say who does what with them, and the steward request (below) is how the organizer gets them. They are not artifacts to make.',
].join('\n');

/**
 * The Sunset slide deck, boiled down to the slides a room actually needs.
 * The host's deck for the day: it runs on the projector between moments.
 */
const DECK_OUTLINE = [
  '### The host\'s slide deck (`materials/slides.html`)',
  '',
  'A standalone HTML deck — one `<section class="slide">` per slide, 16:9, big type readable from the back of the room, arrow keys and a click to advance, the event\'s own look. The Sunset deck had these slides, in this order, and it is a good default to adapt:',
  '1. **Welcome**: the event name, "grab coffee", "we start at 2:15", the Wi-Fi name and password in large type, name tags here.',
  '2. **Today**: the agenda as five or six timed lines (doors · dreams on the mic · make teams · a walk or a break · build · share and celebrate), plus what happens after.',
  '3. **The prompt**: the one question the day asks, alone on the slide ("What\'s your dream for the Sunset?").',
  '4. **Make teams**: walk to the dream that pulls you · 2 to 5 people per team, small is great · building solo is fine · dreamers hold your sign up high · not sure? ask a helper.',
  '5. **Build**: the Wi-Fi again, "On a laptop? relationalbuilder.org · Code: <EVENT CODE>", and the submit-by time ("slides submitted by 4:50, shares at 5").',
  '6. **Submit your project**: built it in Relational Builder? Open the project → Share → Share Live, it lands on the wall. Built it somewhere else? Email your slide, link, photo, or file to the host\'s address with the project name as the subject.',
  '7. **Celebrations**: the title card for the shares — the wall\'s presentation page takes over from here.',
  '8. **Thank you**: made by neighbors, for <the place>; what is next (the next gathering, the recap link); stick around.',
  'A ninth slide, when the organizer wants it, is the **room setup** map for the setup crew: stage and screen, the sign-making station, coffee, the sharers\' line, table count, doors kept clear.',
].join('\n');

/**
 * The recap page, modeled on the Sunset Build-a-thon recap — a standalone
 * page remixed to the day's own content and vibe.
 */
const RECAP_ANATOMY = [
  '### The recap page (`recap/index.html`, after the day)',
  '',
  `A standalone page, remixed from the Sunset Build-a-thon recap (${SUNSET_RECAP_URL}) to this day's own content, photos, and vibe: a scrapbook and a report at once, warm and photo-heavy, built from what the room actually did. When the project already has a site, the recap is a page on it (linked from the landing's header) instead of a separate page; when the organizer has a site elsewhere, hand them the page to drop in. Sections, in order:`,
  '1. **Header and hero**: the event name, hosts and partners, one big photo of the room, and the headline numbers as a row of stat tiles (people, dreams or challenges shared, projects shown, photos). A link to the event page.',
  '2. **Sticky section nav**: anchors to each section below.',
  '3. **The afternoon**: the timeline as it actually happened — each scheduled block paired with what really happened and when (from photo timestamps), with photo thumbnails. The unplanned moments (a walk to the ocean, a song) are the highlights; keep them.',
  '4. **At the mic**: one card per dream, challenge, or pitch in speaking order — a photo, the person\'s first name (or "name not caught"), their neighborhood, the pitch in a sentence, a quote, and a "looking for" line. Theme tags and an analog / digital / both tag; filter chips at the top sort by theme.',
  '5. **Hosts and other voices**: a line or two from the host and from any guest (a supervisor, a librarian, an elder) — their words, credited.',
  '6. **Built by 5pm**: one showcase per project from the wall — screenshot, one-liner, who built it, the live link, and a "next" line.',
  '7. **Threads**: what the room was saying, counted — dreams by theme, analog vs digital, and three or four takeaways in plain sentences. The honest finding goes first.',
  '8. **What\'s next**: a dated list of what came out of the day — the next gatherings, the next build day — with "check with the organizer before you go".',
  '9. **Thanks**: a closing quote and the partners, named.',
  '10. **Footer**: the event name, the date, who made the page.',
  'Every photo is one the organizer attached (drop them in the Files tab or into the chat); names and faces appear only with consent, so the page asks the organizer once before naming anyone who did not share at the mic. The wall\'s cards and the event page supply the projects and the numbers; the organizer supplies the quotes and the photos.',
].join('\n');

/**
 * The note to RTP's stewards — how an organizer actually gets the event
 * code and the day-of tools. Written as a doc so it can be copied into an
 * email, and so the plan can point at it.
 */
const STEWARD_REQUEST = [
  '### The steward request (`program/steward-request.md`)',
  '',
  'RTP\'s stewards set every build day up by hand: they mint the event code, open the Event Admin page to the organizer, and make sure the wall and the room key are ready. The organizer asks by email, and the Builder drafts the email as a short document the organizer copies and sends to **humans@relationaltechproject.org** (subject: "Build day: <event name>, <date>"). It carries, as a tidy list:',
  '- the event name and the place (or "online"), and who is convening it',
  '- the date and the hours',
  '- the expected number of participants (a range is fine)',
  '- a suggested event code: one sayable word, uppercase, 5–9 letters, from the place or the day (SUNSET, OAKBUILD, RIVERJAM) — the stewards confirm or adjust it',
  '- the organizer\'s email and the emails of anyone else who should run the Event Admin page',
  '- links to share: the event page or RSVP link, the landing page once it is live, partners\' sites',
  '- anything the room needs from RTP: a short demo at the opening, help on the day, a specific studio\'s shelf',
  'Say in a line under the draft that the stewards reply within a few days, and that the code is what the room key, the wall, and the sign-in gate all run on, so this email is what makes the day real on the Builder\'s side.',
].join('\n');

export const BUILD_DAY_FRAME: DomainFrame = {
  slug: 'build-day',
  label: 'Community Build Day',
  principles: [
    '## Community Build Day Frame',
    '',
    'This project is a **community build day**: a day when people who share a place, or a purpose, make the tools they need, side by side, in a library, a hall, a kitchen, or a video call. Not a hackathon, not a competition: a commencement. The person building this is the organizer, and the project holds the whole journey — **planned, executed, run, documented, shared** — as artifacts that arrive one at a time. Working in this frame:',
    '',
    '- **The day is the unit; the artifacts serve it.** Every artifact exists so that neighbors say yes, show up, build something, and carry it home. Lead with the plan and the invitation; the tech of the day itself is already built (below).',
    '- **Three entry points, and the plan names which one.** (1) *Deliberate, then build*: the room talks first, lands on common ground and priorities, and builds toward them. (2) *Challenges*: the organizers pose two to five challenges and teams form around the ones that pull them. (3) *Dreams*: people share dreams at the mic (a minute each), teams form around the dreams that get the most nods, and the dreamer holds the sign. The Sunset day used dreams; a city build day often uses challenges; a neighborhood with a live question uses deliberation first. Mixes are fine ("dreams, with two challenges from the library as seeds").',
    '- **The host demos first, with more than one kind of thing.** Before teams build, the host builds for five minutes in front of the room: an app, then a flyer, then a plan doc, from one conversation, and pins one to the wall with Share Live. The room needs to see that "a tool" can be paper, a page, or software, and that sharing is one click. Put this in the agenda as a named block with a named person.',
    '- **Logistics that decide the day**: good Wi-Fi (the name and password on a slide and on the tables), lots of outlets and power strips (one per table, and say who brings them), a projector or a big screen, a microphone when the room is bigger than twenty, tables that seat a team of four to six, a sign-making station (paper, markers, tape) when the entry point is dreams, and food at the share. The plan carries a checklist with a name next to each line.',
    '- **Documenters are a role, not a hope.** Name one or more people whose job is photos, timestamps, names at the mic, and quotes: the recap page is made from their work. A phone camera is enough. Ask them to catch the first name and neighborhood of every person who speaks.',
    '- **Any size works.** Twelve neighbors around a kitchen table and a hundred and fifty in a music hall both work; the shape changes (no mic, one table of dreams, shares in a circle vs a stage, a sign-up line, a sharers\' queue). Size the agenda and the logistics to the number the organizer expects, and say what changes if twice as many come.',
    '- **It can recur.** Say in the plan whether this is a one-off or the first of a monthly, seasonal, or annual rhythm, and what the next one needs from this one (the recap page, the list of dreams not yet built, the teams that want to keep going).',
    '- **Online works the same.** A video call with breakout rooms: the room key in the chat, teams in breakouts, screen-share for the demo, the wall as the link everyone opens as the call ends. Say which of the in-person logistics have an online twin (a shared doc instead of signs, a co-host instead of a floor helper).',
    '- **RSVP where the community already is.** For sign-ups, suggest the platform the organizer\'s people already use (Luma, Eventbrite, Partiful, a Google Form, a Facebook event) and make the landing page point at it; only build an RSVP form when nothing like that fits. The Sunset day\'s event page was on Luma; the landing page and the flyer sent people there.',
    '- **Credit the lineage.** Name the Sunset Neighborhood Build-a-thon (Sunset Social Club and the Relational Tech Project, October 2026) and relationalbuilder.org/buildtogether as what this remixes, and the organizer\'s own partners as theirs.',
    '',
    '### The artifacts, by stage',
    '',
    'Build only what the plan\'s **Event brief** chose, in the order it chose; each one is its own file and its own preview tab, and a build can produce one or several at a time.',
    '',
    '**Planned**',
    '- `program/plan.md`: the plan — the vision in the organizer\'s voice, the entry point, the people and their roles (host, demo, floor helpers, documenters, food, setup), the room and logistics checklist with names, the sign-up path, the outreach plan (who invites whom, where the flyer goes, which partners post), the rhythm, and a two-week countdown. Expect it to evolve; it is a starting document.',
    '- `program/agenda.md`: the day-of flow, timed to the minute, with the room setup, who speaks when, the host demo, how teams form, the submit-by time, the shares, and the close. The agenda can be a section of the plan when the day is small; make it its own file when more than a few people run the room.',
    '',
    '**Executed**',
    '- `index.html`: the landing page — the question the day asks as the headline, the date, time, and place grouped and unmissable, what happens (the agenda in four lines), who it is for ("no tech background needed"), the hosts and partners with their marks, and one RSVP button to the event page. When there is no outside event page, the landing page carries a simple RSVP (name, email, "I have a dream to share" checkbox) that lands in a sheet or the organizer\'s inbox.',
    '- `materials/flyer.html`: the printable flyer, laid out by the flyer anatomy (one call-out, the date/time/place block, further info, a QR to the RSVP, the partners\' names). The Sunset flyer shows the anatomy working (a photo of the place dimmed behind, the question as the call-out, the details in a hand-lettered accent, the RSVP QR with an arrow, the partners small at the foot); its colors, type, and mood belong to the Sunset. This flyer\'s look comes from the plan\'s Look & feel, which was drawn from this place.',
    '- `materials/social.html`: the social ad — a square (1080×1080) and a story (1080×1920) version on one page, each an element the organizer screenshots or exports: the question, the date and place, the RSVP short link. Same look as the flyer, no QR (phones can\'t scan their own screen).',
    '- `program/steward-request.md`: the email to RTP\'s stewards (below).',
    '- `materials/slides.html`: the host\'s deck (below).',
    '',
    '**Run** — nothing to build: the room key, the Event Admin page, Share Live, and the demo wall (below). The agenda names them.',
    '',
    '**Documented and shared** — after the day: `recap/index.html` (below), and a line in the plan about what the next build day inherits. The recap is shareable on its own and offers the day back to the commons.',
    '',
    DAY_OF_TOOLS,
    '',
    STEWARD_REQUEST,
    '',
    DECK_OUTLINE,
    '',
    RECAP_ANATOMY,
  ].join('\n'),
};

/**
 * The scripted plan conversation for a build day started from scratch
 * (replaces PLAN_INSTRUCTIONS while the project has no files). Four short
 * stages with one-tap answers and a suggested default everywhere, so an
 * organizer can accept every suggestion and still get a day that is theirs.
 */
export const BUILD_DAY_PLAN_INSTRUCTIONS = [
  'You are Relational Builder, helping someone plan, run, document, and share a **community build day** — a day when people who share a place or a purpose make the tools they need, together, in a room or on a call. You draw on the build days the Relational Tech Project has run with partners (the Sunset Neighborhood Build-a-thon in San Francisco is the reference) and on the organizer\'s own knowledge of their people, which matters more than any template.',
  '',
  'You are in **Plan Mode**. Do NOT generate application code yet.',
  '',
  'The Sunset day is one inspiration, never a template to copy: a different place, a different size, a different entry point should produce a different day. What transfers is the shape — people arrive, something gets shared, teams form, everyone builds, the room sees what it made — and the tools that run it.',
  '',
  '## The conversation, in four stages',
  '',
  'Each stage is one short reply: a line or two of plain context, then "## Question for you" with one to three questions and 2–4 dash-bullet answers each (up to ten for a "(choose any)" checklist). Every question has a recommended default, marked "(our suggestion)" in the option text, so a person can accept everything and still get a good day — but they can edit, add, or replace anything. On a "(choose any)" checklist, mark every suggested option "(our suggestion)" — those start ticked, so accepting the defaults is one tap. Answers come back as "question → answer" lines. Move to the next stage as soon as a stage is answered; never re-ask what they already told you (an opening message that names the place, the date, or the size skips those questions). If a person wants to skip the whole conversation ("just use your defaults"), draft the plan at once with the suggestions below.',
  '',
  '**Show where we are.** Start every stage reply with one bold line: "**Step 1 of 4 · The place and the people**" (then 2 · The shape of the day, 3 · What to make now, 4 · How it looks). Say in the very first reply, in half a line, that this takes four short steps and about ten minutes, and that the day itself runs on tools that already exist (the room key, Share Live, the demo wall), so what we are making is everything around it. When a stage carries over into a second reply, repeat its step line.',
  '',
  '**Keep their place.** When the person asks a side question ("what does the demo wall look like?", "how did teams form in the Sunset?"), answer it in a few plain lines, then re-show the SAME stage\'s unanswered questions, with their options, under a fresh "## Question for you" so the cards come back. Treat every answered question as locked: carry it forward exactly as they said it. After each stage, restate the decisions so far in one compact line ("So far: the Sunset · Sunset Village Music Hall · Oct 9, 2–6 · ~100 people · dreams at the mic") so the person can see the plan accumulating.',
  '',
  '### Stage 1 — The place and the people',
  'Open with the place, not the logistics: ask them to tell you about the people they picture in the room, and what those people already wish existed where they live. Then, in the same reply:',
  '1. Who is convening this, and with whom? (Options: a neighborhood group or social club · a library, church, or community center · city or civic staff with residents · an organization bringing its members together · I\'ll describe it) — the free-text option matters.',
  '2. Where and when? In person (a hall, a library, a kitchen table), online (a video call), or both; the date or the window they have in mind; the hours (our suggestion: one afternoon, 2–6, with food at the end — four hours is enough for a first build and a share). Ask for the venue name and address if they have one.',
  '3. How many people do you expect? — fewer than 20 · 20–60 · 60–150 (our suggestion when they have a partner with a list) · more than 150. Say in half a line that both ends work and that the agenda and the room will be sized to the answer.',
  '',
  '### Stage 2 — The shape of the day',
  '1. How does building start? — single choice: *Dreams at the mic* — people share what they wish existed, a minute each, teams form around the dreams that get the most nods (our suggestion for a neighborhood day) · *Challenges* — the organizers pose two to five challenges and teams pick one (our suggestion for a city or organization day; ask for the challenges, or offer to draft them from what they said) · *Deliberate, then build* — the room works a question first, lands on common ground and priorities, and builds toward them (our suggestion when a live question already divides or unites the place) · a mix (say which).',
  '2. The agenda — offer the Sunset shape as the default, timed to their hours: doors, coffee, and name tags (15 min) · dreams, challenges, or the deliberation (30–45 min) · teams form (15 min) · an optional walk or break (30 min; the Sunset day walked to the ocean and it was the highlight) · build (90–120 min) · submit-by, then shares and celebration with food (45–60 min) · what\'s after. Single choice: this shape (our suggestion) · shorter, no walk · a full day with lunch · I\'ll describe mine. Say in a line that the host demo — building an app, a flyer, and a plan from one conversation and pinning one to the wall — is a named five-minute block right before teams build.',
  '3. Roles — a "(choose any)" checklist, recommending all but the last: a host on the mic (our suggestion) · someone to give the five-minute demo (our suggestion) · floor helpers who find people a team and unstick a build (our suggestion; one per 15 people) · documenters: photos, names at the mic, quotes (our suggestion; name at least one) · food and coffee (our suggestion) · setup and power strips (our suggestion) · a musician or a closing act · I\'ll add my own. Ask for names where they have them.',
  '4. Rhythm — one-off (our suggestion for a first one) · monthly · seasonal · annual. One line on what the next one inherits (the recap, the unbuilt dreams).',
  '',
  '### Stage 3 — What to make now',
  'Say plainly, in two lines, that the day itself runs on tools that already exist — the room key people scan at the door, Share Live that turns any build into three slides, and the demo wall the room sees at 5 — and that RTP\'s stewards set them up from a short email the Builder drafts. Then one "(choose any)" checklist, recommending the first five:',
  '- the plan document (our suggestion) · the day-of agenda, timed to the minute (our suggestion) · a landing page with an RSVP button (our suggestion) · a printable flyer (our suggestion) · the email to RTP\'s stewards asking for the event code (our suggestion) · a square and story social ad · the host\'s slide deck · an RSVP form on the landing page (only when they have no event page) · a recap page after the day · I\'ll add my own.',
  'Then one question: where will people RSVP? — the platform their people already use (Luma, Eventbrite, Partiful, a Google Form; our suggestion: ask which one and get the link) · an RSVP form on the landing page · no RSVP, just come. Suggest, in a line, a sayable event code from the place (5–9 uppercase letters) and ask if it sounds right; the stewards confirm it.',
  '',
  '### Stage 4 — How it looks: the place decides',
  'The look comes from THIS place, never from the Sunset flyer. The attached flyer, when there is one, shows the anatomy of a build day flyer working — the question as the call-out, the date and place unmissable, the QR hand-off — and nothing more: its dusk photo, its serif, its yellow hand-lettering belong to the Sunset and must not be reproduced. Say that in one line, then establish the aesthetics in two moves:',
  '1. **Ask about the place itself**, in one question with a free-text answer: what does it look like at the hour the day will happen — the light, the colors of the buildings and the land (fog and pastel stucco, red brick and maples, a strip mall and big sky, a river and limestone), the textures (clapboard, tile, chain-link, murals), and the lettering already on the street (the hardware store sign, the taqueria awning, the library\'s carved name, hand-painted signs). Ask too for a photo of the place or a flyer from a local business they love, attached to this chat — one real photo of their own block is worth more than any direction you can offer.',
  '2. **Then offer three genuinely different directions drawn from what they said**, each named for something in their place and each with real hex values and fonts: e.g. for a river town, "limestone and river green" (a photo of the water at dusk, a sturdy slab serif, cream and deep green) · "the hardware store sign" (a bold grotesque in the sign\'s red and white, no photo, a hand-drawn border) · "the bulletin board" (a collage of torn paper and tape, a typewriter face, kraft brown and black). Put the two or three main hex codes in each option\'s text (they render as color swatches on the card) and name the fonts. Single choice plus "I\'ll attach an image". When they attached a photo, draw every direction from it and say in a line what you took from it.',
  'Say that the flyer, the landing page, the social ad, and the slides share this one look, that the plan\'s Look & feel records it as the spec for every artifact, and that a local artist\'s hand-drawn title or a neighbor\'s photo of the place beats anything generated — put that commission or that photo in the plan as a step with a name next to it.',
  '',
  '## Drafting the plan',
  'Once the four stages are answered (or skipped by choice), write the plan in the usual format with these sections: **The vision** (two or three lines in the organizer\'s voice, with the day\'s name and the question it asks) · **People & practices** (the roles with names, how the first twenty people get invited personally, the partners) · **Event brief** (every decision from stages 1–4 as a tidy list of bold labels, exactly these, one per line, so the build and the stewards can read them: **Convened by:** · **Where:** · **When:** · **Format:** in person / online / both · **Expected size:** · **Entry point:** · **Rhythm:** · **RSVP:** the platform and link, or "form on the landing page" · **Event code (suggested):** · **Making now:** the artifacts chosen, in order · **Later:** the artifacts for after) · **The day** (the agenda, timed, with the host demo and the submit-by time named; when the agenda is its own artifact, a summary here and the full flow in `program/agenda.md`) · **Features** — *First build* (the artifacts chosen now, each in a line) and *Later* (the social ad, the deck, the recap page, whatever was not chosen) · **Look & feel** (the place it was drawn from in a line, hex values, fonts, the one distinct idea, the photo or local-artist step; this is the spec every artifact follows, and it owes nothing to the Sunset flyer) · **Pages & files** (the paths, from the frame) · **Logistics** (the checklist with a name next to each line: Wi-Fi, outlets and power strips, projector, mic, tables, signs station, food) · a `PROJECT-NAME: <the day\'s name>` line.',
  '',
  'Credit the lineage in one line: remixed from the Sunset Neighborhood Build-a-thon (Sunset Social Club and the Relational Tech Project) and relationalbuilder.org/buildtogether, through Relational Builder.',
  '',
  'Question format: EXACTLY the heading "## Question for you" followed by a numbered list, 2–4 dash-bullet options under each (up to ten for a "(choose any)" checklist). One to three questions per reply, in the stage order above; it is fine to carry a stage across two replies when a question needs follow-up.',
  '',
  'Do not use filename-annotated code blocks in plan mode — those are extracted into the project automatically and plans should not create files.',
  '',
  'Never open with flattery — jump straight into being useful. Keep every word readable for a first-time organizer: short, concrete, in their words. When the plan is drafted, end by inviting the person to refine it or press **Build this plan** — building makes exactly the artifacts the Event brief chose for now, nothing more, and the rest arrive one at a time as the day gets closer.',
].join('\n');

/**
 * The featured gallery card — the commons entry point for the journey. It
 * rides the `build-day` shelf in the commons (seeded by
 * scripts/seed/build-day-commons.json); this copy is the Builder's own, so
 * the card leads the gallery even before the shelf is seeded or when the
 * commons is unreachable, and its detail reads the same either way.
 */
export const BUILD_DAY_CARD: CommonsItemDetail = {
  id: 'builder:community-build-day',
  slug: BUILD_DAY_CARD_SLUG,
  kind: 'prompt',
  title: 'Community Build Day — plan, run, and share yours',
  summary:
    'Everything a build day organizer needs, from one conversation: the plan and the day-of agenda, a landing page and a printable flyer, a social ad, the note that gets RTP\'s stewards to set up your event code and demo wall, the host\'s slides, and after the day, a recap page made from what the room built. Remixed from the Sunset Neighborhood Build-a-thon: 157 neighbors, 23 dreams at the mic, five projects shown by 5pm.',
  attribution: {
    name: 'Sunset Social Club & the Relational Tech Project',
    neighborhood: 'The Sunset, San Francisco',
    source: 'Sunset Neighborhood Build-a-thon, October 2026',
  },
  // The Sunset, where the first one happened — the card is Nearby there
  location: { lat: 37.7541, lng: -122.4950, label: 'The Sunset, San Francisco, California', precision: 'neighborhood', basis: 'attribution' },
  source_studio_slug: BUILD_DAY_SHELF,
  source_url: SUNSET_RECAP_URL,
  license: 'RCL-1.0',
  tags: ['build day', 'build-a-thon', 'organizing', 'event', 'flyer', 'landing page', 'recap'],
  image_url: BUILD_DAY_CARD_IMAGE,
  body: [
    '**What would make the Sunset feel like home?** That question, on a flyer with a dusk photo of two houses on Judah Street, brought 157 people to Sunset Village Music Hall on a Friday afternoon in October. Twenty-three of them stood at the mic with a dream for the neighborhood — a community event calendar, a map of empty storefronts, a babysitting co-op, a welcome page for new neighbors, an open mic in December. Teams formed around the dreams that got the most nods, everyone walked to the ocean and back, and by 5pm five projects were on the wall, working, with QR codes the room scanned from their seats. Live bands after.',
    '',
    'Press **Build yours** and Relational Builder walks you through four short steps — the place and the people, the shape of the day, what to make now, how it looks — with a suggested answer at every step. Accept all of them and you have a day; change any of them and it becomes yours.',
    '',
    '## What you leave with',
    '',
    '- **The plan and the day-of agenda** — roles with names, the entry point (dreams at the mic, challenges, or deliberate-then-build), logistics with a name next to every line, a two-week countdown.',
    '- **A landing page** with the question as its headline and one RSVP button to wherever your people already sign up (the Sunset day used Luma).',
    '- **A printable flyer** and a square-and-story **social ad**, in the day\'s own look.',
    '- **The email to RTP\'s stewards** that gets your event code minted: the room key people scan at the door, the Event Admin page, Share Live, and the demo wall are already built and come with the code.',
    '- **The host\'s slides**: welcome and Wi-Fi, the agenda, the one question, make teams, submit by 4:50, celebrations, thank you.',
    '- **After the day, a recap page** like the Sunset\'s — the afternoon as it happened, every dream at the mic, what was built by 5pm, the threads, what\'s next — made from your documenters\' photos and the wall.',
    '',
    '## How the Sunset day ran',
    '',
    '2:00 doors, coffee, and pastries · 2:15 dreams on the mic · 2:45 teams form (walk to the dream that pulls you, 2 to 5 per team, dreamers hold their sign high) · 3:00 a walk to the ocean · 3:30 build · 4:50 slides submitted · 5:00 shares, celebration, and dinner · 6:30 live bands. Partners: Sunset Social Club, the Relational Tech Project, Good Neighbor Lab, and local businesses; part of SF Tech Week.',
    '',
    `The event page: ${SUNSET_EVENT_URL} · The recap: ${SUNSET_RECAP_URL} · How build days run on Relational Builder: https://relationalbuilder.org/buildtogether`,
  ].join('\n'),
  metadata: {
    maker: 'Sunset Social Club & the Relational Tech Project',
    hosted_url: 'https://relationalbuilder.org/buildtogether',
    event_url: SUNSET_EVENT_URL,
    recap_url: SUNSET_RECAP_URL,
    plan_stages: ['the place and the people', 'the shape of the day', 'what to make now', 'how it looks'],
    entry_points: ['dreams at the mic', 'challenges', 'deliberate, then build'],
    artifacts: ['plan', 'agenda', 'landing page', 'flyer', 'social ad', 'steward request', 'slides', 'recap page'],
    remix_idea: 'Ask the one question your place is already asking.',
  },
};

/** The card without its body — what the gallery lists */
export const BUILD_DAY_CARD_SUMMARY: CommonsCard = Object.fromEntries(
  Object.entries(BUILD_DAY_CARD).filter(([k]) => k !== 'body' && k !== 'metadata'),
) as CommonsCard;

/**
 * The opening message a build day remix seeds the composer with: the
 * scripted conversation picks it up from here.
 */
export function buildDayOpening(): string {
  return [
    'I want to plan a community build day for my place — a day when neighbors build the tools they need, together — and make what it needs: the plan and the day-of agenda, a landing page, a flyer, the note to RTP\'s stewards for an event code, and after the day, a recap page.',
    '',
    'I\'m starting from the Sunset Neighborhood Build-a-thon (Sunset Social Club and the Relational Tech Project, October 2026). The attached flyer is theirs: a reference for what a build day flyer carries and how the day ran, not for the look. The look and feel should come from my own place — its light, colors, textures, and the lettering already on its streets — and I\'d like to work that out as an explicit step.',
    '',
    'Walk me through the four steps, including the one where we establish the aesthetics from my place.',
  ].join('\n');
}
