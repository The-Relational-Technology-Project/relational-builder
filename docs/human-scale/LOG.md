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

## 2026-11-06, afternoon (Josh's read)

Josh, on the design A/B sheet: the version with visual directions is much
better, not quite to Opus but nearing it. It is now the default behind the
flag for open-model builds; the bench keeps `none` as its control. Next
run turns the remaining gap into concrete recipe lines and measures again.
No spend.

## Week of Nov 2 to Nov 6: rollup

**Spend.** About $2.50 of paid inference over the week (Mon $0.13, Tue
$0.25, Wed $0.12, Thu $0.54, Fri $1.37, most of Friday's on six Opus
builds), against $11.20 reserved at worst case. Nothing near the daily
cap.

**What moved.**
- The bench learned that a model name is not a model: it records the host
  that served each build, and one host turned out to serve Gemma broken.
- The Builder builds on open models behind the flag: Gemma 4 26B by
  default (Josh's design read), the host exclusion on every call, and a
  keyless community route through the proxy (written, not deployed).
- Seven static checks and a second automatic fix pass behind the flag,
  each written from a screenshot or a decoded error, plus one false
  positive found and fixed.
- Six open model families measured; Mistral Small 3.2 is the strongest
  model that fits a single community machine by working builds.
- The docs were reframed as a public exploration of community-controlled
  AI.
- Friday found a preview bug that unstyled any app loading a web font,
  for every model (below).

**Decisions needed from Josh.** The proxy and app-runtime deploys (NEXT,
"Needs Josh"); his read of the design A/B sheet; a yes or no on the third
prompt that asks for AI; and whether the model hosts should become an
allowlist rather than an exclude list.

## 2026-11-06

**For Josh:** Today tested your question: does more detailed design
guidance make open models design more like Opus? Three versions of the
prompt (today's, a concrete recipe, and the recipe plus five ready-made
visual styles) ran on Gemma, Mistral Small, GLM and Opus. The side-by-side
sheet is sent to you in this conversation; the call on which looks best
is yours. On working code, the versions are a wash at this sample size.
On the way, the screenshots exposed a real bug: any app that loaded a font
from Google Fonts lost all its styling in the preview and when published,
for every model including Opus. That is fixed. Spend: about $1.37.

**Stack layer moved:** Builder app and preview, from "a web font silently
unstyles the app" to "fonts load beside the Tailwind stylesheet"; and the
builder model's design guidance, from untested principles to a measured
three-way comparison waiting on a human eye.

**What was tried.**

1. *Design scaffolding, built* (NEXT item 0). `src/human-scale/design-scaffold.ts`:
   `none`, `recipe` (screen skeleton, spacing and type scale, filled
   palette and 4.5:1 contrast, three don'ts from the board) and
   `direction` (the recipe plus five named visual directions as full token
   sets: Coastal fog, Civic paper, Schoolyard bright, Quiet library, Night
   market; every text pairing tested at 4.5:1 or better). Appended to the
   build prompt behind the flag when `BENCH_DESIGN_SCAFFOLD` or the
   browser setting names a variant; recorded in run config and on the
   board. The direction block adds about 1,300 prompt tokens.
2. *Design proxies* in the bench (theme tokens filled, kit layout pieces
   used, `md:` classes, font loaded, text contrast), labeled as proxies.
3. *The runs.* Two trials a prompt per model and variant, two fix passes,
   Darkbloom excluded; Opus one trial a prompt per variant. A 20-minute
   cap cut one Mistral build.

| Model | none | recipe | direction |
|---|---|---|---|
| Gemma 4 26B | 3 of 4 work, 152s | 2 of 4, 80s | 4 of 4, 61s |
| Mistral Small 3.2 | 3 of 4, 92s | 2 of 4, 105s | 2 of 3, 79s |
| GLM 4.5 Air | 2 of 4, 87s | 2 of 4, 75s | 2 of 4, 104s |
| Opus 5.5 | 2 of 2, 174s | 2 of 2, 158s | 2 of 2, 147s |
| Open models together | 8 of 12 | 6 of 12 | 8 of 11 |

   Four builds a cell cannot tell these apart on working code; the
   misses are the usual mix (a component named twice, an undefined
   value, a nested router), not anything the scaffold introduced. The
   proxies move the way the recipe asks: more desktop classes from Gemma
   and Mistral under `recipe`, and every direction build used a named
   palette. Whether the designs are better is the question the sheet is
   for.
4. *The font bug.* Three Gemma builds and one Opus build under the
   `direction` variant rendered as raw HTML in the screenshots while the
   browser check called them clean. A test page in Chromium settled it:
   the Tailwind browser compiler compiles no utilities at all when its
   stylesheet contains any `@import url(...)`, and loading a Google Font
   that way is normal (the recipe even asked for it). The preview and
   publish shell now lifts remote imports into `<link>` tags
   (`splitRemoteCssImports` in `src/preview/bundler/shell.ts`, tested;
   verified in Chromium: padding 32px and the font applied). This sits in
   the shared preview rather than behind the flag, because it only
   changes pages that were broken. The browser check now flags a page
   whose Tailwind classes had no effect, and `npm run bench -- rebuild
   <runDir>` regenerates previews with the current shell; every run from
   today was rebuilt and re-judged before the table above.

**What it cost.** About $1.37 estimated over 41 builds, logged as $4.00
worst case before the runs; the estimate leaves out Opus's thinking and
three retried Opus streams, so the real figure is likely somewhat higher.
Session about 55 minutes.

**Honest read.** The experiment answered a narrower question than the one
asked: detailed design guidance does not cost open models working code at
this sample size, and it does change what they produce in the direction
the guidance points. Whether it closes the gap with Opus is a design
judgment, and the sheet is built so Josh can make it in a few minutes.
The bigger result was accidental: a bug in the shared preview has been
unstyling every app that loads a web font, which means some earlier
screenshots on the board, from any model, may have been judged on a
broken page. Rebuilding the older runs is tomorrow's first job.

## 2026-11-05

**For Josh:** You asked whether to include Kimi and Mistral, so today ran
four of their open models on the two comparison prompts. Mistral Small 3.2,
a 24-billion-parameter model that fits a single community machine, made a
working app 4 times in 5, the best rate of any box-sized model on the board
so far, at a fifth of a cent a build; its screenshots are worth your eye
next to Gemma's. Kimi's coding model went 5 for 5 but is far too large to
host and took up to nine minutes a build; it shows what big open models can
do, not what a community should run. The day also found that the guard had
been flagging React wrongly on code that runs fine, which sent many builds
through needless fix passes; that is fixed. Spend: about $0.54.

**Stack layer moved:** Builder model, from "four open families measured" to
"six, with the first box-sized model (Mistral Small 3.2) above GLM on
working builds", and the preview now gets a second automatic fix pass
behind the flag.

**What was tried.**

1. *Kimi and Mistral on the comparison prompts* (NEXT item 0), three trials
   a prompt, guard, rules and hints on, Darkbloom excluded, one fix pass
   (the runs started before the two-pass default landed, so they match the
   board's other rows). The 20-minute caps on the two Mistral runs and the
   25-minute cap on Kimi each cut the last build or two.

| Model | Size | Builds | Clean | Median build | Est. cost a build | Hosts |
|---|---|---|---|---|---|---|
| Mistral Small 3.2 | 24B dense, about 14 GB at 4-bit | 5 | 4 (80%) | 110s | $0.003 | Parasail |
| Ministral 14B | 14B dense | 5 | 2 (40%) | 123s | $0.008 | Mistral |
| Devstral 2 | 123B dense (model card), an 80 GB card | 6 | 4 (67%) | 44s | $0.04 | Mistral |
| Kimi K2.7 Code | far beyond one box | 5 | 5 (100%) | 142s, one at 561s | $0.05 | four hosts |

   Mistral Small's one miss imported `@/components/ui/toaster`, a shadcn
   habit the kit does not have, and the fix pass could not untangle it.
   Ministral's misses were the familiar small-model set (a default import
   of a names-only App, lucide icons never imported) in bulk. Devstral is
   fast and its one blank was React error #130 (an undefined component).
   Kimi solved every fix it needed and never failed, at three to ten times
   the time of the others on the wall prompt.
2. *The React false positive.* Devstral's pages rendered clean while the
   static check kept flagging "React is not defined": the check fired on
   any `React.` in a file, including type-only uses like
   `e: React.FormEvent` that compile away. It now fires only on value uses
   (hooks, `forwardRef`, `<React.StrictMode>`). Since Nov 1, 62 of 93 fix
   passes had a React trigger and 22 had only that; some share of those
   were this false positive. Tested both ways.
3. *Kit and rules from the Mistral misses.* The kit gains a `separator`
   (four builds across the board imported one that did not exist); the
   rules and a fix hint say the kit has no toaster and to show a short
   message inline instead.
4. *A second automatic fix pass in the preview* (item 1). The Nov 4 run
   said two passes turned one build in six from broken to clean. Behind the
   flag the preview now runs a second automatic pass when the first fix
   surfaces a different error, never for the same error twice, and never
   after a person's own fix (`src/human-scale/fix-passes.ts`, tested). The
   bench's standard invocation in DAILY-RUN uses two passes from today.
5. *By-host table* (item 2): a host shows a rate only at three or more
   builds; the rest are listed with raw counts. No host other than
   Darkbloom stands at 0 of 3 or worse.
6. *Smoke test for the two community routes* (item 4):
   `scripts/human-scale/smoke-runtime.mjs`. Run against the live project
   with no credentials: the app runtime answers with its own 401; the
   Builder's proxy passes `openrouter-community` through to OpenAI, so the
   open-model branch is not deployed yet.
7. *Research* (item 9). "Intelligence per Watt" (Saad-Falcon et al.,
   arXiv 2511.07885, revised Oct 2026): accuracy per watt measured on the
   accelerator only (NVML, ROCm SMI, Apple powermetrics, 50 ms samples,
   10 to 15% telemetry error), local models answering 88.7% of single-turn
   queries, efficiency up 5.3x from 2023 to 2025. No per-query watt-hours
   in the part read. Useful for the footprint method's honesty note: the
   best published local measurements count the chip, not the machine.

8. *Re-measured every November run* with the fixed React check (NEXT
   item 2, done early): reports and import columns updated; the clean
   rates do not move, since "clean" was always judged in the browser.

**What it cost.** About $0.54 estimated over 21 builds (Devstral and Kimi
were 90% of it), logged as $2.00 worst case before the runs. Session about
55 minutes.

**Honest read.** Mistral Small 3.2 is the most interesting result of the
week: a model a community can actually hold, ahead of GLM on working
builds, at a third of a cent. Five builds is five builds, and design is
Josh's call; Gemma still has the best designs by his read, and the default
stays Gemma until he has looked. Kimi's perfect run is a ceiling, not a
recommendation. The React false positive is a reminder that the guard can
cost as well as save; every check should be scanned against clean builds,
as the Nov 4 ones were, and this one predated that habit.

## 2026-11-04, afternoon (with Josh)

**For Josh:** Two things you asked for. The docs now say what this is: an
open exploration of community control of the AI in Relational Builder,
smaller-scale and open models where they can do the job; the funding
application and its dates are gone from BRIEF, README, DAILY-RUN and the
log, and the kindred projects are named for what they are rather than as
anchors. And the Builder itself now builds on open models behind the flag:
a community member with no key gets GLM 4.5 Air for builds and edits (the
bench's first pick, with the evidence quoted in the model note), the model
menu shows the open models first, every OpenRouter call skips the hosts the
board has shown serving a model broken, and each build's provenance row
records which host actually served it. The server half (the proxy's
`openrouter-community` branch) is written, checked and not deployed: one
secret and one deploy, in NEXT under "Needs Josh". No paid inference.

**Stack layer moved:** Builder model, from "an open model is one the bench
tests" to "an open model is what the Builder uses by default behind the
flag, with the host visible and the bad ones excluded".

**What changed.**

1. *Docs reframed.* BRIEF's goal and ground rules are about community
   control; the deliverables list keeps the order and drops the dates;
   workstream 6 is "adapters to kindred projects". README's head and stack
   intro match. Four lines in older LOG entries that spoke of "the
   application" now speak of the write-up or of community control; the
   facts in them are unchanged.
2. *`src/human-scale/builder-model.ts`.* The open builder picks, each with
   a one-line evidence note a person can check against the board, the
   default (first pick), and the hosts to skip. Tested.
3. *Keyless community route for OpenAI-compatible providers.* A provider
   constructed with `communityRoute` goes through the LLM proxy with the
   community session token when it has no key (the token source is
   registered by the community store at load, so the provider layer stays
   free of store cycles). The OpenRouter provider gets it behind the flag,
   plus the open models first in its list and the host exclusion in every
   request body. Tested with a mocked proxy.
4. *Community default carries a provider.* `communityDefaultModelFor`
   returns the open model on OpenRouter for builds and edits when the flag
   is on, Claude for planning; the chat switches provider and model
   together and the model note names the open model and its evidence. The
   picker's "covered" logic knows both lists.
5. *Served host on the provenance row.* The chat captures the stream's
   metadata and records `servedBy` and, when it differs, `servedModel`;
   the footer line says "served by Novita".
6. *The proxy.* `openrouter-community`: allowlisted open models
   (`COMMUNITY_OPEN_MODELS`), the community gate on
   `OPENROUTER_COMMUNITY_KEY`, `COMMUNITY_OPEN_IGNORE_HOSTS` as
   `provider.ignore`, streaming passed through with a meter that reads the
   final usage chunk (OpenRouter sends one with `stream_options`) and falls
   back to characters/4. esbuild and strict tsc against the Deno shim:
   zero errors before and after.

**What it cost.** $0. About 50 minutes.

**Honest read.** This is the first day the branch changes what the Builder
does rather than what it measures, and it is all behind the flag and one
deploy away from being real. The pick (GLM 4.5 Air) rests on 24 builds
on two prompts and no design scores; it is the right default by the
evidence there is, and the evidence is thin. The host exclusion is a list
of one. Planning stays on Claude because no open model has been measured
at that stage, not because one could not do it; that is the next honest
measurement once the deploy lands.

## 2026-11-04

**For Josh:** Yesterday's two gpt-oss blanks became two more checks (a
router rendered in two files, a font utility the theme never declared),
and with them gpt-oss went 5 of 6 clean today; the sixth was the kit's
Avatar crashing on a missing name, which is now the kit's fault to absorb,
and it does. gemma on the good hosts bundled 4 of 6, all four clean; the
two misses were second-order mistakes the single fix pass could not reach,
so the bench gained a `--fix-passes 2` option (what a person gets by
pressing the banner again) and measured it: 6 of 6 bundled and 5 of 6 clean, with the second pass used once and solving. Every November
build was re-scanned with the new checks and none fires on a build that
was clean, so they are not costing good builds a fix pass. The optional
third prompt that asks for one AI job is written and waits on your yes.
Spend today: about $0.12 estimated over 19 open-model builds, logged as $1.70 worst case in three reservations. Nothing new needs you beyond the standing three
commands, the scores, and the yes.

**Stack layer moved:** Builder model, from "four named habits caught" to
"seven, with a scan proving none hits a clean build, and a second fix pass
measured"; the README's stack row now carries the numbers.

**What was tried.**

1. *Two checks from gpt-oss's blanks* (item 1). The static check now
   flags a router rendered in more than one file (the fix pass that
   swaps a BrowserRouter for a HashRouter had been leaving a `<Router>`
   in `main.tsx` around an `<HashRouter>` in `App.tsx`) and a
   `font-<name>` under `@apply` that neither Tailwind nor the app's
   `@theme` declares (Tailwind v4 drops the whole stylesheet on one of
   those). Hints for both. A scan of every November artifact with all
   the checks added since Nov 3 (router, font, require, icon element)
   found seven matches, all on builds that were not clean, and
   re-explained two Nov 1 failures the board had filed as runtime blanks.
2. *gpt-oss measured with them* (item 1): 6 of 6 bundled, 5 of 6 clean
   (1 of 6 on Nov 3 morning, 4 of 6 after the router guard). The router
   check fired once and the fix pass solved it. The one blank was
   `<Avatar name={users[id]?.name} />` with nobody found: the kit's
   Avatar called `.split` on undefined. The kit now draws a neutral mark
   for a missing name (render-tested); a built app should not go blank
   because a lookup came up empty.
3. *gemma measured with the icon and require checks, bad host excluded*
   (item 2): 4 of 6 bundled, all four clean, every fix pass that ran on
   them solved (a missing Badge import, a doubled `from` keyword plus
   React, a kit select name, React again). The two failures were both
   listening-wall builds where the first fix pass fixed what it was
   shown and the rebuild surfaced a new error: an import path with a
   space in it (`@/store/use store`) and a stray `<` at line 374. Six
   hosts served the six builds; the one 0% rows in the by-host table are
   single builds now, not a pattern yet.
4. *A second fix pass* (new). `--fix-passes n` runs the automatic fix up
   to n times while errors remain, records the aggregate (passes, total
   time, total cost) and labels the run on the board. Production's fix
   banner can be pressed again, so two passes is a fair reading of what
   a patient person gets. Measured on gemma, same flags, Darkbloom
   excluded: 6 of 6 bundled, 5 of 6 clean.
   Two builds needed one pass (8 and 4 seconds); one needed the second
   pass (a kit select name, then React, 130 seconds in all) and came out
   clean; three needed none. The one miss was not a fix matter: the
   Home page rendered a header and a nav and nothing between, with no
   error (36 characters of text), which the shell check caught and the
   static checks cannot. Against the morning run (same flags, one pass:
   4 of 6 bundled, 4 clean) the second pass is worth one build in six at
   a cost of two minutes on that build; the day's two gemma runs together
   say gemma off Darkbloom is 9 of 12 clean. Tomorrow decides the
   default from this (NEXT, item 1).
5. *qwen's sixth build* (item 3): bundle failed on an unterminated string
   at line 531 of a 658-line seed-data file, after the fix pass fixed the
   three React imports it was shown. 177 seconds. qwen's rate on the
   board is now 33% over 18 builds with a 147-second median; the
   pattern (huge seed files, single-file replies, slow) is consistent
   enough to stop spending on it until something changes.
6. *The third prompt, written* (item 8). `hs-listening-wall-themes` is in
   the task list: the wall plus an organizer button that groups answers
   into named themes with sources, with two extra checks (the AI job goes
   through `@/lib/ai`, `aiRuntimeLabel()` is shown). Not in `--tasks
   compare`; runs by id when Josh says yes.
7. *README stack table* brought to Nov 4 for the builder-model and
   provenance rows.
8. *Research rotation* (item 9). Bendor, Murray-Rust and Rehak, "Small
   AI: A degrowth imaginary for designing with/for artificial
   intelligence", DRS 2026, DOI 10.21606/drs.2026.1193. The full text
   returned 403 from the DRS library; the abstract is what we have:
   smallness starts with model size (less compute for training and
   inference, a smaller footprint) and is extended to political,
   epistemic and cultural smallness, after Schumacher; Small AI is a
   conceptual lever against "bigger is better" and a form of "unmaking".
   Nothing in the abstract on hosting, community use or cases. The frame
   fits this branch's four axes well enough to cite when the exploration is
   written up;
   the PDF needs a person with library access.

Not done: items 5 (end-to-end export and delete, needs a signed-in
Builder), 6 (scores) and 7 (backend runbook on a Docker machine) are
Josh's.

**What it cost.** Paid inference: about $0.12 estimated over 19
open-model builds (gpt-oss 6 at $0.04, gemma 6 at $0.03, qwen 1 at
$0.02, gemma two-pass 6 at $0.03), logged as $1.70 worst case across
three reservations before the runs. Session: about 30 minutes of the 90
(11:41 to 12:12 UTC), two bench runs in flight at a time, one subagent at
a time for the research fetches.

**Honest read.** The guard is now seven checks and every
one of them was written from a screenshot or a decoded error, not from
guessing what small models might do; the scan says they fire only where
the page was already broken. That is the right way to build this layer,
and it has a ceiling: the misses left today are second-order (a space in
an import path, a stray token three hundred lines down, a page that
renders nothing) and each new check buys less than the last. The second
fix pass is a cheaper lever than another check and it is what a person
would do anyway; tomorrow should make it the default if the numbers hold.
The honest state of the four models on these two prompts, off the one bad
host: glm and gemma produce a working app three times in four, gpt-oss
five times in six today, qwen one time in three and slowly. What none of
this says is whether the apps are any good to look at or to use, and no
amount of bench work substitutes for the scores. The run stopped at 30
minutes because the next useful bench minute is a design score and the
next useful runtime minute is a deploy, both Josh's; the window was not
spent for the sake of spending it.

## 2026-11-03

**For Josh:** The thing that broke gemma was not gemma. Every bench build
now records which upstream host OpenRouter actually used, and the morning
run showed it plainly: one host (Darkbloom) served every build that wrote
the doubled-quote import, and every build from the other hosts compiled.
The board now has a table of rates by host, and the bench can exclude a
host; a rerun of gemma with that host excluded is below. gpt-oss, the
model the board said failed at runtime a quarter of the time, was writing
`BrowserRouter` under an alias to satisfy the HashRouter rule by its letter;
the guard now catches that before bundling and the browser check no
longer counts a header over an empty page as a rendered app. Spend today:
about $0.24 estimated across 35 open-model builds, logged as $3.00 worst
case in four reservations. The backend half of the self-host runbook is written from the
repo and marked not yet run (no Docker here). Nothing new needs you beyond
the standing three commands.

**Stack layer moved:** Builder model (the bench can now tell a model from
the host serving it, and the guard catches a routing mistake that blanked
a quarter of one model's builds); Backend (a runbook that names the nine
core functions and their secrets, unrun); Footprint and provenance on the
runtime side (the kit helper keeps the app's own call log and footer line,
module-tested).

**What was tried.**

1. *Served model and host on every build* (item 1b). The provider layer
   gained an `onMeta` callback that fires once from the first stream chunk
   naming `model`, `provider` and `system_fingerprint`; the bench records
   it as `served` on each trial, the report lists what served each model,
   the board puts it in the notes column and in a new "by the host that
   served them" rates table. Tested with a mocked stream.
2. *The doubled-quote hint, measured* (item 1a). gemma, three trials per
   prompt, guard, rules and hints on: 2 of 6 bundled, both rendering clean.
   The four failures were all served by Darkbloom and all began with
   `from ''react'` on line 1 of `main.tsx` or a page (106, 15, 30 and 39
   syntax errors in the new syntax column); the two successes were served
   by DekaLLM and Parasail. The hint never got a chance: the fix pass
   can repair one bad line, not a file where every import is malformed.
   The hint stays (it is correct); the host is the finding.
3. *Host exclusion* (new). `BENCH_OPENROUTER_IGNORE=HostA,HostB` and
   `BENCH_OPENROUTER_ONLY=HostA` pass OpenRouter's routing preferences in
   the request body (the provider gained `setExtraBody`, tested); the run
   config records them and the board labels the variant. Then gemma
   again with Darkbloom excluded: 6 of 6 bundled (five after a one-pass
   fix, all solved), 4 of 6 rendering clean; the two blanks are new
   shapes, a CommonJS `require("lucide-react")` in an ESM file and React
   error #31 (an object rendered as a child), both on hosts that
   otherwise served working builds (PrimeIntellect 3 of 4 clean, CoreWeave
   0 of 1). So with one host excluded gemma went from 0 of 11 across two
   days to 4 of 6 clean, at 61 to 121 seconds and under a cent a build.
4. *gpt-oss with hints* (item 1, second half): 6 of 6 bundled (two after a
   one-pass fix for `React is not defined`, 2s and 27s), but only 1 of 6
   rendered a real page. Four of the six imported `BrowserRouter as
   HashRouter` or `as Router`: under the preview's file or blob path that
   is a blank page (a `replaceState` security error) or "Page not found".
   The static check now flags any `BrowserRouter` import from
   react-router-dom, aliased or not, with a hint that says not to alias
   it; the browser check records a page that opens on its own 404 as a
   routing failure, ignores resource 404s (a stylesheet link the shell
   never serves), and counts a page as rendered only above 60 characters
   of visible text (one build passed at 21: a title and a name picker
   over nothing). Those three changes re-scored the morning run; the
   next gpt-oss run will say what the guard is worth.
5. *qwen3-coder-next with hints*: the run hit the 20-minute cap after five of six
   builds (one took 290 seconds and wrote 42 files; one hit a 429 and came
   back as a single file). Of the five: 4 bundled, 2 rendered clean; the
   blanks were a `useState` used without importing it and a named import
   from an avatar package that does not export it. All five were served by
   Parasail. Median build 168 seconds, the slowest open model on the board
   by a wide margin.
The board after today (guarded runs on the comparison prompts, all
hosts blended, then by host):

| Model | Builds | Clean | Median build | Note |
|---|---|---|---|---|
| glm-4.5-air | 18 | 67% | 99s | not rerun today; tomorrow with the router guard |
| gpt-oss-120b | 18 | 44% | 84s | 33% blank at runtime, mostly the aliased BrowserRouter |
| gemma-4-26b | 35 | 37% | 81s | Darkbloom 0 of 4 bundled; the other hosts 8 of 8 bundled, 6 of 8 clean |
| qwen3-coder-next | 17 | 35% | 143s | 24% wrong shape (single-file replies); slowest |

6. *Runtime provenance in the app* (item 2). `@/lib/ai` keeps the last 50
   calls in the app's own browser (`rb.ai.log`: job, host, model, sizes,
   timing; never the prompt) and exposes `aiLog()`, `aiFootprint()` and
   `aiFootprintLabel()`; the prompt rule for the footer now names the
   footprint line beside `aiRuntimeLabel()`. Five tests, including that a
   failed call is not logged and the prompt text never is. No energy
   figure is claimed in the app.
7. *Type errors, split* (item 7). Syntax errors (TS1xxx) are counted apart
   as `tscSyntaxErrors`, and the type count is taken only on builds that
   bundled. Today's gemma failures show why: 106 "type errors" on one
   build were one malformed import cascading.
8. *Backend runbook* (item 5). `SELF-HOST-BACKEND.md`: what the backend
   is (77 migrations, 46 tables, 25 functions), the nine functions the
   Builder actually calls and the secrets each reads, the order to stand
   them up, and what stays outside a community's control (Resend for
   mail, Auth SMTP). Marked unrun at the top; this container has no
   Docker.
