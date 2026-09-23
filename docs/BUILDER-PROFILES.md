# Public Builder Profiles — Spec

*September 2026. Status: specced, not built. Decisions the owner needs to make
are marked ⚑.*

## The idea, in one sentence

A builder in RB can make a public page that represents their relational tech
work — the neighborhood, the projects, what they practiced, what they used, what
they dream about — and RB's own builder makes the page, for free, from data RB
already holds.

Humble version: one page per builder, one address, built like any other RB
project, published on Community Hosting, findable by Google.

## What exists today (and what doesn't)

Grounding from the code, so the plan is about the real system:

- **Profile.** `profiles` already has `display_name`, `full_name`,
  `neighborhood`, `neighborhood_description`, `dreams`, `local_tech_ecosystem`,
  `design_system`, `tech_familiarity`, `ai_coding_experience`. RLS lets only
  the owner read the row. `ProfilePage.tsx` says "Your profile stays private to
  you and RTP." That promise stays true; the public page is a separate,
  opt-in copy.
- **No public person page, handle, or vanity slug** anywhere. The nearest
  patterns are `referral_code` (unique per profile), `community_sites.slug`
  (`/s/slug/`), and `/commons/*`, which `api/commons.ts` server-renders with
  full OG tags and JSON-LD. `/commons/*` is the model for a crawlable page.
- **Connections.** `open_to_connecting` is the only visibility flag, and the
  directory it gates is signed-in only. `suggestConnection()` in
  `src/knowledge/connections.ts` picks intro suggestions locally from the
  builder's `connect_note` and `neighborhood`; `ConnectionSuggestion.tsx`
  renders them with name, neighborhood, note, "Book a call", "Request intro".
- **Plan mode.** `PLAN_INSTRUCTIONS` in `context-builder.ts` drives a
  conversation-first plan with `## Question for you` blocks that
  `PlanQuestionCards` renders as option pills. Every "start from" path
  (`start-from-commons.ts`, `start-from-tool.ts`, …) clears the workspace,
  sets `lineage`, sets plan mode, and seeds the composer via
  `setDraftMessage`. That is exactly the shape a profile start needs.
- **Publishing.** `publish-site` writes `community_sites` + `site_files`;
  `site` serves them at `/s/{slug}/` and already injects HTML (feedback widget,
  error beacon) at serve time. **Nothing injects title, description, OG, or
  canonical tags into published sites.** Limits: 10 sites per builder.
- **Usage budget.** `llm-proxy` gates and meters every `x-community-token`
  request against `community_members.weekly_token_budget`. **There is no
  exemption mechanism**; no body flag or header skips metering.
- **Commons loop.** "Drew on the commons" lives only as `commonsRefs` /
  `studioRefs` on chat messages inside `projects.chat`. "Contributed back"
  is recorded nowhere in the Builder database (`submitToCommons` posts to
  the Commons project and forgets).
- **Projects.** `projects` has no description, repo URL, or live URL. Repo
  links live in device-local `sync-store`; live sites in device-local
  `deploy-store`, and server-side `community_sites` is tied to the owner by
  email + name, not project id.

## Design

### 1. The page is a project

The profile page is an ordinary RB project with
`lineage.source = 'builder-profile'`. It goes through plan mode, build mode,
preview, and publish like anything else. That gives the builder full control of
look and content, the AI's help, and no second page engine to maintain.

One per builder. A partial unique index on `projects (owner_id)` where
`lineage->>'source' = 'builder-profile'` enforces it. This single rule does a
lot of work below (abuse posture, site counts, address).

### 2. Content comes from a data file, seeded by RB

At start, RB assembles `/data/profile.json` from what it already knows and
writes it into the project (the existing `data-files.ts` door, so it appears in
the prompt as a shape description with the never-re-output rule):

