# Next

The queue for the next run, rewritten at the end of every run. Items are
day-sized chunks; a run works through them in order, committing after each,
until about 75 minutes are used. Rules (from BRIEF.md): $20 of paid inference
per day, stop at $18; 90 minutes; max two parallel subagents; no step retried
more than twice; one experiment at most $5 and 30 minutes. Work around open
questions, never wait on them.

## Needs Josh (blocking the community open-model path)

The scheduled session's permission mode denied three actions on Oct 30:
reading the production `cloud_apps` table, writing a Supabase secret, and
deploying an edge function. The code is committed and checked (esbuild
syntax pass, strict `tsc` against a Deno shim, zero errors, same as the
committed version). To finish item 2, run these from a session that may, or
add a permission rule for the loop's session:

```bash
# 1. the open model's key, as a function secret (OPENROUTER_API_KEY from your env)
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/secrets" \
  -d "[{\"name\":\"OPENROUTER_API_KEY\",\"value\":\"$OPENROUTER_API_KEY\"}]"
# 2. deploy app-capabilities (CLAUDE.md's standard deploy)
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -F 'metadata={"name":"app-capabilities","entrypoint_path":"index.ts","verify_jwt":false};type=application/json' \
  -F 'file=@supabase/functions/app-capabilities/index.ts;type=application/typescript' \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/functions/deploy?slug=app-capabilities"
# 3. smoke test: a credential-less POST returns the function's own JSON error, then one
#    ai_chat with runtime_model:"open" from any app with Community AI on returns {text, model: "google/gemma-3-12b-it", host: "openrouter", usage}
```

Optional, with the same deploy: `COMMUNITY_OPEN_IGNORE_HOSTS` (for
example `Darkbloom`, the host the bench saw serve gemma broken on Nov 3),
set the same way as the key in step 1.

**Added Nov 4 (the Builder building on open models).** Behind the flag,
community members with no personal key now build and edit on an open
model through OpenRouter (`src/human-scale/builder-model.ts` names the
picks and their evidence; GLM 4.5 Air first). That path needs the proxy:

```bash
# 4. the community's OpenRouter key for the Builder side (a separate secret from the app runtime's)
curl -X POST -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/secrets" \
  -d "[{\"name\":\"OPENROUTER_COMMUNITY_KEY\",\"value\":\"$OPENROUTER_API_KEY\"},{\"name\":\"COMMUNITY_OPEN_IGNORE_HOSTS\",\"value\":\"Darkbloom\"}]"
# 5. deploy llm-proxy (same shape as step 2, slug llm-proxy)
# 6. smoke test: open the Builder with ?humanScale=1 signed in on community access with no key,
#    start a build; the model note names GLM 4.5 Air and the build report's footprint line says which host served it.
#    A credential-less POST with x-llm-provider: openrouter-community returns the function's own 401 JSON.
```

`COMMUNITY_OPEN_MODELS` (optional) narrows or extends the covered open
models without a deploy; the default mirrors the client's list.

**Smoke test after the deploys (Nov 5):** `node scripts/human-scale/smoke-runtime.mjs`
with `LLM_PROXY_URL` and `APP_CAPABILITIES_URL` set checks both routes
without credentials; add `COMMUNITY_TOKEN` (a signed-in member's session
token) and `APP_ID`/`APP_KEY` (a scratch app with Community AI) for one
real call each, printing the model, the serving host and the usage. Run
against the live project on Nov 5 with no credentials: `app-capabilities`
answers with its own 401 (which the old code does too, so that proves
nothing about the open route), and `llm-proxy` passes `openrouter-community`
through to OpenAI, which means the new branch is not deployed yet.

Until then, apps on this branch that pick the community runtime get the
server's clear "open model is not configured" error; nothing silently falls
back to Opus.

## Decisions from Josh (2026-10-28)

1. **Runtime default is `community` when the flag is on, with `local` one
   click away.** Hosted frontier models are never the silent default; Claude
   Opus stays available as an explicit choice. An https-hosted app can reach
   a model on the visitor's own device (localhost) but not a box in the room
   at a private address; documented in the settings card, not worked around.
2. **OpenRouter-hosted open-weight models count as community-hostable** for
   the demo and the bench.

## Design read from Josh (2026-11-05)

