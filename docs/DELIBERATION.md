# Neighborhood deliberation in the Builder

*Experimental — living on `claude/neighborhood-deliberation-integration-8qf8s8`
until it's proven in the field.*

Deliberation tech joins the Builder three ways: a **new entry point** for
neighborhoods that arrive with a question rather than an app idea, a **new
gallery shelf** of deliberative tools that can be remixed and localized like
everything else in the commons, and a **new frame** that makes deliberation
builds produce the whole kit — software, facilitation agenda, outreach plan,
printable flyer — with results that can travel.

## The pieces

| Piece | Where | What it does |
|---|---|---|
| Registry | `src/knowledge/delib-tools.ts` | Code-defined shelf: 7 featured tools with full attribution, stages, stories, interop edges; the 17 remaining Metagov gallery tools by name; starting tensions; the prompt digest |
| Frame | `src/knowledge/frames.ts` (`DELIBERATIVE_FRAME`) | Tension-first design, stage hand-offs, facilitation guardrails, honest-signal caveats, the four-output kit contract, flatfile exports, attribution norms — plus the tools digest. Sensed from deliberation-shaped asks (`DELIBERATION_ASK`) and stamped by both start flows |
| Entry point | `src/components/DeliberationStudio.tsx` at `/deliberate` | Question → tension (suggested, never imposed) → stages → optional pattern → an editable Plan-mode draft. Reached from "or start from · a neighborhood question" and the gallery shelf banner |
| Gallery shelf | `src/components/CommonsGallery.tsx` (`Deliberative tools` category) | Screenshot cards with builders named; detail dialogs with makers, curators, stages, field stories with sources, and interop edges; the "More in the Metagov gallery" strip |
| Start flows | `src/project/start-from-delib-tool.ts` | `startFromDelibTool` (grow a named tool's pattern) and `startDeliberationKit` (the Studio's hand-off) — both stamp the deliberative frame into lineage |
| Screenshots | `public/delib/*.jpg` | Captured 2026-08 from each tool's public site; they remain the makers' work, shown catalog-style |

## Attribution, and where it came from

The shelf's source collection is **Metagov's Deliberative Tools Gallery**
(metagov.org/delib-tools), curated by the **Interoperable Deliberative
Tools** project (metagov.org/projects/interop — Liz Barry, Aviv Ovadya, Amy
Zhang, Joshua Tan, Eugene Leventhal; interop repo MIT, github.com/metagov/interop).
Stage taxonomy and the stages of gallery-listed tools are theirs verbatim.
Their interop practice — publish results as flatfiles (JSON/JSON-LD/CSV) so
tools can hand off to each other — is written into the deliberative frame as
a requirement on generated tools.

Featured-tool facts were verified against: compdemocracy.org and
github.com/compdemocracy/polis (Pol.is, AGPL-3.0, vTaiwan);
theflyer.org + metagov.org/people/humphrey-obuobi (The Flyer, North Oakland);
ai.objectives.institute/talk-to-the-city + github.com/AIObjectives (Talk to
the City team and deployments); decidim.org (Decidim); 
github.com/codeforboston/maple (MAPLE, MIT);
github.com/Heard-Platform/heard (Heard, MIT — "a participatory survey
platform inspired by Polis, vTaiwan, and Participativo Brazil");
Central Oregonian (2026-05-21) and KTVZ (2026-04-01) for the CivicOS /
Bloom Project Central Oregon civic assembly story.

**Still to confirm with the builders** (marked with `attributionNote` in the
registry, and flagged on their cards): Heard's builder credit beyond "Alex
and the Heard team". Field picks' stage mappings are ours, not Metagov's —
the detail dialogs say so. (Hear The Room was in the first cut and is set
aside for now — restorable from git history if it returns.)

## What a deliberation build produces

The frame's contract, honored by the existing multi-output pipeline (no new
plumbing): the app itself, `program/agenda.md` (timeboxed facilitation agenda
with the tension and prompts written in), `program/outreach.md`, and
`materials/flyer.html` (standalone printable, QR-ready, own preview tab).
Programs without software are valid deliberation builds. Every generated tool
should expose "Export results" as JSON/CSV.

## Follow-ups this branch doesn't attempt

- **Stories into the commons DB** — the field stories live in the registry
  and render in detail dialogs; submitting them as commons items (so
  retrieval finds them) is a Studio-side ingestion decision.
- **Registry → commons schema** — when the multi-tenant studios schema
  lands, entries can migrate to a live shelf with the same lineage fields.
- **The federating corpus** — the Deliberation Studio grant's bigger arc
  (agendas other localities submitted, remixed per place; cross-locality
  pattern surfacing with consent) needs the commons write path first.
- **Peer-matching of hosts** by theme/geography, and advisor/coaching
  hand-offs.