```json
{
  "name": "…",                    // from display_name / full_name
  "neighborhood": "…",            // from neighborhood
  "about_neighborhood": "…",      // from neighborhood_description
  "dreams": "…",                  // from dreams
  "projects": [                   // from projects + community_sites (+ sync-store repos if on this device)
    { "name": "…", "live_url": "…", "repo_url": "…", "description": "" }
  ],
  "practice_highlights": [],      // written in plan mode
  "technologies": [],             // inferred from project files (package deps, services in env), confirmed in plan
  "ideas": [],                    // written in plan mode
  "commons": { "incorporated": [{ "type": "tool", "count": 2 }], "contributed": [] },
  "sections": ["name","neighborhood","projects","practice","technologies","dreams","ideas","commons"]
}
```

This is the page's own copy. Editing the name here does not touch `profiles`,
which matches the ask ("per profile, edited as needed") and keeps the private
profile private. A **Refresh from RB** action on the project regenerates the
seeded fields and shows a diff before writing.

Data sources, honestly rated:

| Field | Source today | Quality |
|---|---|---|
| name, neighborhood, description, dreams | `profiles` | good |
| projects list | `projects` (name), `community_sites` (live URL) | names yes, live URLs yes, descriptions no |
| repo URLs | `sync-store` (device-local) | best effort; blank on another device |
| technologies | scan project files (`package.json` deps, `/data/` shapes, env keys → service names) | decent, confirm in plan |
| commons incorporated | count `commonsRefs`/`studioRefs` across the builder's `projects.chat` | decent |
| commons contributed | nothing | needs a small new table (below) |
| practice highlights, ideas | nothing | prompted in plan mode |

### 3. Plan mode, tuned for this

A `PROFILE_PLAN_INSTRUCTIONS` variant of `PLAN_INSTRUCTIONS`, chosen when
`lineage.source === 'builder-profile'`. Differences:

- First reply opens with what RB found ("3 projects, 2 live, drew on the
  commons 4 times, no contributions logged yet") and one
  `## Question for you` block whose first question is the section checklist.
  `PlanQuestionCard` is single-select today; add a `(choose any)` marker the
  card renders as multi-select pills. Small change to
  `extractPlanQuestions` and the card.
- Second round prompts for the two written sections (practice highlights,
  ideas) with 2–3 example lines drawn from their projects, so a builder can
  pick, edit, or skip.
- It recommends an aesthetic from `design_system` if set, otherwise offers
  three distinct directions and asks. The instruction is explicit: the page
  should feel like the person, not like a template. The plan document's
  "Look & feel" section already carries hex values and fonts.
- Plan document gets a `Sections` heading listing what is on and off.
  Approval builds as usual.
- Guardrail in the prompt: the page describes real work only; it never
  invents projects, numbers, or neighbors. The data file is the source of truth
  for anything countable.

### 4. Free to build, without opening a hole

Client-declared "this is free" flags are spoofable, so the exemption is keyed
on the project:

- The client sends `project_id` in the proxy body for profile projects.
- `llm-proxy` looks up `projects.id = project_id AND owner_id = user.id AND
  lineage->>'source' = 'builder-profile'`. If true, skip the weekly-budget
  check and record usage with `model` tagged `…:profile` (so stewards can see
  it) but excluded from the budget sum.
- One profile project per builder plus a modest separate cap (⚑ suggest 300
  requests/week on the profile project) bounds the abuse surface. A builder
  could still build something unrelated inside their profile project. The
  system prompt discourages it and the cap limits it; that is acceptable for
  the community plan.
- `publish-site`: a site published from a profile project gets
  `kind = 'profile'` and does not count toward `MAX_SITES_PER_BUILDER`.
  It has no Community Cloud data, so data counts are unaffected.

### 5. Address and SEO

⚑ **Address.** Recommend `relationalbuilder.org/b/{handle}/`. It reads as
"builder", sits beside `/s/` and `/commons/`, and works with the existing
rewrite pattern in `vercel.json`. Subdomains (`{handle}.builders.…`) wait for
`CUSTOM-DOMAINS.md` phase 1.

**Handle.** New `profiles.handle` (unique, lowercase, 3–32 chars, letters,
digits, hyphens, reserved list). Proposed at first publish from
`display_name`, editable once before publish, and stable after (renames
create redirects only if we ever need them; start without). Rows
`community_sites.kind = 'profile'` and `community_sites.handle` link the
site to the person.

**Crawlability.** Generated apps are bundled SPAs; Google does render JS but
previews and snippets do not. So the `site` edge function, which already
rewrites HTML at serve time, injects for `kind = 'profile'`:

- `<title>` and `<meta name="description">` from the data file
  (`name — relational technologist in {neighborhood}`),
- `og:title`, `og:description`, `og:url`, `og:image`, `canonical`,
- JSON-LD `Person` with `name`, `homeLocation`, `url`, and each project as
  `CreativeWork`,
- a `<noscript>` block with the name, neighborhood, and project list as plain
  HTML, so the page has real text before any script runs.

The values come from `/data/profile.json` in `site_files` (the function
already reads files for the slug), so nothing new is stored. Add `/b/*` to a
`sitemap.xml` served by a small `api/sitemap.ts`. A profile can be unpublished
(delete the site) at any time; the handle is kept.

Publishing is the public opt-in. The publish dialog for a profile project
states in one sentence what becomes public (the data file, nothing from the
private profile beyond what was copied) and that search engines will index it.

### 6. Connections

Once a profile site exists, `connect` `directory` selects `profiles.handle`
joined to a live `community_sites` row of `kind = 'profile'`, and returns
`profile_url`. `DirectoryBuilder` gains `profileUrl?`. `ConnectionSuggestion`
and `BuildersDirectory` show "See their builder page". A builder with a public
page but `open_to_connecting = false` still does not appear in the directory;
the two flags stay independent.

Optional later: `suggestConnection()` could also match on the public page's
practice highlights and technologies, which are richer than a 140-character
note. Only for builders who published, since that text is already public.

### 7. Commons contributions, finally recorded

A tiny `commons_contributions` table in the Builder database (`user_id`,
`type`, `title`, `studio_slug`, `submitted_at`), written by
`submitToCommons` on success. Owner-read RLS. That is enough for
"contributed back: 2 tools, 1 story" on the page and is useful beyond this
feature.

### 8. Where the door is

- **Profile page** (`/profile`): a card near the top, below `ReferralCard`,
  "Build your public builder page. Free, made from what's already here,
  public only when you publish." Button → `/new?start=builder-profile`. After
  publish, the card shows the address and Open / Edit / Refresh / Unpublish.
- **Projects page**: the profile project is pinned first with a small
  "Builder page" tag.
- **After a builder's first publish of any site**: one-line nudge in the
  publish success state. Once, dismissible.

## Phases

**Phase 1 — the page exists (MVP).**
Handle column and validation; `start-from-builder-profile.ts` (seed data
file, lineage, plan mode); `PROFILE_PLAN_INSTRUCTIONS` and multi-select
question cards; proxy exemption keyed on project; `publish-site` kind
`profile` and `/b/{handle}/` rewrite; head-tag + noscript injection in `site`;
Profile page CTA. Contributions section reads "none logged yet".

**Phase 2 — the loop closes.**
`commons_contributions`; `profile_url` in directory and suggestions;
Refresh-from-RB with diff; technologies inference from project files.

**Phase 3 — findable.**
Sitemap; OG image generated per profile (reuse `app-icon.ts` palette
approach); optional richer connection matching.

## Decisions needed ⚑

1. `/b/{handle}/` vs waiting for subdomains.
2. Free means "not counted against the weekly budget with its own soft cap"
   (recommended) vs truly unmetered.
3. Whether unpublishing should also release the handle. Recommended: no.

## Non-goals

No profile editor UI outside the builder. No follower counts, endorsements, or
likes. No cross-builder comparison. No profile without a published page; the
page is the profile.