Overall, from the board's screenshots: **Gemma 4 26B looks best, and
clearly ahead**; GLM 4.5 Air next; GPT-OSS 120B; then the Qwen coder.
The open builder default moved to Gemma the same day (its clean rate off
the bad host, 9 of 12, is within a few points of GLM's 71%). Per-build
scores in `SCORES.md` would still sharpen this; the overall read is
recorded there too.

## Focus from Josh (2026-11-09): close the Gemma to Opus gap, design and code

The loop's main line until further notice: **bridge the gap between Gemma
4 26B's builds and Opus's, on design and on code**, then carry what works
to the other open-weight models. Gemma is the open model Josh judges best
by eye and the one that fits a 16 GB box.

**The gap as measured (Nov 6 to 8, Gemma with visual directions, 16
builds; Opus, 6 builds; same two prompts):**

| | Gemma 4 26B | Opus 5.5 |
|---|---|---|
| Working builds | 14 of 16 | 6 of 6 |
| Working on the first try (no fix pass) | 10 of 16 | 6 of 6 |
| Lint findings per 100 lines | 2.3 | 0 |
| Type errors (median) | 3 | 0 |
| Desktop (`md:`) classes (median) | 7 | 12 |
| First-screen text (median chars) | 437 | 774 |
| Output per build (median tokens, estimated) | about 4,200 | about 6,600 |
| Build time (median) | 52s | 147s |

So Gemma writes about a third less, at a third of the time: less seeded
content, thinner desktop layouts, and code that needs a fix pass one time
in three and carries a few type and lint slips. Opus is clean on all of
these. Design is judged by Josh from the sheets; the numbers say where to
look.

**Nov 9 update (eight builds a column; see the LOG for the full table).**
After the import repair, the kit Select shape and `@/lib/cn`, Gemma made
21 working builds of 24 (from 4 of 8 with the seed rule alone, which came
first). First-screen text rose to 559 to 731 against Opus's 774. Lint,
type errors, desktop classes and first-try rate did not move.

**Nov 10 update.** Lint 0.3 per 100 lines and median type errors 0, so
code quality is at Opus's level on those two measures (import cleanup,
auto-import, kit nav links, Dialog `asChild`). Still open: first try at
about half (Opus: all), desktop classes 6 against 12, and seed text that
Gemma generates in loops instead of writing. The transfer check showed the
mechanical fixes carry to Mistral and GLM.

**How each run works the gap.**
1. Pick the largest remaining gap in the table, read the Opus and Gemma
   files and screenshots side by side for it, and name the cause in one
   line (a missing rule, a kit gap, a habit the check could catch, a
   prompt that invites brevity).
2. Make one change aimed at that cause: a rule line, a kit addition, a
   static check with a hint, or a prompt change. Keep it behind the flag
   and tested.
3. Measure Gemma only, four trials a prompt (8 builds, about $0.04),
   standard invocation. Compare against the Gemma row above and the fixed
   Opus baseline (the Nov 6 Opus builds; refresh Opus once a week, about
   $2). Update the table in this section with the new Gemma row.
4. Send Josh the side-by-side sheet (`design-ab-sheet.mjs --also
   2026-11-06:opus-5-5`) whenever the change touches design.
5. **Transfer check, weekly:** run the week's accumulated changes once on
   Mistral Small 3.2 and GLM 4.5 Air (about $0.10) and say which changes
   carried over and which were Gemma-specific. Gemma-specific fixes stay
   keyed to Gemma (`design-scaffold.ts` can switch by builder model).
   **Always run Gemma in the same batch, on the same prompts and code**
   (Josh, Nov 13: GLM and Mistral alone "aren't looking great", and a
   sheet without Gemma beside them has nothing to judge them against).
   Every sheet sent to Josh carries a Gemma column.
6. **Spread set, weekly (Josh, Nov 10):** `--tasks spread` (four gallery
   remixes, four new shapes), one build per prompt on Gemma, GLM 4.5 Air
   and GPT-OSS 120B (about $0.15), with an Opus reference every other
   week (about $2.80). Sheet: `spread-sheet.mjs --date <day>`, sent to
   Josh. Its first run (Nov 10) found two preview bugs, so read its
   failures for Builder bugs first, model habits second.

## Design read from Josh (2026-11-08 sheet)

**Gemma looks better than Mistral Small, still not quite matching Opus.**
So Gemma stays the open builder default, and the design work aims at
Gemma first. Note what this says about the proxies: Mistral had more
working builds and fuller first screens on Nov 8, and Gemma still looked
better, so the first-screen number tracks the gap to Opus but does not
rank the open models; the eye does.

## Design direction from Josh (2026-11-06)

