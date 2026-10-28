# Human-scale branch: technical brief for Claude Code

Context for setting up an experimental branch of Relational Builder that
operationalizes Mozilla's Human-Scale AI principles. Source: Josh's brief of
2026-10-22 (a Claude Doc); this is the committed copy. The brief is the
authority; README.md in this folder is how it maps onto the repo.

## Goal

Set up an experimental `human-scale` branch of Relational Builder (repo:
`the-relational-technology-project/relational-builder`) that starts making RB
itself human-scale AI: a builder for neighborhood tools, built with neighbors,
that runs on open models communities can host and makes apps that are small,
local and owned by the people who use them.

The branch backs an application to the Mozilla Foundation Human-Scale AI
Incubator, due Nov 20, 2026. The application needs evidence, not promises, so
every workstream below should produce something we can show or measure by
then. Nothing here is a product commitment; it's an experiment we report on
honestly.

Background reading, in priority order: Gebru's "Frugal AI" (bounded tasks, not
chatbots), Bendor et al. "Small AI: A Degrowth Imaginary" (five design
directions), Green Web Foundation's "State of the Fossil-Free Internet 2026"
(sufficiency, footprint), Hooker's "On the Slow Death of Scaling" (small
models are capable), and the Hugging Face SLM overview (what runs where).

## Principles, each tied to a behavior

Every principle below maps to something RB does, not something it says.

| Principle (source) | What RB does on this branch |
|---|---|
| Sized to the problem (Mozilla; Hooker) | The builder picks the smallest model that passes the build task, and says which one it used |
| Bounded jobs, not chatbots (Gebru) | Built apps expose named functions (summarize this, match these, resurface that) rather than an open prompt box by default |
| Keep the record checkable (Gebru; AlphaFold talk) | Any AI-generated text in a built app links to the source notes or recording it came from |
| Local and community-held (Bendor et al.; Manzini) | Built apps can run on an open-weight model on a community box or the user's device, with the hosted model as a fallback, not the default |
| Data sovereignty (Te Hiku precedent) | Export is one click, complete and in open formats; delete is real; nothing trains anything without an explicit opt-in |
| Footprint visible (Green Web; Bendor et al.) | Each build and each app shows model, parameter count, where it ran and an energy estimate |
| Plurality, not scale (Open Future; Manzini) | Templates carry a place and a community in their metadata; remix is the verb, not deploy |
| Tools that strengthen ties (Illich via Bendor et al.) | Every template includes the human practice around it (who stewards it, when people meet), not just the software |
| Whose voice (Rebeiz) | Apps that hold shared memory show who contributed what, so stewards can see imbalance |

## Workstreams

Start by reading the repo's existing bench reports, roadmap docs and model
configuration so this builds on what's there. Then, in rough priority order:

**1. Builder/runtime split.** Make the distinction explicit in code and
config: the model that helps write an app (builder) vs. the model the app
calls at runtime. Today both default to Opus, Fable or Sonnet. Add a runtime
model setting per project with an open-weight, community-hostable option
(Ollama or llama.cpp against a 1 to 8B model such as Qwen or Gemma, as a first
pass). Hosted frontier models remain available as an explicit choice, never
the silent default.

**2. Open-weight builder benchmark.** Extend the existing bench harness to run
RB's real build tasks (take 10 to 20 representative builds from the commons)
against two or three open-weight coding models we could realistically host,
compared with Opus on the same tasks. Report pass rate, retries, cost and wall
time, honestly. Also test whether a smaller model plus the commons patterns
(retrieval over the 500+ items) closes the gap. Output: a bench report in the
repo, in the format the existing reports use.

