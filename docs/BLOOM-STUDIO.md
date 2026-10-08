# BLOOM Studio

The `bloom` studio (gated; label "Bloom Studio" in the KB `studios` table) is
set up as shared infrastructure for BLOOM Project's civic hosts: one program,
stewarded by BLOOM, where each host builds its own poll-to-report kit from
BLOOM's shelf and offers the result back for the next host. It runs the
ordinary gated studio remix loop from `docs/STUDIOS.md`; this doc covers what
is BLOOM-specific.

## What was seeded

`scripts/seed/bloom-studio-library.json`, written with
`scripts/seed-studio-library.mjs`. Every item carries attribution
"BLOOM Project", the tag `draft-for-bloom-review`, and a summary that starts
"Draft for BLOOM to edit:", so nobody mistakes our draft for BLOOM's words.

| Kind | Title | Notes |
|---|---|---|
| principle | Civic host led engagement | Rahmin's civic-host model and the national cohort |
| principle | Map the opinion landscape first, then deliberate on tradeoffs | Rahmin's words on Open Poll, tradeoffs, supermajority synthesis |
| principle | A backbone effort keeps organizing | Rahmin's "backbone question" |
| principle | "In partnership with BLOOM" on derived materials | Rahmin's attribution ask |
| tool | Open Poll | What the name says, plus what the Central Oregon report shows |
| tool | Community conversation transcription | Same |
| tool | Table themer | Same; notes BLOOM's admin interfaces exist without describing them |
| tool | Reporting and insights layer | The five-step report; the export placeholder |
| story | Central Oregon AI: what 400+ people had to say | Numbers read off the report screenshots |
| prompt | Neighborhood deliberation kit | "Build with this" yields the four-output kit |
| example | Sunset Schools Deliberation | `remix_of` the kit; screenshot in the `studio-library` bucket; url is the GitHub repo |

Images: the Open Poll card uses a capture of the live poll
(all.bloomproject.us/contribute); the report, story, themer, and kit cards
use screenshots of the Central Oregon report. All live in the
`studio-library` bucket under `bloom/`. A card's image also rides into
"Build with this" as the visual reference, so the kit shows the consensus
view and the Open Poll shows the vote screen. No CivicOS imagery exists on
the public web as of Oct 2026, so the transcription tool has no image.

Facts in the tools and story items come from Rahmin's messages and the
report at report.bloomproject.us/central-oregon-ai. Nothing about BLOOM's
tools beyond their names and what the report makes visible was invented.
The "Export results" shape in the kit and the frame is a placeholder until
Humphrey shares the real schema, and says so in the generated UI.

Re-seeding is idempotent (matched on kind + title):

```
SUPABASE_ACCESS_TOKEN=… SUPABASE_PROJECT_REF=… \
  node scripts/seed-studio-library.mjs scripts/seed/bloom-studio-library.json
```

## What the studio frame carries

`src/knowledge/studio-context.ts` has a builtin `bloom` entry: BLOOM's
appended principles (a prose version of the four seeded principles plus
guardrails), `frames: ['deliberative']`, and `partnerCredit: "In partnership
with BLOOM"`.

- **Deliberative frame.** `DELIBERATIVE_FRAME` in `src/knowledge/frames.ts`
  is ported from the neighborhood-deliberation branch: the frame and the kit
  contract only (no tools registry digest, no `/deliberate` page). It adds a
  "demo-friendly out of the box" rule (every generated tool ships a labeled
  sample dataset so a host can walk poll to report in two minutes) and the
  export placeholder shape. It layers into context for approved BLOOM members
  on every turn (`ChatPanel`), is stamped into lineage when a member starts
  from a BLOOM shelf item, and is also sensed from deliberation-shaped asks.
- **Partnership credit.** Shelf cards and detail dialogs for BLOOM items show
  "In partnership with BLOOM". The principle and the frame ask generated
  materials to carry it too.
- **Lineage chain.** Cards and dialogs walk `remix_of` and print the chain:
  "Mission Neighbors Deliberation, remix of Sunset Schools Deliberation, from
  the Neighborhood deliberation kit" (`src/knowledge/studio-lineage.ts`).