On the design scaffolding A/B: **the version with visual directions is
"much better, not quite to Opus, but nearing it."** It is now the default
behind the flag (`designScaffoldVariant()` returns `direction` unless the
bench or the browser names another); `none` stays as the bench control.
The `recipe`-only variant is dropped.

## Direction from Josh (2026-10-30, supersedes the order below where they differ)

Focus the loop on **open models doing the app-building**, and on evaluating
them on four axes: **speed**, **error rates**, **design quality** and **code
quality**. The bench (workstream 2) is the main line of work until it can
say, per model and per task, how each axis comes out against Opus. The
runtime split and the other workstreams stay as built; they advance only
when a run has time left or when Josh unblocks a step.

What that means for each axis, with what exists and what to add:

- **Speed.** Exists: time to first token, build time, total wall time per
  trial. Add: tokens per second (output chars over build time), and the
  time the auto-fix pass added, so a slow first draft and a slow repair
  read as different problems.
- **Error rates.** Exists: bundled, first-try bundle, fix-pass solved,
  failed SEARCH/REPLACE edits, truncation and continuations, security
  flags, task checks. Add: the *kind* of first-try failure (missing file,
  syntax, bad import, hallucinated package), tallied per model, because
  today's two qwen failures were the same kind (imported a file it never
  wrote) and that is fixable in the prompt or with a cheap pre-bundle check.
- **Design quality.** Exists: the blinded human review (design, RTP fit,
  completeness, 1 to 5, plus a ranking) and screenshots. Add: screenshots
  on every run (today's slices skipped them to save time; do not), at phone
  and laptop widths, and a contact sheet per task in the report so Josh can
  score a day's builds in five minutes. The bench's rule stands: no LLM
  judge for "warm and neighborly"; the human score decides. A narrow
  mechanical layer is fine: theme tokens present, kit components used, no
  empty states missing, text contrast from the theme values.
- **Code quality.** Nothing today. Add, mechanically and free: `tsc` over
  the extracted project with the kit merged in (type errors per build);
  `eslint` with the app's config (errors and warnings per 100 lines); file
  count and the largest file's size (one 900-line App.tsx is a smell the
  kit exists to prevent); kit usage versus hand-rolled UI; `any` count;
  whether state lives in a store or in prop drilling. Report them as
  columns with medians, and keep raw numbers in run.json.

One place to look: `docs/human-scale/BENCH-BOARD.md` (generated by
`npm run bench:board`) lists every model, every build and every screenshot
over time, with scores folded in from `SCORES.md` (a table Josh can edit on
GitHub when there is time) and from the blinded review export. Screenshots
are the point; a bench run without them is not finished.

Prompts: do not run the same relational-tech prompt many times. Models are
compared on two prompts, one per shape: `hs-community-fridge`
(coordination) and `hs-listening-wall` (content-first civic). `--tasks
compare` resolves to them. The other hs-* tasks stay as a pool for spot
checks, one trial each at most.

Models: the three hostable open models already in the matrix
(`qwen3-coder-30b`, `gemma-4-26b`, `gpt-oss-120b`), plus two more open
coders worth a look at list price (`qwen3-coder-next`, `glm-4.5-air`), and
Opus 5.5 once per task set as the reference. Open models cost cents a
build, so run every task on every open model; spend the budget on Opus
sparingly. Keep each model as its own capped experiment.

Earlier direction (Oct 29) still holds underneath: each run names the
stack layer it moved; pace paid work at $3 to $5 a day.

## Questions for Josh

0. **Design scores for the two comparison prompts.** The board now has
   more than 30 open-model builds on them with screenshots, plus Opus. Five
   minutes in `SCORES.md` would give the bench its first design numbers. Earlier
   version of this question:
   **Who scores design, and how often?** The bench's rule is that your
   blinded 1 to 5 review decides design quality, not an LLM. With open
   models producing 12 to 36 builds a day, the loop will commit screenshots
   and a contact sheet every run and keep the mechanical columns moving;
   design scores land whenever you open `review/index.html` and export.
   If you would rather have a daily number without you, say so and the
   loop will add a narrow LLM check for factual design properties only
   (empty states present, phone layout holds, theme applied), labeled as
   not a quality score.

1. **Direct `ANTHROPIC_API_KEY`?** Default if unanswered: OpenRouter for
   everything, including the Opus comparison (run two).
2. **Who judges the open-model builds?** The bench's deciding score is the
   blinded human review (`review/index.html`). Run one's nine builds are
   waiting for your 1 to 5 scores; the loop will keep reporting mechanical
   results without them, but "passes" is your call.
