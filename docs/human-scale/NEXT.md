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

## Tomorrow (one run, about 75 minutes)


0. **Kimi and Mistral on the comparison prompts (Josh asked, Nov 5).**
   Three trials each on `--tasks compare`, guard, rules and hints on,
   Darkbloom excluded, each model its own capped run, log spend first:
   `mistral-small-3.2` (24B dense, Apache 2.0, about $0.02 for six
   builds), `ministral-14b` (about $0.02), `devstral` (Mistral's coder,
   about $0.10; confirm its size and license from the model card and
   write them into `bench/models.ts`), and `kimi-k2.7-code` once as the
   large-open reference (about $0.20; not a candidate default, it cannot
   run on a community box). Shots, measure, board. If a Mistral model
   lands near Gemma's clean rate, say so in the LOG so Josh can look at
   its screenshots; design is his call.
1. **Decide the fix-pass default from the Nov 4 two-pass run.** If two
   passes moved gemma's clean rate (LOG, item 4) without adding more than
   about 30 seconds a build, make two the bench default (`--fix-passes 2`
   in DAILY-RUN's standard invocation) and carry the same "try once more"
   into the preview's fix banner behind the flag: after a first automatic
   fix that still fails, offer the second pass with the new errors, not a
   blank banner. If it did not move the rate, leave the default at one
   and say so. No spend for the decision; one glm run with the chosen
   default (about $0.05, log first) keeps the rows like for like.
2. **The by-host table has single-build rows.** Six different hosts served
   gemma's six builds on Nov 4; 0% rows with one build are noise. Add a
   minimum (three builds) before a host row shows a rate, and list the
   under-three hosts in one line underneath. Then read the table and, if
   any host stands at 0 of 3 or worse, name it in the LOG and exclude it
   in the standard invocation the way Darkbloom is.
3. **Nothing else on the bench until Josh scores.** The four open models
   have like-for-like rows with the same seven checks; more builds without
   design scores add rows, not knowledge. Spend the window on the
   runtime side instead:
4. **Runtime provenance from a real call.** The kit helper logs calls in
   the browser; the Builder's provenance store records builder calls. The
   gap is one real community-runtime call, which needs the deploy. If it
   is still not deployed, write the small e2e script that a person with
   the key can run in five minutes (`scripts/human-scale/smoke-runtime.mjs`:
   one `ai_chat` with `runtime_model: "open"`, print `model`, `host`,
   `servedBy`, `usage`) and put it under "Needs Josh".
5. **End-to-end check of export and delete against a live app.** Unchanged:
   needs a signed-in Builder with a Community Cloud app; otherwise the
   module tests stay the proof.
6. **Design scores.** Josh, `SCORES.md`; the board has more than 100
   open-model builds with screenshots.

## After that, in order

7. **Self-host runbook, backend half, run for real.** Needs Docker or a
   spare Supabase project.
8. **The third prompt.** `hs-listening-wall-themes` is in the task list
   with its two AI checks. One trial per open model (about $0.05) the day
   Josh says yes.
9. **Research rotation.** Bendor et al. is cited from the abstract (LOG,
   Nov 4); the PDF needs library access. Next: the "Intelligence per
   Watt" paper (Stanford and Together AI, arXiv 2511.07885) for the
   footprint column's method.

## Drop or defer

- The project-store `runtime` field from the original plan: not needed. The
  setting lives as four public env vars (see README "as built"); revisit
  only if a cloud project loses it across devices (the env stash is
  device-local, so a project opened on another machine shows the default
  until the setting is chosen again there; flag this in the runbook).
- Workstream 5 folds into item 1's prompt rule and the footer; template
  metadata fields after the bench.
- Workstreams 6 and 7 wait until 1 through 3 have results.
