# Human-scale log

Newest entry first. Each run adds one entry: the date, a five-line summary
Josh can read without context, then the details. Fridays also get a weekly
rollup above the day's entry. Rules this file lives by (from BRIEF.md):
honesty over optics, estimates labeled, over-budget is a bug and gets
reported here with reduced scope the next day.

Budget, binding: $20 of paid inference per day (stop at $18), 90 minutes per
run, max two parallel subagents, no step retried more than twice, any single
experiment at most $5 and 30 minutes.

---

## Week of Oct 27 (rollup, due Friday Oct 30, written Saturday)

**Spend.** $0.02 of paid inference actually used across the week (eight
open-model builds through OpenRouter); $0.70 reserved as worst case in
SPEND. OpenRouter balance about $25 untouched in practice. Claude Code
time: about 25 minutes (Oct 28), about 60 (Oct 30).

**What moved.**
- Runtime model: a per-project runtime setting (community, local, your own
  key), a kit helper with named AI jobs, a prompt rule, a settings card,
  all behind the flag and clicked through in a browser. The community
  open-model server route is coded and checked, not deployed.
- Builder model: 12 commons-grounded tasks, 5 open models in the matrix, a
  board that shows every build and screenshot over time, a browser check
  that catches builds that compile but white-screen, and code-quality
  measures (lint density, largest file, kit usage, bad icon imports) on
  every build. Two comparison prompts chosen.
- Footprint, export, self-host: each started with a tested module or a
  checklist that was run; none wired into the product yet.

**Decisions needed (all in NEXT).** Run the three Management API commands
to deploy the community open-model route, or grant the loop a rule for
them. Say who scores design and how often, or accept screenshots plus a
hand-edited SCORES.md as the way. Confirm Gemma 3 12B as the community
open model, or let the bench pick.

**Honest read.** The loop is producing evidence faster than decisions, which
is the right way round for a Nov 20 application. The weak spot is the gap
between "bundles" and "works": three of four open-model builds on the
fridge prompt were broken in a browser, each by one line. That is the
bench's first real finding and it points at prompt guardrails for small
models, not at giving up on them.

## 2026-10-31

**For Josh:** The bench now measures code quality and speed from the files
each model writes (lint density, largest file, kit use, bad icon imports,
tokens per second) and names the kind of each first-try failure. Run two put
every open model on the two comparison prompts: ten builds, seven compiled,
two worked in a browser, and every failure was an import mistake. So the
afternoon built a static import check that feeds the auto-fix and reran
everything with it on: clean renders went from 2 of 10 to 6 of 9. Opus 5.5 ran the same two
prompts as the reference: clean on both, at about fifty times the cost of
gemma's clean builds and twice the time. The board has every build and
screenshot. Spend today: about $0.59 of paid inference, counted as $4.50
worst case in SPEND. No deploys, no secrets; nothing needs you today beyond the
three items already waiting in NEXT.

**Stack layer moved:** Builder model, from "first open-weight numbers on one
prompt, scored by the compiler only" to "five open models on two prompts,
scored by the compiler, the browser and a lint pass, with a guardrail that
turns most import mistakes into renders, all on the board". No other layer
moved; the day was the bench, as directed.

**What was tried.**