**3. Footprint and provenance.** Record model, parameter count, host and token
counts for every build and every runtime call. Estimate energy using a simple
public method (Green Web's CO2.js or an AI Energy Score style estimate) and
show it in the build report and in a small footer on built apps. Start simple
and label estimates as estimates.

**4. Export and delete.** One action exports a project completely (app, data,
content, config) in open formats. Delete removes it. Verify both with a test,
not a promise.

**5. Human-scale defaults for built apps.** Update the kickoff and template
scaffolding so new apps default to: bounded functions rather than an open
prompt, source links on generated text, contributor attribution on shared
content, and a place and community field in template metadata. Keep the
full-system demo path available but not default.

**6. Anchor adapters (placeholders).** Thin, clearly labeled interfaces showing
how RB would plug into the Mozilla anchor projects, with no fake integration:

- a `memory` adapter interface shaped like Family Intelligence's approach
  (encrypted local store, people/events/places graph, export anytime), with a
  stub implementation
- a `compute` target abstraction with a placeholder for DAIR-style shared
  compute alongside local and hosted
- a governance template drawing on Tiles' learner-controls-memory principle,
  as a markdown template in the commons, not code

**7. Demo build.** One app built through the normal RB flow that is clearly
human-scale AI end to end: runs on the open-weight runtime, bounded functions,
source links, footprint shown, exportable. Ideally built with a Thread fellow
on a problem they name; if not possible by the deadline, a neighborhood
example from the Outer Sunset. Record a short walkthrough.

## How the work runs: a daily loop

This is not a one-off build. A scheduled Claude Code job runs once a day,
makes bounded progress toward the vision, and writes down what it learned so
the next day's run starts smarter. Each run reads the log before deciding what
to do; nothing is decided on vibes or from memory of a previous session.

**Each daily run, in order:**

1. Read `docs/human-scale/LOG.md` (the running journal) and
   `docs/human-scale/NEXT.md` (the queued plan written by the previous run),
   plus the latest bench results
2. Pick the smallest piece of work from NEXT that fits today's budget: one
   experiment, one model tested, one workstream step, or one research question
   answered
3. Do it on the `human-scale` branch behind the flag, with tests where it's
   code
4. Record results in LOG with date, what was tried, what happened, what it
   cost, and an honest read on what it means
5. Rewrite NEXT: what tomorrow should do, what to drop, and any question Josh
   needs to answer, flagged clearly
6. Append spend to `docs/human-scale/SPEND.md` and stop when the day's budget
   is used

**Research and testing of open options is part of the loop.** Rotate between:
testing an open-weight model as builder or runtime (OpenRouter for hosted,
Ollama or llama.cpp for local), reading one relevant source (model releases,
the Mozilla readings, anchor project updates) and summarizing what it changes
for us, and trying one scaffolding or defaults change. Prefer cheap, decisive
experiments over broad ones.

**Budget rules, hard limits:**

| Budget | Limit | How it's enforced |
|---|---|---|
| API credits (OpenRouter, Anthropic API, any paid inference) | $20 per day, no carryover | Every paid call logs estimated cost to SPEND.md before it runs; the run stops at $18 to leave margin. Prefer local models for anything that doesn't need a hosted one |
| Claude Code usage (the scheduled session itself) | About half of Josh's weekly Fable and overall Claude usage must stay free for other work | One run per day, hard time cap of 90 minutes, no subagent fan-out beyond two parallel agents, no retrying a failed step more than twice. If a run ends early, that's fine; log it and stop |
| Any single experiment | Max $5 and 30 minutes | Bigger ideas get broken into daily slices or proposed to Josh in NEXT |

If a run can't tell what something cost, it assumes the worst case and counts
it. Over-budget is a bug; report it in LOG and reduce the next day's scope.

**What Josh sees:** a short daily summary at the top of LOG (five lines,
non-technical), and a weekly rollup each Friday with spend, what moved, and
decisions needed. Questions that block work go in NEXT under a heading Josh
can skim; the run works around them rather than waiting.

## Ground rules

- **Branch:** `human-scale`, off `main`. Everything behind a feature flag
  (`HUMAN_SCALE=1` or equivalent) so `main` and live builders are untouched.
  Small PRs per workstream, each with a short write-up in `docs/human-scale/`.
- **Honesty over optics.** Bench results go in as they are. If open-weight
  builders fail half the tasks, say so and say why. A weak but honest report
  is worth more to this application than a flattering one.
- **Estimates are labeled.** Energy numbers are estimates until we have
  measurement. Never present them as measured.
- **No fake integrations.** Anchor adapters are stubs with clear
  `NOT IMPLEMENTED` markers and a comment linking to the anchor's public
  description. Don't invent their APIs.
- **Don't break what people use.** Studio-migrated builders, Thread fellows
  and build-a-thon projects keep working exactly as before.
- **Don't over-build.** The deadline is Nov 20. A working split, one honest
  bench report, visible footprint, real export and one demo beat a complete
  redesign.
- **Data.** Use only synthetic or consented data in tests and demos. Nothing
  from real families or neighbors without explicit permission.
- **Keep the process in view.** This is for neighbors building with neighbors.
  Where a choice trades builder convenience against a neighbor's control or
  understanding, prefer the neighbor.

## Deliverables and order

Targets for the daily loop, so the application has something to cite at each
step even if later steps slip. Dates are soft; the budget rules are not.

- [ ] **Week of Oct 27:** branch, flag, `docs/human-scale/README.md` restating
  these principles as they apply to RB; builder/runtime split with an
  open-weight runtime option working on at least one existing template
- [ ] **Week of Nov 3:** bench harness extended; first open-weight builder
  bench report committed, with Opus comparison and the commons-retrieval
  variant
- [ ] **Week of Nov 10:** footprint and provenance in build reports and app
  footer; export and delete verified by tests; human-scale defaults in kickoff
  and scaffolding
- [ ] **By Nov 17:** anchor adapter stubs and governance template; demo build
  recorded; a one-page summary in `docs/human-scale/SUMMARY.md` written for a
  non-technical reader, which feeds the application

First run checklist: read the existing bench reports and roadmap docs, map
where model selection lives today, propose the flag and config shape, open the
branch, create LOG.md, NEXT.md and SPEND.md with this brief's rules at the top
of each, and write the first NEXT. Do not start building until those exist.