9. *Research rotation* (item 8). The Hugging Face blog has no post that
   surveys small open models; the closest is Liquid AI's LFM3 release
   note (Oct 27, 2026: a 1.7B text model in about 1 GB at 4-bit, agentic
   use, nothing on app-building). Bendor et al. stays next. Not worth a
   second fetch.

Not done: item 3 (end-to-end export and delete against a live app) still
needs a signed-in Builder; item 4 (design scores) is Josh's.

**Late addition (12:27 to 12:40 UTC): gpt-oss and glm through the router
guard.** Twelve more builds, logged first. gpt-oss-120b: 6 of 6 bundled,
4 of 6 rendered clean (1 of 6 this morning). The guard fired once on an
aliased `BrowserRouter` and the fix pass swapped it, but that page still
threw inside the router at load (two routers nested, most likely); the
other blank was a Tailwind utility the model invented (`font-inter`).
Three fix passes for `React is not defined` all solved. Hosts:
PrimeIntellect 4, CoreWeave 1, DeepInfra 1. glm-4.5-air: 5 of 6 bundled
and 5 of 6 clean, all served by Novita; the one failure was a kit `select`
export the fix pass could not repair. Board rates after this: glm 71%
over 24, gpt-oss 50% over 24, gemma 37% over 35 (by host: Darkbloom 0 of
4, the rest 6 of 8 clean), qwen 35% over 17. A CommonJS `require` check
with a hint also went in after gemma's blank, and the React #31 blank
decoded to a lucide component passed bare to the kit's `BottomNavItem`
(`icon={Users}` where the kit takes `icon={<Users />}`): one rule line,
a static check scoped to the kit components that take an element, and a
hint, all tested; no other build in three days had the pattern. Cost of the addition: about
$0.09 estimated (gpt-oss $0.04, glm $0.05), logged as $1.00 worst case.
The community route gained the same host exclusion
(`COMMUNITY_OPEN_IGNORE_HOSTS`, optional) and returns the serving host in
its provenance; esbuild and strict tsc against a Deno shim pass, zero
errors before and after; not deployed (standing "Needs Josh").
Session total: about 60 minutes of the 90; the run stopped there because
what was left in NEXT is either Josh's (deploy, scores, a third prompt)
or a measurement that needs two more checks written first (item 1), not
a fit for the last quarter hour.

