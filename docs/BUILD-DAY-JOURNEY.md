# Community Build Day — the organizer's journey in the Builder

*Written 2026-10-14, after the Sunset Neighborhood Build-a-thon (Oct 9).*

Relational Builder helps a build day organizer get the day **planned,
executed, run, documented, and shared** from one Community Build Day
project. The public page lives on the RTP site at
`relationaltechproject.org/build-days` (the Builder's old `/buildtogether`
and `/buildathon` addresses redirect there); the Builder's door is
`/buildday` (and the featured card at the top of the Commons Gallery).

## Where it lives

| Piece | File |
|---|---|
| The frame, the four-stage plan conversation, the featured card | `src/knowledge/build-day.ts` |
| Frame registration, detection from the ask, gallery stamping | `src/knowledge/frames.ts` |
| Plan-instruction swap while the project has no files | `src/knowledge/context-builder.ts` |
| The featured card in the gallery (leads "Everything", own "Build days" shelf) | `src/components/CommonsGallery.tsx`, `src/knowledge/commons-items.ts` |
| The `/buildday` address | `src/router.ts`, `src/store/ui-store.ts`, `src/project/start-build-day.ts` |
| The remix opening (what the composer is seeded with) | `src/project/start-from-commons.ts` |
| The steward notice to humans@ on plan approval | `src/report/build-day-notice.ts`, `supabase/functions/build-day-notice/` |
| The commons shelf seed | `scripts/seed/build-day-commons.json` (`node scripts/seed-commons-shelf.mjs … --apply`) |
| The flyer the card shows | `public/media/commons/sunset-build-a-thon.webp` |
| The public page's CTAs and journey section | the `rtp-main-site` repo (`/build-days`); redirects in `vercel.json` and `src/components/Landing.tsx` |

## The journey, stage by stage

**Planned.** The scripted conversation (four steps: the place and the
people · the shape of the day · what to make now · how it looks) ends in a
plan with an **Event brief** — bold-labelled lines (Convened by, Where,
When, Format, Expected size, Entry point, Rhythm, RSVP, Event code
(suggested), Making now, Later). Builds read the brief; so does the steward
notice. Artifacts: `program/plan.md`, `program/agenda.md`.

Three entry points the plan chooses between: deliberate then build,
challenges in teams, dreams at the mic (the Sunset's). The host demo
(an app, a flyer, a plan from one conversation, pinned with Share Live)
is a named block. Wi-Fi, outlets, documenters, size, and rhythm are in
the frame as practice.

**Executed.** `index.html` (landing page, RSVP button to the platform the
community already uses — Luma for the Sunset), `materials/flyer.html`,
`materials/social.html` (square + story), `materials/slides.html` (the
host's deck, distilled from the Sunset deck), and
`program/steward-request.md`: the email to humans@relationaltechproject.org
with the event name, date, expected size, a suggested event code,
organizer emails, and links. That email is how the stewards mint the code.

**Run.** Nothing to build. The room key, Event Admin, Share Live, and the
demo wall already exist; the frame describes them so the agenda names
them and the plan never tries to rebuild them.

**Documented and shared.** `recap/index.html`, remixed from
dearcrisis.com/buildathon's anatomy (hero with stat tiles, the afternoon
as it happened, at the mic, built by 5pm, threads, what's next, thanks)
to the day's own photos and the wall's projects.

## The notice to humans@

`noticeBuildDayPlan()` fires from both Build-button paths (the button and a
typed approval). It requires all three: the `build-day` frame in lineage,
no files yet, and an approved plan carrying both `PROJECT-NAME:` and an
**Event brief** heading. This is stricter than the gathering-fund cheer
was; that cheer now also requires its **Program brief**, after two false
positives from a frame sensed on a loose phrase. The edge function
`build-day-notice` (deployed, `verify_jwt: false`) emails
humans@relationaltechproject.org (override with `BUILD_DAY_NOTICE_EMAILS`),
using the project's `RESEND_API_KEY`.

## Detection

The frame is stamped by the featured card (studio slug `build-day`) or by
the ask itself (`BUILD_DAY_ASK`: build day, build-a-thon, build jam,
community/neighborhood hackathon, "a day where neighbors build"). Never
from retrieval alone.