- **Cohort tab.** Studio admin page → Cohort: one row per member and
  studio-framed build, with place, what they built, which shelf item it grew
  from, the published `/s/` link, and pending offers. Backed by the
  `studio_cohort(p_slug)` definer RPC
  (`supabase/migrations/20261008090000_studio_cohort.sql`, admin-only).
- **The door.** A signed-in builder arriving through `/?studio=bloom` now
  files a join request on the spot (pending for a gated studio) and sees
  "Your request to join Bloom Studio is waiting for a Studio Admin" in the
  gallery. Before this, the deep link only switched the frame and the person
  had to find "Build here" on their profile.

## The deliberation shelf in the commons

The experimental deliberation branch's registry (Metagov's Deliberative
Tools Gallery picks plus RTP field picks) now lives in the RT Commons as the
`deliberation` shelf: `scripts/seed/deliberation-commons.json`, 20 items
(frameworks for the eight stages and the starting tensions, the interop
flatfile practice, the four-output kit, facilitation guardrails, seven
tools, three starter prompts, four field stories, the Metagov gallery
reference). Seeded with `seed-commons-shelf.mjs --apply` and embedded, so
retrieval surfaces them for any deliberation-shaped ask, for anyone.

For BLOOM members the shelf is also pinned onto the Bloom Gallery
(`studioCommonsPins` in `src/knowledge/studio-context.ts`): the cards sit
under the studio's own shelf, keep their commons lineage and attribution,
and "Build with this" on them stamps the deliberative frame. So a host's
deliberation build draws on the deliberation shelf, BLOOM's principles, and
the Bloom shelf together. The shelf also has its own "Deliberation" category
in the Commons Gallery.

Two items on it deserve BLOOM's eye: the CivicOS tool card (written from
Rahmin's messages and the Central Oregon report, with the live poll's
screenshot) and the Central Oregon story. Heard's builder credit is still
flagged "to confirm" from the branch.

## Demo accounts and the walkthrough

`scripts/demo/bloom-demo.mjs` keeps two test accounts, both plus-addresses on
the steward's inbox so magic-link codes are readable during a demo:

- `joshuanesbit+missionhost@gmail.com`: "Mission host (demo)", place "Mission
  District, San Francisco", a civic host member. Starts the loop outside the
  studio.
- `joshuanesbit+bloomadmin@gmail.com`: "BLOOM admin (demo)", a Studio Admin
  of Bloom Studio (role `admin`, approved).

Both are approved for sign-in and on the community plan (`community_members`,
5M weekly tokens) so builds need no API key.

```
node scripts/demo/bloom-demo.mjs setup    # accounts, profiles, admin seat, then reset
node scripts/demo/bloom-demo.mjs reset    # host back to "not a member", offers/projects/sites cleared
node scripts/demo/bloom-demo.mjs status   # members and the shelf, lineage and draft tags marked
node scripts/demo/bloom-demo.mjs link <email> [origin]   # one-time sign-in URL (service key only)
```

Data goes through the Management API (`SUPABASE_ACCESS_TOKEN` +
`SUPABASE_PROJECT_REF`); `link` and first-time user creation need
`BUILDER_SUPABASE_URL` + `BUILDER_SERVICE_ROLE_KEY`. Run `reset` before each
demo.

### The loop, as a checklist

Two browsers (or one normal, one private window). The whole run with real
generation takes about ten minutes; the plan and build steps are the long
ones.

1. **Host:** open `/?studio=bloom`, sign in as the Mission host. The gallery
   shows "Your request to join Bloom Studio is waiting for a Studio Admin."
2. **Admin:** sign in as the BLOOM admin, account menu → Studio admin →
   Members → "Waiting at the door" → Approve. Cohort tab shows the host with
   their place and nothing built yet.
3. **Host:** reload the gallery. The Bloom Gallery tab appears with BLOOM's
   principles live and the shelf. On "Neighborhood deliberation kit", press
   **Build with this**. Plan mode opens with the kit prompt as the draft.
4. **Host:** fill the bracketed lines for the Mission (host, place, question,
   who is heard, decision-maker, backbone) and send. The plan comes back
   framed by BLOOM's principles and the deliberative frame; the lineage
   records `studioItemId` (the kit) and `frames: ['deliberative']`.
5. **Host:** **Build this plan**. Expect the app plus `program/agenda.md`,
   `program/outreach.md`, `materials/flyer.html`, each in its own preview tab.
   The app should open on sample data with an Export results button.