1. *Code-quality and speed columns* (NEXT item 1). `bench/lib/quality.ts`
   (pure, unit-tested): file count, largest file, `any` count, files
   importing the kit, hand-rolled `components/ui` files, invalid lucide
   icon names (the Builder's own checker), Tailwind v3 habits, a
   first-failure classifier (missing-file, bad-import, unknown-package,
   syntax), tokens per second, lint density. `bench/lib/measure.ts` runs
   eslint with the app's own config over each build's files and stores it
   all as `quality` on the trial, at the end of every run and on demand
   (`npm run bench -- measure <runDir>`), so yesterday's runs got it too.
   New columns in report.md and on the board. `tsc` over generated files is
   not in yet (the kit and esm.sh types make it a real piece of work); lint
   carries the axis for now.
3. *Import guardrail, built and measured* (item 4 from Oct 30, pulled
   forward because every failure pointed at it). `bench/lib/import-check.ts`
   (pure, tested): bad or missing lucide icon names, default imports from
   names-only modules (project and kit files we can read, plus `zustand`
   and `lucide-react`), capitalized JSX components with no import or
   declaration, imports of files never written or names never exported,
   each phrased as a bundler-style error. Recorded on every build as
   `importIssues`; with `--import-guard` the findings go to the one fix
   pass and fire it even when the bundle succeeded. Then every open model
   reran both comparison prompts with the guard on; the table below.
2. *Bench run two* (item 2). Two new open coders added at list price
   (`qwen3-coder-next`, `glm-4.5-air`). The three known models ran the
   listening wall; the two new ones ran both comparison prompts; each model
   its own capped invocation, two chains in parallel, screenshots on,
   nothing rerun from yesterday.

**What happened (run two, both comparison prompts; the board has the same
rows with screenshots).** "Browser" is what the screenshot pass saw after
the bundle.

| Model | Prompt | Bundled | Browser | Lint/100 | tok/s | Build | Est. cost | First error |
|---|---|---|---|---|---|---|---|---|
| gemma-4-26b | listening wall | first try | renders clean | 2.0 | 67 | 77s | $0.003 | |
| gpt-oss-120b | listening wall | first try | blank | 0.9 | 34 | 111s | $0.007 | `zustand` has no default export |
| qwen3-coder-30b | listening wall | no, fix failed | | 1.3 | 76 | 100s | $0.004 | imported `./data/questions`, never wrote it; the fix did not land |
| qwen3-coder-next | listening wall | first try | renders clean | 0.2 | 70 | 300s | $0.018 | |
| qwen3-coder-next | community fridge | no, fix failed | | 1.9 | 62 | 144s | $0.009 | imported `../components/ShiftList`, never wrote it; after the fix, a default import from a file with none |
| glm-4.5-air | listening wall | first try | blank | 1.0 | 71 | 116s | $0.009 | `Button is not defined` (used, never imported) |
| glm-4.5-air | community fridge | no, fix failed | | 2.6 | 86 | 75s | $0.007 | default import from the kit's `app-bar` (it exports names); after the fix, `Button` imported from the wrong file |

With yesterday's fridge builds, that is 10 builds across 5 open models on
the two comparison prompts: 7 bundled, but only 2 render clean in a
browser (gemma-4-26b and qwen3-coder-next, both on the listening wall); 4
are blank pages; 1 renders unstyled with errors; 3 did not bundle even
after the fix pass. Every one of the eight failures is an import: a file
imported but never written (three times), an icon that does not exist or
was never imported (two), a default import from a module that exports names
(two: `zustand`, the kit's `app-bar`), a component used without its import
(one). Not one is logic or layout. Lint density runs 0.2 to 2.6 findings per
100 lines, almost all unused imports; `any` is rare except glm's fridge
(10). Speed: 34 to 86 output tokens a second through OpenRouter; gemma is
the fastest to a working page (77s), the qwen coders are the slowest
(100s to 300s), none is in Opus's several-minute class. Cost: under two
cents a build, every build.

**Import guardrail, before and after (same day, same prompts, same models).**
"Before" is run two above (harness as it was). "After" is the same model on
the same prompt with `--import-guard`: the static import check's findings go
to the one fix pass alongside the bundler's, and the pass fires on them even
when the bundle succeeded. Runs are marked "(import guard)" on the board.

| Model | Prompt | Before | After | What the guard caught |
|---|---|---|---|---|
| gemma-4-26b | community fridge | blank (`Calendar` undeclared) | **renders clean**, fix pass 14s | `<List>`, `<Calendar>` used, never imported |
| gemma-4-26b | listening wall | renders clean | renders clean | nothing to catch |
| gpt-oss-120b | community fridge | blank (`CircleHalf` icon) | blank (React error #31: an object rendered as a child) | no import mistake this time; a logic bug the check does not cover |
| gpt-oss-120b | listening wall | blank (`zustand` default import) | **renders clean** | nothing triggered; the model simply imported correctly this run |
| qwen3-coder-30b | community fridge | unstyled (bad Tailwind class) | no bundle (imported three pages it never wrote; a 260s fix pass failed) | nothing the check adds; the bundler already saw it, the model could not repair it |
| qwen3-coder-30b | listening wall | no bundle (missing `./data/questions`) | not run (the model's 900s cap was spent on the fridge) | |
| qwen3-coder-next | community fridge | no bundle (missing file) | no bundle (JSX syntax errors, then default imports from the kit's `empty-state`) | three default imports from names-only kit files; the fix pass did not clear them |
| qwen3-coder-next | listening wall | renders clean | renders, but as a single HTML file (not the app stack) | nothing to catch; a different failure, the model abandoned the stack |
| glm-4.5-air | community fridge | no bundle (default import from the kit's `app-bar`) | **renders clean**, fix pass 36s | three default imports from kit files, a `SelectContent` that the kit's native select does not have |
| glm-4.5-air | listening wall | blank (`Button` undeclared) | **renders clean**, fix pass 23s | `AvatarFallback`, `SelectContent`, `SelectItem` imported from kit files that do not export them |

Net: of the eight builds that were broken in the browser before, five were
rerun with the guard; three of those five now render clean (gemma's fridge,
glm's fridge, glm's wall) and a fourth (gpt-oss's wall) renders clean on its
own. The guard did nothing for the two cases it was never meant for: a
model that invents a whole page and never writes it (qwen3-coder-30b, both
coders), and a React logic error (gpt-oss's fridge). On the two prompts,
clean renders went from 2 of 10 to 6 of 9 guarded builds (gemma 2, glm 2,
gpt-oss 1, plus qwen3-coder-next's wall as a single file).

Two false positives in the first version of the check (TypeScript type
arguments like `forwardRef<HTMLDivElement>` read as tags; a component passed
in as a prop, `{ icon: Icon }`, read as undeclared) made glm's two fix passes
record as "failed" although the builds render clean; fixed the same hour,
with tests, and the stored runs re-measured. Open models run through
OpenRouter vary run to run (gpt-oss made a different mistake each time), so
one before/after pair per cell is a signal, not a measurement; the direction
is consistent across models.

**The reference: Opus 5.5 on the same two prompts** (through OpenRouter,
plain request, no effort setting; run `2026-10-31T11-30-30-bbf9e57-t053`).
Both first try, both render clean, zero lint findings, kit used in 4 of 7
and 6 of 9 files, 148s and 178s with 80 to 86 seconds before the first
token, $0.17 and $0.28 a build. Against that, the hostable open models on
the same prompts: gemma-4-26b with the guard is clean on both at 74s and
81s for under half a cent, with 13 to 16 lint findings per build (unused
imports) and a plainer design; glm-4.5-air clean on both with the guard;
gpt-oss-120b one of two; the qwen coders none. Cost ratio on a working
build: about 50 to 1. Time: the open models are faster to a page than Opus,
which spends more than a minute thinking before it writes.

**What it cost.** Paid inference: about $0.59 estimated (eight builds in run
two, one a rerun after the run-folder collision below, nine guarded builds,
and the two Opus reference builds at $0.45), logged as $4.50 worst case
across three reservations. Session: about 80 minutes of the 90.

**Honest read.** Two things are now true with evidence. First, hostable open models can
build these apps: both comparison prompts have at least one open-model
build that compiles, renders clean, uses the kit and costs under two cents.
Second, they fail in one narrow way, imports, and our fix pass does not
catch most of it because the bundler never sees a bad icon name, a wrong
default import or a component used without its import; the browser does.
That was a guardrail problem before it was a model problem, and the
afternoon showed it: the static check for those four import mistakes, fed
to the same fix pass, turned three of five broken builds into clean renders
the same day, at a cost of a 14 to 36 second fix pass. What it does not fix
is a model that names pages it never writes (the qwen coders, repeatedly)
or a logic bug (gpt-oss once); those are the next failure kinds to study.
gemma-4-26b is now the model to beat among the hostable ones: both prompts
clean, under 90 seconds, under half a cent, on hardware a community can
own; glm-4.5-air matches it on results but not on hostability. What the
day did not settle: design. Gemma's wall is handsome and sparse with
repeated seed answers and icon names leaking as text; qwen3-coder-next's is
a competent generic SaaS page. Those are Josh's calls, and the screenshots
are on the board. One harness bug found and fixed: two runs started in the
same minute on the same commit shared a folder and one overwrote the
other's record (gemma's first wall run); run ids now carry seconds and a
random tail, and gemma was rerun. `tsc` over generated files is still not
measured; lint carries the code-quality axis for now.

**Research rotation: Hooker, "On the Slow Death of Scaling" (2025/26).**
Read through two secondary pages (Jason McEwen's summary, Andreas Kirsch's
critical riff); the essay itself is on SSRN (abstract 5877662) and was not
fetched, so quotes come via those pages. Her claim: "the next wave of
intelligence will be defined by cost of adaptability, not model size", and
scaling laws predict pre-training loss, not downstream capability ("our
scaling laws don't actually equip us to know what is coming"). Evidence she
gives: Falcon 180B "is now easily outperformed by open-weights models less
than one-tenth its size, such as Llama-3 8B or Gemma 27B"; Aya Expanse 8B
beats BLOOM 176B with 4.5 percent of the parameters; her leaderboard figure
uses a 13B-or-smaller cutoff. The levers she names instead of size: data
quality, synthetic data, inference-time compute. Kirsch's counter, which is
fair: "At any given moment in time, with the same algorithmic improvements
applied, scale still appears to help." What it changes for us: (1) the
bench's finding fits her frame exactly: today's small open coders produce
working apps, and what fails is adaptation to our conventions (our kit, our
icon set, Tailwind v4), which is cheap to fix with guardrails and examples,
not with a bigger model; (2) "cost of adaptability" is the number to track
for the builder model: how many prompt rules, fix passes and seconds it
takes a small model to produce an app that renders clean, against Opus;
(3) the application should cite the 8B-beats-176B evidence as the reason a
community box is a serious plan, not a compromise, and should say plainly
that newer-small beats older-large, not small beats large.

## 2026-10-30

**For Josh:** The runtime split is in: a project can now say where its
finished app's AI runs (community open model, a model on the device or in
the room, or your own key), and built apps get named AI jobs (summarize,
match, resurface) instead of a prompt box. The server route that puts
Community AI on an open model is written and checked but not deployed:
this session is not allowed to deploy or set secrets, so three commands
need you (NEXT, top). The open-weight builder bench ran its first three
tasks on three hostable models; results below, screenshots committed.
Spend today: about $0.02 of paid inference (four open-model builds), counted as $0.70 worst case in SPEND.

**Stack layer moved:** Runtime model, from "Claude Opus via app-capabilities,
no per-project setting" to "per-project setting with a local path that works
end to end in the browser; community open-model path coded, awaiting deploy".
Builder model: first open-weight bench numbers exist (not yet moved; the
bench decides after run two). Footprint and provenance: from "nothing
recorded" to "estimate method exists, tested, not yet recording". App
hosting and data sovereignty: export's data half exists as tested files,
not yet in the zip. The Builder app itself: from "mostly true already,
untested" to "a runbook that was run once, through step 6".

**What was tried.**

1. *Runtime split, end to end, behind the flag* (NEXT item 1). vitest added
   (`npm test`, 23 tests). The per-project `runtime` setting lives as four
   public env vars read and written through `src/human-scale/runtime.ts`
   (community by default under the flag, `local` with endpoint and model,
   `byok`; an explicit `fallback`), written into `.reltech.yml`, with a
   "Where this app's AI runs" card at the top of the Services tab and a
   flag-gated system prompt rule (bounded jobs, sources on generated text,
   say where it ran, fail plainly). The kit gained `@/lib/ai`
   (`summarize`, `match`, `resurface`, `ask`): `local` calls an
   OpenAI-compatible endpoint from the browser and degrades honestly when
   unreachable; every result carries `ran` and `sources`. Driven in Chromium
   through the dev server: the card renders, Local shows endpoint and model,
   the env vars land (screenshots in `shots/`). That drive caught a bug
   (community's model class leaking into the Ollama model field); fixed.
2. *Community runtime on an open-weight model* (item 2). `app-capabilities`
   `ai_chat` now routes `runtime_model: "open"` to Gemma 3 12B through
   OpenRouter and returns model, host and token usage; the default path is
   byte-for-byte the old one. Checked with esbuild and a strict `tsc` pass
   against a Deno shim (zero errors, same as the committed version). Not
   deployed: the sandbox's permission mode denied the production table
   read, the secret write and the deploy. The three commands are in NEXT.
3. *Bench run one* (item 3). Twelve commons-grounded `hs-*` tasks added (18
   representative builds with the existing four) and three hostable open
   models (`qwen3-coder-30b`, `gemma-4-26b`, `gpt-oss-120b`) as OpenRouter
   entries at list price. Dry run estimated $0.06 for 3 models x 3 tasks;
   the live run hit its 25-minute cap after two builds.

4. *Footprint and provenance, started* (item 4). `src/human-scale/provenance.ts`:
   the row shape from README, a table of public active parameter counts for
   the open models in play (frontier models get no number, on purpose), and
   an energy ESTIMATE derived as 2 FLOPs x active params x tokens over an
   assumed delivered efficiency, with the assumptions written into every
   row's `method` (`rb-flops-v1`). Six tests. Not wired into the helper or
   the build report yet; that is tomorrow's item 2.

5. *Export and delete, started* (item 5). Finding first: the server already
   has a paged full export (`admin_export_page`) and a real delete
   (`admin_delete_app`, cascades), and the Cloud tab uses both. The gap is
   the project export zip, which ships code without the app's data, and
   `deleteProject`, which deletes the project row but not the app.
   `src/human-scale/export-data.ts` turns the existing export object into
   the zip's `/data/export/` files (one JSON, one CSV per collection, a
   README that says what is there; members by name and join date, never
   email). Six tests. Wiring into the zip and the delete path is tomorrow.

6. *Self-host runbook, started* (item 6). `SELF-HOST.md`: the Builder-app
   checklist with what was observed when it was run today (install, tests,
   build, `vite preview`, landing renders with no env and no errors in
   Chromium, screenshot committed). Steps that need a local model server in
   a room are marked not run rather than assumed.

**Later the same day (Josh's session), the bench learned to look.** Josh
asked for one place to see every model, build and screenshot over time, and
for one or two comparison prompts instead of twelve. `BENCH-BOARD.md`
(`npm run bench:board`) is that page; `SCORES.md` is a table he can edit on
GitHub; `--tasks compare` is the two prompts (`hs-community-fridge`,
`hs-listening-wall`). Retaking today's screenshots exposed the day's real
result: of the four builds the harness called "bundled", three are broken
when opened in a browser. Gemma 4 26B: blank page (`Calendar is not
defined`, an icon used but never imported). gpt-oss-120b: blank page
(`lucide-react` has no export `CircleHalf`, an invented icon). qwen3-coder-30b
on the fridge: renders, but unstyled, because one unknown Tailwind utility
(`fog-green`) voids the whole stylesheet. Only qwen's meal train renders
clean. The bench now records what the browser saw per build (`runtime` on
each trial, a **Renders** column, an "In the browser" section in reports,
"Renders clean" on the board), so this cannot hide again. The table below is
as the harness scored it before that check; the board has the truth.

**What happened (bench, honest).** Report:
`bench/results/2026-10-30T11-00-31a1e31/report.md`.

| Model | Task | Bundled | First try | Checks | Build time | Est. cost |
|---|---|---|---|---|---|---|
| qwen3-coder-30b | hs-meal-train | yes, after one auto-fix | no | 3/5 | 424s | $0.005 |
| qwen3-coder-30b | hs-community-fridge | yes, after one auto-fix | no | 3/5 | 177s | $0.002 |
| qwen3-coder-30b | hs-listening-wall | run cut off at the cap | | | | |
| gemma-4-26b, gpt-oss-120b | all three (first slice) | never started (sequential run, cap hit) | | | | |
| gemma-4-26b | hs-community-fridge | yes, after one auto-fix | no | 5/5 | 45s | $0.003 | (second slice, `bench/results/2026-10-30T11-26-714a4ad`) |
| gpt-oss-120b | hs-community-fridge | yes, first try | yes | 5/5 | 109s | $0.004 | (third slice, `bench/results/2026-10-30T11-34-6adf156`) |

Both qwen builds failed to bundle on the first try for the same reason:
the model imported a file it never wrote (`./data/seedData`,
`./pages/CleaningShifts`); the harness's one auto-fix pass solved both.
Checks missed were the same twice: no kit components imported, and the
seeded-data check failed although the prompt asked for seed data (whether
the check or the build is wrong needs a look at the files, run two). Zero
security flags, no truncation, time to first token under 2s. A second slice
(gemma-4-26b on the fridge task, 10-minute cap) ran after the report:
it bundled in 45 seconds after one auto-fix, 10 files, all five checks
passed (kit components and seeded data included), for about $0.003. One
build is one build, but it is the fastest and cleanest open-model result
so far and it is a 26B MoE with 4B active, which a 16 GB box can host. A
third slice, gpt-oss-120b on the same task: bundled on the first try, 12
files, all five checks, 109 seconds, about $0.004; the only build today that
needed no fix pass, and the one open model of the three that does not fit a
small box (it wants an 80 GB card). So on one task: all three open models
produced a working app for under half a cent each; the two hostable ones
needed the harness's one-pass auto-fix, the big one did not.
No human review yet; Josh's blinded scores decide "passes".

**What it cost.** Paid inference: about $0.014 estimated across the four
finished builds plus whatever the cut-off fifth used, logged as $0.70 worst
case across three slices. Session: about 60 minutes of the 90.

**Honest read (revised after the browser check).** On one prompt, three
hostable open models all compiled and all three shipped something a
neighbor would see as broken or ugly: two white screens from a single bad
icon import each, one unstyled page from a single bad Tailwind class. Each
is a one-line error with a cheap mechanical catch (the Builder already has
`invalidLucideImports` for the chat path; the bench and the auto-fix do not
use it), so this says as much about our prompt and guardrails for small
models as about the models. Opus's September builds rendered clean. The
four-axis comparison Josh asked for starts from here.

The runtime split is real code a person can click through,
and the local path is the strongest piece: nothing leaves the room, and the
failure message says so. The community open-model path is the one that
matters most for the application and it is sitting one deploy away, blocked
by the session's own permissions rather than by the work. The bench says one
true thing so far: a 30B-class open coder produces an app that bundles, at
cents, but needs the auto-fix pass and takes three to seven minutes through
OpenRouter against Opus's typical one to two, while Gemma 4 26B did the
fridge task cleanly in 45 seconds. Pass rate on a sample of three is
not a number; run two needs all 18 tasks and the Opus comparison before any
claim goes in SUMMARY.md. Three permission denials in one run is the day's
real finding: the loop needs either a rule for the Management API calls
CLAUDE.md already documents, or those steps stay Josh's.

**Research rotation: Gebru, "Frugal AI" (AI Now interview, Feb 10, 2026).**
Read the transcript at ainowinstitute.org/publications/frugal-ai. What she
says: efficiency comes from specificity ("You want to create a specific tool
for a specific context"); she is explicitly not for "ChatGPT, but with fewer
resources" and asks "Why do we need chatbots?"; well-constrained input and
defined output (speech in, text out) is what makes a small model enough;
community groups curate data rather than scrape, and define the task for
themselves (Te Hiku Media: "everything we do has to serve the Māori people
first"); she proposes a federation of small organizations sharing data; the
only numbers are cost (a $400,000 one-time cluster versus almost $2 million a
year in cloud), no footprint measurement. What it changes for us: (1) the
kit helper's named jobs are the right shape, and the bench should score
builds on whether they expose bounded jobs, not only on whether they bundle;
(2) the "smallest model that passes" claim should be made per job
(summarize, match, resurface), each with constrained input and defined
output, rather than per app; (3) the commons as a federation of small,
curated datasets is a story we can already tell (500+ items, markdown
export, MCP server) and should say in SUMMARY.md; (4) her cost framing
(one-time hardware versus recurring cloud) belongs in the self-host runbook
as the number a community actually decides on.


## 2026-10-28 (first run, setup only)

**For Josh:** The branch exists and the loop is set up. No code was built
today; the brief says setup first. The repo already has half of workstream 1
(a local Ollama builder preset) and a bench harness that can take open models,
so the next runs start from something. Three decisions need you, in NEXT.
Spend today: $0 of paid inference.

**What was tried.** Read the brief, the bench README and model matrix, the
latest bench report (Sept 23, Opus 5.5 only), the roadmap and "where we are"
docs, the local-model doc, and traced where model selection happens on both
the builder and runtime sides. Wrote README.md (principles as RB behaviors,
the model-selection map, the flag and config proposal), BRIEF.md (committed
copy of the brief), DAILY-RUN.md (the scheduled job's prompt), this LOG, NEXT
and SPEND. Added `src/human-scale/flag.ts`, the one place the flag is read.

**What was found.**

- The builder/runtime distinction already exists in practice but not in
  config: builder calls go through `src/providers/`, runtime calls go through
  the `ai_chat` action of the `app-capabilities` edge function. The runtime
  side has no open-weight or local option and no per-project setting.
- The local (Ollama) builder preset shipped recently and its doc already
  points at this branch. Workstream 1's builder half is done; the runtime
  half is the work.
- The bench matrix lists three Together open models and several OpenRouter
  mirrors, but none has a committed result. Only an OpenRouter key is in the
  environment, so hosted open-weight runs go through OpenRouter.
- There is no unit test runner in the repo. Workstream 4's "verified by a
  test" needs vitest first.
- Export today is a zip of the project files plus `.reltech.yml`; it does
  not include an app's stored `app-data` rows. "Complete" export is real
  work, not a checkbox.

**What it cost.** $0 paid inference. Roughly 25 minutes of session time.

**Honest read.** The brief's week-of-Oct-27 target (runtime split working on
one template) is reachable because the builder half already exists, but the
runtime half touches a generated app's code, the kit, the system prompt and
an edge function. It should land as three daily slices: the config and flag,
the kit helper against local Ollama, then the prompt change.