**What it cost.** Paid inference: about $0.24 estimated over 35 open-model
builds (gemma 6 at $0.03, gpt-oss 6 at $0.03, gemma with the host
excluded 6 at $0.03, qwen 5 at $0.07, gpt-oss again 6 at $0.04, glm 6 at
$0.05), logged as $3.00 worst case across four reservations before the
runs. Session: about 60 minutes of the 90 (11:41 to 12:41 UTC), with two
bench runs in flight at a time and never more than one subagent.

**Honest read.** The board's averages were hiding two
different stories. gemma's 37% clean over 35 builds is a blend of a host
that cannot serve it (0 of 4 bundled, every build a doubled quote) and
hosts that can (6 of 6 bundled, 4 clean, today). gpt-oss's 44% is mostly
one habit, `BrowserRouter` behind an alias, which the guard now catches
and tomorrow's run will measure. Neither number should be quoted on its
own again; the by-host table is the one to read, and it only has today's
builds in it, so it is thin. Two of the day's three checks were tightened
after looking at screenshots rather than numbers (a 21-character "render",
a "Page not found" the console never reported), which is the brief's
point about screenshots. The provenance work on the runtime side is real
but unexercised by any bench build, because neither comparison prompt asks
for AI; that is a question for Josh, not a gap to paper over. The backend
runbook is honest about being unrun. qwen's 290-second, 42-file build is a
reminder that "it compiled" and "a person would wait for it" are different
tests.