6. **Host:** Share → Publish → "Publish to community hosting". Then, in the
   same dialog, "Share it to the Bloom Studio gallery": one-line summary, the
   consent box, **Offer to Bloom Studio**. The lineage note says it is a
   remix of the kit.
7. **Admin:** Studio admin → Library → "Offered by members" → **Approve**.
   Cohort tab now shows the build, "grew from Neighborhood deliberation kit",
   and the `/s/` link.
8. **Anyone in the studio:** Gallery → Bloom Gallery. The new card reads
   "<name>, remix of … from the Neighborhood deliberation kit" with "In
   partnership with BLOOM"; Details shows the same chain.

A headless Playwright version of the same steps was run before the demo
(Oct 8). Steps 1 to 4 ran live, including a real plan reply framed by
BLOOM's principles; steps 5 to 8 ran with a pre-generated Mission kit
written into the project in place of the build, because live generation
hung twice behind the sandbox's proxy (it completed once in 51s). The
publish, offer, approve, cohort, and lineage steps all passed on that run.
The script is not committed: it depends on a local Playwright install and
the service key.

## Handing Studio Admin to BLOOM

Studio Admin is granted by a steward, never self-assigned.

1. Rahmin (and Humphrey, if BLOOM wants two seats) need Builder accounts
   first: send them `/?studio=bloom`. Without an account, the landing page's
   request form carries the studio; approve the account request on the
   Steward page and their join request is already waiting at BLOOM's door.
2. Steward page → Studio access → Bloom Studio → grant Studio Admin by email.
   This also approves their membership. (Under the hood:
   `admin-requests` → `studio_admin_set`.)
3. Once BLOOM holds the seat, Josh and Deb can stay as admins or drop to
   members; the steward role on the Builder is separate and unchanged.
4. BLOOM admins then run the door and the shelf: approve hosts, approve
   offers, edit or delete any seeded item, and share chosen items beyond the
   studio (per item: visible to all builders, optionally into the RT Commons
   queue).

## Removing the draft tag once BLOOM approves items

Per item, in the app: Studio admin → Library → pencil → edit the tags and the
summary (drop the "Draft for BLOOM to edit:" prefix). Or all at once, through
the Management API SQL endpoint, once BLOOM has signed off:

```sql
update public.studio_library_items
set tags = array_remove(tags, 'draft-for-bloom-review'),
    summary = regexp_replace(summary, '^Draft for BLOOM to edit:\s*', '')
where studio_slug = 'bloom';
```

Then edit `scripts/seed/bloom-studio-library.json` to match, so a re-seed
does not put the tag back. Items BLOOM rewrites in the app are matched on
kind + title by the seeder, so retitled items would be re-created from the
JSON; update the JSON first or stop re-seeding once BLOOM owns the shelf.

## What is fragile

- **The seeded text is ours, not BLOOM's.** It leans on Rahmin's messages
  and the Central Oregon report. Say so in the demo; the draft tag is there
  for that reason.
- **Generation is live.** Plan and build run through the community plan on
  the llm-proxy. If the proxy or the model is slow, the demo stalls at step
  4 or 5. Fallback: have a project already built and published by the host
  before the meeting, and start the live demo at step 6 (share, approve,
  lineage), which needs no model calls.
- **The export shape is a placeholder.** Until Humphrey shares a schema the
  JSON/CSV the kit produces is our guess at the report's shape
  (participants, opinion groups, consensus with percent agree by group,
  themes with statements and quotes).
- **Cohort "Published" is matched by owner email and site name.**
  `community_sites` has no project id, so a project published under a
  different name shows "not yet".
- **The deep-link join lands only after sign-in completes.** A host who
  opens `/?studio=bloom` signed out gets the request filed through the
  account request path (existing behavior); signed in, the request is filed
  when memberships load. Reload the gallery if the waiting note is not there.
- **Test accounts are plus-addresses on Josh's Gmail.** Magic-link codes
  for both land in his inbox. Signing in as both in one browser needs a
  private window for the second.
- **The builtin BLOOM studio config lives in code**
  (`studio-context.ts`), not in the KB `studios` row, so changing BLOOM's
  appended principles or credit line is a deploy. The four seeded principle
  items are editable in the app and ride in the prompt independently.
