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

## 2026-10-30

**For Josh:** The runtime split is in: a project can now say where its
finished app's AI runs (community open model, a model on the device or in
the room, or your own key), and built apps get named AI jobs (summarize,
match, resurface) instead of a prompt box. The server route that puts
Community AI on an open model is written and checked but not deployed:
this session is not allowed to deploy or set secrets, so three commands
need you (NEXT, top). The open-weight builder bench ran its first three
tasks on three hostable models; results below, screenshots committed.
Spend today: about $0.01 of paid inference (two open-model builds), counted as $0.65 worst case in SPEND.

**Stack layer moved:** Runtime model, from "Claude Opus via app-capabilities,
no per-project setting" to "per-project setting with a local path that works
end to end in the browser; community open-model path coded, awaiting deploy".
Builder model: first open-weight bench numbers exist (not yet moved; the
bench decides after run two).

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

**What happened (bench, honest).** Report:
`bench/results/2026-10-30T11-00-31a1e31/report.md`.

| Model | Task | Bundled | First try | Checks | Build time | Est. cost |
|---|---|---|---|---|---|---|
| qwen3-coder-30b | hs-meal-train | yes, after one auto-fix | no | 3/5 | 424s | $0.005 |
| qwen3-coder-30b | hs-community-fridge | yes, after one auto-fix | no | 3/5 | 177s | $0.002 |
| qwen3-coder-30b | hs-listening-wall | run cut off at the cap | | | | |
| gemma-4-26b, gpt-oss-120b | all three (first slice) | never started (sequential run, cap hit) | | | | |
| gemma-4-26b | hs-community-fridge | yes, after one auto-fix | no | 5/5 | 45s | $0.003 | (second slice, `bench/results/2026-10-30T11-26-714a4ad`) |

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
so far and it is a 26B MoE with 4B active, which a 16 GB box can host.
No human review yet; Josh's blinded scores decide "passes".

**What it cost.** Paid inference: about $0.007 estimated for the two
finished builds plus whatever the cut-off third used, logged as $0.65 worst
case across the two slices. Session: about 75 minutes of the 90.

**Honest read.** The runtime split is real code a person can click through,
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