## 2026-11-02

**For Josh:** Four things landed behind the flag today. The automatic fix
pass now tells a small model exactly what the kit exports and exactly which
import line to add, instead of letting it guess again; measured below. The
build prompt tells models not to rewrite the kit. Exporting a project now
packs the app's Community Cloud data into the zip as JSON and CSV, and
deleting a project deletes its app after a confirmation that counts the
documents. And every Builder reply now leaves a provenance row, so the
build report can say what the project's building cost in calls, tokens and
estimated energy. The measurement split: glm went from 58% to 83% clean with the hints; gemma went from 58% to 0 of 6, failing before any hint could apply, on a doubled-quote import it writes itself. Spend today: about $0.10 of paid inference (twelve builds), counted as $1.00 worst case in SPEND, plus a five-build A/B that cleared the prompt rules of blame. Nothing new
needs you.

**Stack layer moved:** Builder model (the fix pass that makes small models
usable got specific, measured); app hosting and data sovereignty (export
carries the data, delete is real, behind the flag, module-tested);
footprint and provenance (from "estimate method exists" to "recording per
reply and shown in the build report"). Runtime rows still wait on the
community route's deploy.

**What was tried.**

1. *Fix-pass hints* (NEXT item 2). `src/project/fix-hints.ts` (pure,
   tested against the real kit): for "No matching export in a kit file" the
   prompt now lists that file's actual exports and, for `select` and
   `avatar`, says what the kit's version is (a styled native select with
   `<option>`; an Avatar that draws its own initials); for "component used
   but never imported" it gives the exact import line when the name is a
   lucide icon or a kit component; it also covers `React is not defined`
   and default imports from `zustand` or `lucide-react`. Wired into the
   bench's fix pass with `--import-guard` and into the preview's FixBanner
   behind the flag. Runs now record which variant they used (guard, rules,
   hints) and the board labels rows with it.
