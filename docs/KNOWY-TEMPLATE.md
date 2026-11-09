# Knowy in the commons

*Written 2026-11-09. Source brief: "Knowy into the RB commons: brief for Claude Code".*

Knowy Plover (knowy.org) is the Outer Sunset's neighborhood agent: AI for a
place, stewarded by neighbors. Its code is `neighborhood-agent` (MIT), its
notes are `outer-sunset` (CC BY 4.0). The Builder already reads it as a place
pack ([PLACE-PACKS.md](./PLACE-PACKS.md)). This is the other direction: Knowy
as something any place can remix from the gallery.

## What is in this repo

- **Two gallery entries**, drafted in `scripts/seed/local-civic-tech-commons.json`
  (the Local Civic Tech shelf):
  - `knowy` (tool): what it is, the five rules, the stewarding practice, the
    scales it serves, and the two ways to make your own.
  - `build-knowy-for-your-place` (prompt): the template. Plan mode asks about
    the place and its edges, the first stewards, what it may read, its
    more-than-human neighbors and their advocates, its name and voice, and who
    can see it, then builds.
- **Screenshots** in `public/media/commons/knowy-*.jpg`, taken from knowy.org
  on 2026-11-09 (home, phone, About, Sources). No steward or neighbor is named
  in any of them.
- **Places** for both slugs in `scripts/geotag/places.json` (Outer Sunset).
- **One Builder change** (`src/project/start-from-commons.ts`): a prompt card
  now seeds Plan mode with its whole body. Before, it seeded the summary and
  left the body to retrieval, which carries at most 1,400 characters and only
  when it ranks. A prompt written to ask a new place its questions never got
  to ask them. This changes every prompt card on every shelf, for the better.

Nothing is live until a steward applies the seed:

```bash
node scripts/seed-commons-shelf.mjs scripts/seed/local-civic-tech-commons.json          # dry run
node scripts/seed-commons-shelf.mjs scripts/seed/local-civic-tech-commons.json --apply  # steward only
node scripts/geotag/geocode.mjs && node scripts/geotag/apply.mjs                        # the pins
```

The screenshots are served from `relationalbuilder.org/media/commons/`, so
merge and deploy before applying, or the card shows a broken image.

## What a Knowy built in the Builder is

A lighter Knowy with the same constitution. The place's notes are plain files
in the project, in the shape `neighborhood-agent` reads (`place.md`,
`STEWARDS.md`, `sources.yml`, `people.yml`, `constituents/`, `events/`,
`corrections/`, `proposals/`). The page answers from them through the managed
`ai_chat` capability, cites, says "I don't know", and drafts changes for a
steward instead of making them.

What it does not have: live tool use (`ai_chat` is one completion, no tools),
pull requests opened by a GitHub App, per-source adapters, the place pack and
MCP door. The prompt tells the model to say so. Because the notes keep the
same shape, a place that outgrows the light version can point the full agent
at them.

`ai_chat` serves Anthropic, OpenAI or Gemini keys, or the community plan. It
has no open-weight option today, so "runs on an open-weight model" is true of
the full agent (once `neighborhood-agent` has its provider setting) and not of
a Knowy built here. Closing that means an OpenAI-compatible service in
`app-capabilities`, which is its own decision.

## How the commons takes things in (as found in the code)

- **`.reltech.yml`**: the spec is `watcher/reltech-manifest-spec.md`, version
  2: `version`, `project` (name, description, neighborhood, builder),
  `lineage` (remixed_from, remixed_from_url, creator, note), `tags`, `watch`,
  `preferences`, `interests`. The Builder writes it in
  `src/project/export.ts` and adds three things the spec does not document:
  lineage keys (`grown_from_prompt`, `grown_from_prompt_id`, `studio`,
  `studio_name`), a `prompt:` block (`title`, `body`), and a `place:` block
  (`src/project/place.ts`).
- **Nothing reads the `prompt:` block back.** The watcher does not parse it
  and the Builder does not import it. A prompt in a repo's manifest travels
  with the code but does not reach the gallery or Plan mode. The gallery entry
  is what does that.
- **The watcher** finds public repos with the `relational-tech` topic twice a
  day and writes the directory and feed. It reads the manifest fields above.
- **The gallery** reads `commons_items` (the RTP site's Supabase project) one
  fixed shelf at a time by `source_studio_slug`, plus a Contributed shelf for
  anything tagged `relational-builder`. Item shape: `slug`, `kind`
  (methodology, framework, recipe, reference, tool, story, prompt), `title`,
  `summary`, `body` (Markdown), `attribution`, `source_url`, `tags`,
  `image_urls`, `metadata` (the card image is `metadata.image_url`, the pin is
  `metadata.location`), `license`, `sort_order`. Slugs are unique across the
  whole table.
- **"Build with this"** (`start-from-commons.ts`) opens a fresh workspace in
  Plan mode with a drafted first message, the card image attached, and
  lineage recorded. Studio tools go a different way (`start-from-tool.ts`):
  the repo is distilled into a prompt once and cached.
- **The contribution queue** is the commons' `submit-contribution` function
  (`src/project/commons-submit.ts`): `contribution_type` (tool, program,
  story, reference, prompt), `title`, `summary`, `body` (20k characters),
  `builder_name`, `neighborhood`, `contact_email`, `source_url`, `tags` (8),
  `images` (4), `location`, `builder_confirmed`. It lands as pending; a
  steward approves; it is credited by name.

## The contribution, drafted for Josh to send

Use this or the seed, not both, or the gallery shows Knowy twice. The seed
puts it on the Local Civic Tech shelf with its prompt beside it. The queue
puts it on Contributed, credited to whoever submits.

- **Type:** tool
- **Title:** Knowy: An AI Agent for a Place
- **Summary:** AI that belongs to a place, not a person. Neighbors ask it
  anything, it answers from public neighborhood notes with sources, and every
  change it drafts waits for a steward. First home: the Outer Sunset, San
  Francisco.
- **Body:** the `knowy` item's body in the seed file.
- **Builder name:** Relational Technology Project with Outer Sunset neighbors
- **Neighborhood:** Outer Sunset, San Francisco
- **Source:** https://github.com/The-Relational-Technology-Project/neighborhood-agent
- **Tags:** neighborhood-agent, stewardship, place-based-ai, open-source
- **Images:** the four in `public/media/commons/`

## Still to do, outside this repo

From the brief, all in `neighborhood-agent` unless noted:

1. `docs/commons-notes.md` (the section above is the content).
2. `.reltech.yml`, `template/` generalized from `fixtures/elsewhere/`,
   `docs/STEWARDING.md`, and the `relational-tech` topic. Copy the build
   prompt from the seed's `build-knowy-for-your-place` body so there is one
   wording.
3. The provider setting for an OpenAI-compatible endpoint, and
   `docs/golden-results.md` on Claude and one open-weight model.
4. The house remix through the Builder, with `docs/remix-notes.md`. Needs the
   name, the housemates' yes, and what it should know.
5. `docs/REMIX.md`.