3. **Community open model.** Gemma 3 12B through OpenRouter is today's pick
   (cheap, hostable on a 16 GB box, overridable with `COMMUNITY_OPEN_MODEL`).
   Fine as the first default, or do you want the bench to pick it too?
4. **A third comparison prompt that asks for AI?** The two prompts never
   exercise `@/lib/ai`, so the kit helper has no bench evidence. The
   prompt is written (`hs-listening-wall-themes`, Nov 4) with checks that
   the AI job goes through the helper and the runtime label is shown; one
   trial per open model costs about $0.05. Yes or no is enough.
5. **Which hosts to trust.** Nov 3 showed one OpenRouter host serving a
   broken gemma while others served a working one. The bench can exclude
   hosts; the community route cannot yet (item 4 above). Default if
   unanswered: exclude hosts the board shows at 0% clean over six or more
   builds, name them in the LOG, revisit weekly.
6. **Mistral Small 3.2's designs.** It made a working app 4 times in 5
   on Nov 5, ahead of GLM on that count, and it fits one community
   machine. Its screenshots are on the board under both comparison
   prompts, dated Nov 5. Worth a look next to Gemma's before the default
   changes again; default if unanswered: Gemma stays the default.
7. **Design references for the scaffolding experiment.** If there are two
   or three apps or sites whose look you want neighborhood tools to be
   closer to, name them in a line here; the `direction` variant will be
   written with them in mind. Default if unanswered: directions written
   from the board's best Gemma and Opus screenshots.

7. **Desktop nav in the kit for everyone?** Tomorrow's item 2 would make
   the kit's bottom tabs hand over to a top nav at laptop width. The kit
   is shared by every build, not only open-model ones, so this changes how
   Opus-built apps look on desktop too. Default if unanswered: build it
   behind the flag and show you both on the next sheet before it leaves
   the flag.
8. **Today's sheet.** Gemma's last 16 builds beside Opus's six. Worth a
   look at the listening wall row in particular: content first now, but
   with filler text in some builds.

10. **The library is in the Builder now (Nov 12), behind the flag.** It
   shows open models one screen of a different app on a first build, and
   the screen appears in the person's own message. Is that the right
   amount of visibility, or should it also say in words which screen was
   used and why? Default if unanswered: the attachment alone, plus the
   build log line.

9. **Reference screens (Nov 11).** Showing Gemma a screenshot of a
   *different* well-made app worked better than any written guidance so
   far. If we build a small library of reference screens for the Builder
   to show open models, which builds should be in it? Default if
   unanswered: the Opus screens from Nov 6 and Nov 10 that the sheets
   show, one per shape (a status tool, a content wall, a guide, an
   archive, a schedule), until you pick.

## Tomorrow (one run, about 75 minutes)

1. **Everything from this week together, on both sets.** Gemma with the
   library screen and the seed check: comparison prompts four trials,
   spread set two (24 builds, about $0.15, log first). This is the
   week's Gemma row for the gap table, and the first spread result with
   the seed check. Count loop-made seeds (should be 0 in final files) and
   how many builds the seed check sent through a fix pass.
2. **Desktop is the gap the library moves least on the comparison
   prompts** (5 `md:` classes against Opus's 12; 8 on the spread set).
   Look at why: compare the library screen Gemma was shown for the fridge
   (it gets the schedule screen) against its output at 1280 wide, and
   try one change: the layout words from `layout` added beside the image
   too (image plus words), measured on the comparison prompts.
3. **Mistral's runaway build** (Nov 13: 175 files over 20 minutes on
   one remix). The bench should stop a build that writes more than, say,
   60 files or runs past 10 minutes, and log it as a runaway. Check how
   production guards the same case (continuation cap) and match it.
4. **End-to-end check of export and delete.** Needs a signed-in Builder.

## After that, in order

5. **Self-host runbook, backend half, run for real.** Needs Docker or a
   spare Supabase project.
6. **The third prompt.** Waits on Josh's yes (question 4).
7. **Research rotation.** Green Web Foundation's "State of the Fossil-Free
   Internet 2026" for the footprint method; then whatever new small open
   model lands on OpenRouter that week.

## Drop or defer

- The project-store `runtime` field from the original plan: not needed. The
  setting lives as four public env vars (see README "as built"); revisit
  only if a cloud project loses it across devices (the env stash is
  device-local, so a project opened on another machine shows the default
  until the setting is chosen again there; flag this in the runbook).
- Workstream 5 folds into item 1's prompt rule and the footer; template
  metadata fields after the bench.
- Workstreams 6 and 7 wait until 1 through 3 have results.