2. *The kit-rewrite rule* (item 3). One more line in
   `HUMAN_SCALE_BUILD_RULES`: never write files under `src/components/ui/`
   or `src/lib/` unless asked to customize; the check already flags the
   broken imports such rewrites cause.
3. *Export and delete, wired* (item 5). `src/human-scale/data-export.ts`:
   the project's app id from its env vars (live or stashed), the data files
   added to the zip in both download paths (never failing the export when
   the pull fails), and `deleteAppForProject` before the project row goes,
   with a confirmation that names the app and its document count. Six
   tests with the cloud calls mocked. Not yet driven end to end against a
   live app (needs a signed-in Builder with Community Cloud); that is the
   honest state.
4. *Provenance, recording* (item 6). `src/human-scale/provenance-store.ts`:
   a persisted, capped store of rows; `recordBuilderCall` runs at the end
   of every reply when the flag is on, with tokens estimated from text
   length (the provider layer reports no usage) and the method saying so;
   `FootprintLine` in the build report card sums the project's calls,
   tokens and estimated Wh, or says plainly that a model's size is not
   public. Three tests.
5. *Measured the hints* with three trials per prompt on the two models that
   lose most builds to kit-name and import mistakes (gemma-4-26b,
   glm-4.5-air), guard, rules and hints on. Compare with yesterday's
   three-trial pass (guard and rules, no hints):

