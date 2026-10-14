/**
 * How Relational Builder builds — the practice distilled for builders who
 * work in their own tools (Claude Code, Cursor, Lovable, a plain chat).
 *
 * The Builder's full system prompt (context-builder.ts) is stack-specific:
 * it teaches the in-browser bundler, the component kit, the edit-block
 * format. None of that travels. What travels is the practice underneath —
 * how a neighborhood tool should be sized, shaped, seeded, and shared — and
 * that is what this file holds, as plain markdown with no stack in it.
 *
 * Served to the world by scripts/export-builder-knowledge.mts as
 * /knowledge/builder-practice.md, which the RT MCP server reads live, so a
 * change here reaches every connected AI tool on the next deploy.
 */

export const BUILDER_PRACTICE_MD = `# How Relational Builder builds

These are the working practices behind Relational Builder (relationalbuilder.org), written for anyone building a neighborhood tool with their own AI and their own stack. Nothing here depends on the Builder. Hand them to whatever you build with.

## What counts as a build

Relational technology comes in all sizes: a web app for community use (an event calendar, a mutual aid board, a civic info hub), a landing page, a printable flyer, an invitation, a plan. Software is one output among several, and often not the first one a project needs.

- **Programs are builds too.** A program plan is a real deliverable: a markdown plan document, an outreach plan, an invitation draft written in the builder's own voice. Many community projects need no software at all. Say so plainly when that is true.
- **Early-stage projects start with the inviting artifacts.** A landing page, a flyer, an invitation, an outreach plan. The first job is neighbors saying yes, not software. The full coordinate-and-login system waits until the project actually needs it.
- **One project holds every artifact** it needs: the app, the landing page, printable materials, written pieces. When the project graduates to its full system, it grows in the same place; the flyer and the plan stay and point at the real thing.
- **Paper is relational tech.** A flyer for the laundromat corkboard, a printed newsletter for neighbors who are not online, a poster for the block party. Build print pieces as standalone HTML pages sized in physical units with a print stylesheet, designed for ink and paper: strong type hierarchy readable from a few feet away, generous margins, high contrast.
- **A flyer has an anatomy.** It gets read in three seconds by someone who was not looking for it, so lay out every flyer in these zones, in this visual order: one main call-out in the biggest type on the page (one flyer, one idea); date, time, and location grouped in a single unmissable block; further info in smaller type (who it is for, cost, what to bring, who is hosting); a hand-off (QR code with the short URL printed beside it, a phone number, a handle, or tear-off tabs); and the group's name or mark near the bottom. Breathing room between zones, never every inch filled.
- **Flyer art: hands before generators.** A flyer wants one strong visual element, not clip art or stock illustration. Invite the person to draw it themselves (marker on paper, photographed with a phone, placed with a multiply blend so the paper disappears) or to commission the drawn elements from an artist or sign painter in their own neighborhood, and put that step in the plan. A drawing in a neighbor's own hand says a real person made this. Type and layout alone, done with care, already make a good flyer; AI-generated art is a draft to react to, never the finished flyer's art.

## The first build: the core loop, alive

The first build's job is to make the person's actual vision visible and usable, the one thing the tool is for, working end to end on seeded data, before any deployment or infrastructure detail enters the picture. It is a draft they react to, not a finished product.

- **Build the core loop completely, then stop.** Identify the single interaction the tool exists for (post and respond, ask and offer, list and claim) and make that whole round trip real. Secondary surfaces (admin dashboards, About pages, settings, analytics, a second board beside the first) wait unless the person named one as the point of the tool. Close by naming what you left out and offering it next.
- **Never shrink the vision to make the build easier, and never build the whole vision in one pass.** Fewer things, each of them complete. What you build is finished and production quality; what you skip is named out loud. A stubbed screen is a failure; an unbuilt screen you offered is good practice.
- **Seed one neighbor, not a cast.** Demo state is a sketch of life. At most one demo person besides the builder, named once and quietly, and a handful of records (three to six) so no screen looks broken. Invented rosters of ten neighbors with bios cost more than every screen combined, and every one of those names gets deleted the day real neighbors arrive.
- **Real records come from the person, never from memory.** When the tool is about real things (addresses, organizations, congregations, events, people), do not invent them and do not type them from memory. Invented records that look official are worse than none. Build against a small, clearly labeled sample and ask for the real data as a file or a live source.
- **Two-sided tools still show both sides.** With the builder and that one demo neighbor, a plain you/them toggle is enough for one person at one laptop to post as themselves, switch, and answer as the neighbor. Feeling both sides in a demo is what makes a relational tool understandable, and it becomes the natural seam for real sign-in later.
- **No external backend in the first build.** Never make the first preview depend on keys or env vars the person has to supply. Persistence and real sign-in are opt-in upgrades offered briefly after the app works. When you do wire a backend, keep the app rendering if config is missing: fall back to seeded data with a small friendly note.
- **Three failure modes, equally bad:** requiring configuration before anything shows, shrinking the dream to what is easy to wire, and building the entire plan at once. Never trade away a relational feature (posting, responding, joining, claiming) because persistence is not connected yet.

## Relational mechanics

These tools exist to connect people: bonding (deepening ties among people who already know each other) and bridging (creating first contact between people who do not). An app where a person can only read is a brochure, not relational tech. Unless the vision is genuinely one-way (a flyer, crisis info that must be zero-friction), every build carries interaction mechanics.

- **Every item carries a person.** Posts, events, offers, and asks show who they are from: a name, initials, a word about them. People connect with people, not with content.
- **Every post opens a path to a person.** A reply, a "count me in", an "I can help", a question. The reader's next tap starts an interaction instead of ending one. No dead-end lists.
- **Pair asks with offers.** Wherever people can request (a ride, a meal, a hand), give equal weight to offering, and make the moment of match visible ("Denise is bringing the ice").
- **Commitments connect two people, not a person and a database.** RSVPs, claims, and signups name who you are joining or helping, and both sides can see it.
- **Show who tends the space.** A visible steward, one line with a name and a face ("Marcus keeps this board, say hi"), not a paragraph of welcome. Trust grows when someone is clearly home.
- **Point off-screen.** The best outcome of a relational tool is people together in person: design toward the porch, the park, the meeting.
- **Name the connection type and design for it.** Bonding wants recurring rhythms, inside language, shared memory. Bridging wants low-stakes first moves, warm introductions, and a host who makes strangers feel expected.
- **Success is interactions, not traffic.** The tool works when two people who would not otherwise have talked, did.
- **Known trap: the resource directory.** Left unsteered, community tools collapse into read-only directories of services and links. When the dream is about people knowing, helping, or gathering with each other, an information display is the failure mode. Build the mechanics above, not one more list of links.
- **Pair the tool with practice.** Name the human practice each mechanic depends on: who welcomes the first-timer, which gathering the tool rides on, how the first ten people get invited personally. The tech makes the practice easier; it never replaces it.

## Easy for a neighbor

These tools get used by people who did not ask for a new app: someone at a bus stop, a grandmother, a kid, a neighbor with thirty seconds. Good design means the tool is obvious in three seconds, not that it is well explained.

- **The first screen is the tool.** On load, the core loop is on screen and usable. No hero section, no marketing headline with two buttons, no welcome banner, no "How it works" page in a first build. A landing page is for strangers who might sign up; a tool is for neighbors who came for one thing.
- **One obvious action.** The single thing a neighbor does here is visible without scrolling and reachable in one tap. Everything else is quieter.
- **Earn every control.** Search fields, filter rails, sort menus, and tabs are for volume that already exists. Twelve items need to be legible on one screen, not a filter sidebar.
- **Known trap: the explainer layer.** A banner explaining the demo data, a badge on every seeded card, a paragraph introducing the steward, helper text restating the label. Each feels kind; stacked, they bury the tool and read as an app that does not trust itself.
- **Known trap: the marketplace template.** Hero plus subhead plus two buttons, left filter rail, three-column card grid, sort dropdown. That is the default shape of every AI-generated directory, and it makes a neighborhood tool look like a startup landing page.
- **Mobile-first and outdoor-readable**, and responsive up, not just down. Base type 16px, contrast at least 4.5:1, touch targets 44px or more. At desktop widths the app becomes a real desktop app, not a stretched phone screen.
- **Finished-feeling details.** A header with the app's name, warm one-sentence empty states, disabled and loading states on buttons that submit. Never framework-blue defaults.

## Personality from the place

Every app should look cared for on first render, and no two should look alike. The look grows from the place and the person, not a template.

- **Resist the default look.** Left unsteered, AI tools produce the same design every time: warm cream background, serif display type, terracotta accent, big soft radius. When every neighborhood tool ships with it, none feels like its place.
- **Commit to one concrete direction per project**, drawn from the fog, the garden, the block, the culture of the neighborhood, what the person says they love. Directions to adapt, not a menu: civic bulletin, copy-shop zine, porch light, botanical, coastal fog, corner store, newsprint.
- **Type carries half the personality.** Load a real display and body pairing and vary it between projects. Never default to Inter, Roboto, Arial, or system fonts.
- **Tokens first.** Define colors as custom properties and use only tokens, so retheming later is a values-only edit.
- **Photos and artwork, in this order:** the builder's own photos of their actual street, garden, and people first; local artists and designers for anything that cannot be photographed (flyer art, a logo, a mascot, hand-lettering), commissioned or bought in the neighborhood and named as a step in the plan; clearly marked image slots when nothing is in hand yet; AI-generated imagery last, for drafts and placeholders, and never faces or photo-real pictures of real places.
- **Visual guidance is gold.** On a first build, invite the person once to share a screenshot of something they love, local art, or a photo of their place, and reshape the design around it. When they do, treat the image as the brief.

## Working with the person

- **Plan before building when the idea is still forming.** Explore directions, ask one good question at a time, and agree on what "the build" is (a program plan, printable materials, software, or a mix) before producing it.
- **A plan is a map, not a checklist to clear in one reply.** The plan's first-build list is the brief for this build; its later list is not. Its look and feel, first screen, and people-and-practices sections bind as hard as its feature list.
- **Talk about what the person will see, print, and hand out, not the machinery.** Plain language by default. Keep terms like component, state, route, and refactor out of prose unless the person used them first. When something technical needs their action, say exactly what to do.
- **Never open with flattery.** Jump straight into being useful. A collaborator, not a cheerleader.
- **Copy changes are sacred and surgical.** When the person gives replacement wording, change exactly that text and nothing else, verbatim.
- **Credit the commons.** When a build draws on a recipe, pattern, tool, or example from the commons, name it and its source. Lineage travels with the build: in the README, in the app's footer or about page, and in the plan.
- **Hand the tool back to its people.** Once the design settles, offer a simple passcode-protected admin page where the organizer edits the core copy and swaps images without coming back to an AI chat. The builder should not need you to change a sentence.
- **Close the loop.** Share the tool with one neighbor this week, ask three specific questions, and watch what happens. Then share what you learned back to the commons so the next neighborhood starts further along.
`;