| Model, 6 builds each | Nov 1, guard + rules | Nov 2, guard + rules + hints | What happened |
|---|---|---|---|
| glm-4.5-air | 58% clean (over 12) | **5 of 6 clean (83%)** | three fix passes fired on `React is not defined`, `@/env` (a false positive, fixed the same hour) and `SelectContent`; two solved, one left a missing `./store` yet the page still rendered; the one blank was a router context error |
| gemma-4-26b | 58% clean (over 12) | **0 of 6 bundled** | four of six first drafts had `from ''react'` (a doubled quote) on line 1 of `main.tsx` or a page; one rewrote eight kit files and skipped `main.tsx`; the fix passes (30 to 72s) never got past the syntax error. The hints had no clause for it; one was added after the run |

The doubled quote appeared in 1 of gemma's 12 builds yesterday and in 4
of 6 today. The only change to what gemma sees on its first draft is one
new rule line (do not rewrite the kit); the hints only reach the fix pass.
Whether that line nudged gemma or today was a bad draw is not knowable
from this sample, so an A/B went out at the end of the run: gemma, three
trials, guard and hints on, rules off. Its result is appended below if it
landed in the window; otherwise tomorrow's item 1.

6. *What the type-error column counts* (a look, not a fix). On a gemma
   fridge build that scored 40 type errors, the errors were one broken
   JSX file cascading (unexpected tokens, unclosed tags); on a glm wall
   build with 2, they were real: a `Button asChild` the kit's props do not
   declare, and a type argument on an untyped call. So today the column
   mixes "one file is syntactically broken" with "the types are loose".
   Tomorrow's queue has the fix: count type errors only on builds that
   bundle, and report syntax breakage under its own name.

**The A/B landed.** gemma, guard and hints on, prompt rules off, five
builds before the cap: 0 of 5 bundled. Three had the doubled-quote import
on line 1 of `main.tsx`; two wrote no `main.tsx` at all. So the rules are
not what broke gemma today; whatever OpenRouter served as gemma-4-26b this
afternoon writes `from ''react'` most of the time, and yesterday's gemma
did not. That is the variance the brief warned about, now with a face: a
model behind an API is not the same model day to day. The rules stay. The
doubled-quote hint added today is the right next measurement, and the
rates table on the board (18 gemma builds: 39% clean) is the number to
quote until then, not yesterday's 58%.

**What it cost.** Paid inference: about $0.13 estimated (twelve hint
builds, five A/B builds), logged as $1.50 worst case across two
reservations. Session: about 75 minutes of the 90.

**Honest read.** Two models, two directions, one afternoon. The hints did what they were
written to do for glm: the kit-name mistakes that cost it builds now get
fixed in one pass and its clean rate on the comparison prompts moved from
58% to 83%, the first guardrail result today that is not noise (six builds
is still six builds; the board's rates table over all 18 glm builds says
67%). gemma's collapse is the other lesson: the fix pass can only repair
what it has a sentence for, and gemma's new habit, a doubled quote in an
import line, had none. It does now, and the A/B will say whether the extra
rule line provoked the habit or the day did. The product work is the
quieter half: export carries the data, delete removes the app, every reply
leaves a footprint row. Those are module-tested and flag-gated, not yet
clicked through against a live Community Cloud app, and the log says so.
Type-error counts are not yet a clean signal (syntax cascades inflate
them); tomorrow separates the two.

## 2026-11-01

**For Josh:** The import guardrail is now in the product, behind the flag:
when a build compiles but uses a component it never imported (or a bad
icon, or a wrong default import), the preview's fix banner fires on it
before anyone sees a blank page; checked in a real browser, screenshot
committed. The bench's fix prompt gained the two clauses production already
had (a missing file is genuinely missing, write it; a bad icon is one word
to replace), and the build prompt gained a short set of import rules for
small models, measurable with the flag. Then every open model reran both
comparison prompts twice more: once with the guard, once with guard plus
rules. The honest result: one trial per cell is noise (yesterday's 6 of 9 clean became 2 of 10 and 3 of 10 today), so the run went straight to three trials per cell: gemma, gpt-oss and glm each produce a clean app 58% of the time on these prompts, at about a minute and under a cent; the qwen coder 33%. Spend today: about $0.14 of paid inference (twenty open-model builds), counted as $2.00 worst case in SPEND. Nothing new needs you.

**Stack layer moved:** Builder model, from "a guardrail that works in the
harness" to "the same guardrail in the preview a person uses, plus prompt
rules written from what the bench saw, both measured". No other layer.

**What was tried.**

1. *Guardrail into the product* (NEXT item 1). `bench/lib/import-check.ts`
   moved to `src/project/import-check.ts` (tests along; the bench imports
   the production one). `FrameworkPreview` runs it after a successful
   bundle when the flag is on and hands the findings to the same
   `FixBanner` the bundler and runtime errors use, so the one automatic
   pass fires on them. Driven in Chromium through the dev server: an app
   using `<Calendar />` with no import shows the banner with the finding;
   the same app with the import shows nothing
   (`shots/import-guard-banner-2026-11-01.png`). The lucide message now
   uses the browser's own wording so production's bad-icon clause matches.
2. *The two failures the guard cannot fix* (item 1b). (a) The bench's
   `bundleFixPrompt` now carries production's missing-file and bad-icon
   clauses and the already-complete file list, so a fix pass is asked for
   the missing file by name instead of "fix the error". (b) A build that
   comes back in the wrong shape (one HTML file for an app prompt) is now a
   failure on the board, not a quiet "renders clean".
3. *Import rules in the build prompt* (new, from the same evidence).
   `HUMAN_SCALE_BUILD_RULES` in `src/human-scale/prompt.ts`, added to the
   build-mode system prompt only when the flag is on: every imported file
   must be in the same reply; kit, `zustand` and `lucide-react` export names
   only (with the kit's actual names, since glm invented `SelectContent` and
   `AvatarFallback`); every JSX component imported or declared; an app
   request is never a single HTML file. Tested through `buildSystemPrompt`
   with the flag stubbed on and off. The bench picks the flag up from
   `VITE_HUMAN_SCALE=1` (about 320 more prompt tokens).
4. *Two more measures on every build.* `tsc` type errors over the model's
   files with the kit merged, installed packages typed, uninstalled ones
   declared untyped, config noise excluded (first version blamed Opus for
   four errors that were the harness's own; fixed before any number was
   written down). And a fifth import kind in the check: `React.*` used
   without importing React, from gemma's blank wall today.
5. *Measured, three ways on the same two prompts.* Pass A: guard on, fix
   prompt with the new clauses (the "second sample" NEXT asked for). Pass
   B: guard on plus the prompt rules. Tables below; the board carries every
   row with screenshots, guarded runs marked.

**Pass A, guard on, fix prompt with the new clauses (second sample).**
Compare with the first guarded pass on Oct 31; same models, same prompts.

| Model | Prompt | Oct 31, guard | Nov 1, guard (pass A) | What happened this time |
|---|---|---|---|---|
| gemma-4-26b | fridge | renders clean (fix 14s) | no bundle | a syntax error in `main.tsx` and a malformed lucide import; the fix pass (96s) did not clear them |
| gemma-4-26b | wall | renders clean | renders clean (fix 47s) | `App.tsx` exported a name, `main.tsx` imported a default; the guard caught it, the fix solved it |
| gpt-oss-120b | fridge | blank (React #31) | no bundle | a default import from `zustand`; the fix pass answered with a diff-like block (`<<`) that broke the file |
| gpt-oss-120b | wall | renders clean | blank (React #185, a render loop) | no import mistake; a logic bug again |
| qwen3-coder-30b | fridge | no bundle | no bundle | two pages imported, never written; the fix pass (17s) did not write them |
| qwen3-coder-30b | wall | not run (cap) | no bundle | same kind |
| qwen3-coder-next | fridge | no bundle | renders, 1 console error (a missing asset) | first try, 26 files |
| qwen3-coder-next | wall | single HTML file | single HTML file | the same wrong shape twice |
| glm-4.5-air | fridge | renders clean (fix 36s) | renders clean (fix 23s) | `AvatarFallback`, `SelectContent` again; the guard caught, the fix solved |
| glm-4.5-air | wall | renders clean (fix 23s) | single HTML file | wrong shape this time |

**Pass B, guard on plus the prompt rules (`VITE_HUMAN_SCALE=1`).** Same
models, same prompts, about 320 more prompt tokens.

| Model | Prompt | Pass A (guard) | Pass B (guard + rules) | What happened this time |
|---|---|---|---|---|
| gemma-4-26b | fridge | no bundle | no bundle | imported a `@/store` it never wrote and a lowercase `label` from the kit's input; the fix pass left a syntax error and a `SelectContent` |
| gemma-4-26b | wall | renders clean | blank (`React is not defined`) | used `React.` without importing React; a kind the check does not cover yet |
| gpt-oss-120b | fridge | no bundle | **renders clean** (fix 20s) | wrote its own kit `select.tsx` without a `Select` export; the guard caught it, the fix solved it |
| gpt-oss-120b | wall | blank (React #185) | blank (a react-router error at load) | a logic or routing bug, not an import |
| qwen3-coder-next | fridge | renders, 1 error | no bundle | rewrote the kit's `avatar.tsx` and `bottom-nav.tsx` to import a `@/lib/cn` that does not exist; the fix pass (2s, the provider cut it off) did nothing |
| qwen3-coder-next | wall | single HTML file | **renders clean, as the app stack** (21 files, first try) | the rule "never answer an app request with a single HTML file" landed |
| glm-4.5-air | fridge | renders clean | renders clean (fix 27s, two kit names still wrong) | `SelectContent`, `SelectItem` again; the page renders anyway |
| glm-4.5-air | wall | single HTML file | no bundle | `SelectContent`, `SelectItem` a third time; this time the fix did not land |

**The three passes side by side (10 builds each, five open models, two
prompts).** Oct 31 guard: 6 of 9 rendered clean. Nov 1 pass A, guard
plus the new fix-prompt clauses: 2 of 10. Nov 1 pass B, guard plus prompt
rules: 3 of 10. Same code, same prompts, same models, an hour apart. Two
things are real in that: the rules fixed qwen3-coder-next's single-file
collapse on the wall, and gpt-oss made its first clean fridge. Everything
else is within the noise of one trial per cell: the same model fails a
prompt it passed an hour earlier, for a different reason each time. Per
build the open models stay at under two cents and 30 to 170 seconds.

**Later the same run: three trials per cell.** Tomorrow's item 1 fit in
today's window, so it ran: the four open models that have produced a
working app, both comparison prompts, three trials each, guard and rules
on, about $0.30. With 12 builds per model the picture stops wobbling:

| Model (12 builds each, guarded, rules on) | Clean | How the rest died | Median build | Median fix |
|---|---|---|---|---|
| gemma-4-26b | 58% | undeclared component 17%, missing file 8%, blank (React undefined) 8%, renders with an error 8% | 71s | 18s |
| gpt-oss-120b | 58% | blank from a logic or routing error 25%, bad import 8%, renders with an error 8% | 74s | 13s |
| glm-4.5-air | 58% | undeclared component 17%, wrong shape 8%, blank (bad import) 8%, blank (undeclared) 8% | 102s | 23s |
| qwen3-coder-next | 33% | wrong shape (single file) 25%, undeclared component 17%, missing file 8%, blank from a logic error 8%, renders with an error 8% | 134s | 15s |
| qwen3-coder-30b (3 builds, dropped) | 0% | missing file 100% | 137s | 99s |

The rates table on the board is the living version of this (it counts
every guarded build on the comparison prompts, Oct 31 onward). Read:
three hostable-or-nearly open models now produce a clean, kit-based app on
these prompts a little better than half the time (qwen3-coder-next a third,
mostly because it keeps answering the wall with one HTML file), at 71 to 102 seconds and
under a cent; Opus did it two of two at 148 to 178 seconds and about 22
cents, and the sample is far too small to call Opus's rate. What separates
the three is how they fail: gemma and glm fail on imports the guard can
name (and a prompt-side fix is plausible), gpt-oss fails on logic the guard
cannot see. qwen3-coder-30b is out of the comparison set.

**What it cost.** Paid inference: about $0.38 estimated (twenty builds
across passes A and B, then twenty-four three-trial builds), logged as
$3.50 worst case across three reservations. Session: about 65 minutes of
the 90, most of it waiting on runs.

**Honest read.** Yesterday's "3 of 5 fixed" was one sample, and today says so: with the
same guard, the same models produced different failures on the same
prompts, and the aggregate moved from 6 of 9 to 2 of 10 and 3 of 10. The
guard still does exactly what it claims (every finding it raised today was
a real import mistake, and the fix pass solved several), but a model that
makes a fresh mistake each run cannot be judged on one run. The bench is
now cheap enough to stop doing that: tomorrow runs three trials per cell
and reports rates. What held across all samples: gemma-4-26b and
glm-4.5-air are the two hostable-or-nearly models that produce clean apps
regularly; qwen3-coder-30b never has; gpt-oss-120b's failures are logic,
not imports; the rules cured one failure kind outright (the single-file
collapse). The product side is solid: the guardrail now runs where a
person builds, and a real browser showed it firing. Code quality: Opus
writes zero lint findings and zero type errors; the open models write 1 to
3 lint findings per 100 lines and 0 to 27 type errors a build, mostly
loose props and unused imports, none of which stops a page from working.

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
is the right way round for an exploration that reports in public. The weak spot is the gap
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

**Research rotation, second slot (10 minutes left): the Hugging Face small
model overview.** Not located this run: a web search turned up third-party
laptop guides, not the Hugging Face post NEXT meant. What those guides
agree on, unverified against model cards: on an 8 GB laptop the usable
range is 4B to 9B parameters at 4-bit quantization (Qwen3.5 4B and 9B,
Gemma 3 4B, Llama 3.2 3B, Phi-4 Mini, Ministral 8B are the names that
recur), 16 GB is comfortable, and OS plus apps must be counted. For the
runbook that means the local runtime default (`qwen2.5:7b`) is in range
but old; a 2026 4B to 9B model should replace it once one is tried on a
real box. Tomorrow's rotation should fetch the Hugging Face post itself
(search huggingface.co/blog for "small language models") rather than the
guides.

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
(3) the write-up should cite the 8B-beats-176B evidence as the reason a
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
matters most for community control and it is sitting one deploy away, blocked
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
