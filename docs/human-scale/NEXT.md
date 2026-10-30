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

## Direction from Josh (2026-10-29)

Daily runs make meaningful progress toward a fully community-controlled RB
stack; each run names the layer it moved. Pace paid work at $3 to $5 a day.

## Questions for Josh

1. **Direct `ANTHROPIC_API_KEY`?** Default if unanswered: OpenRouter for
   everything, including the Opus comparison (run two).
2. **Who judges the open-model builds?** The bench's deciding score is the
   blinded human review (`review/index.html`). Run one's nine builds are
   waiting for your 1 to 5 scores; the loop will keep reporting mechanical
   results without them, but "passes" is your call.
3. **Community open model.** Gemma 3 12B through OpenRouter is today's pick
   (cheap, hostable on a 16 GB box, overridable with `COMMUNITY_OPEN_MODEL`).
   Fine as the first default, or do you want the bench to pick it too?

## Tomorrow (one run, about 75 minutes)

1. **Bench run two (about $3, logged first).** The remaining nine hs-*
   tasks plus the four older experiment tasks on the same three open models
   (18 builds at cents each), then the Opus 5.5 comparison once on the same
   three tasks run one used (through OpenRouter, about $2.50), then the
   commons-retrieval variant on the best open model. Commit `report.md`,
   shots and `run.json` in the existing format, with the honest pass rate
   table at the top of the LOG entry. If OpenRouter 402s on pre-authorized
   max_tokens, lower `BENCH_MAX_TOKENS`, do not retry more than twice.
   Pace note from run one: the harness runs models one after another and
   qwen3-coder-30b took 3 to 7 minutes a build through OpenRouter, so a 25
   minute cap finished two of nine; gemma-4-26b took 45 seconds. Run the
   models as separate invocations with their own caps (one experiment each,
   30 minutes max), gemma first, and let a slow model's partial run.json
   stand rather than retrying it.
2. **Workstream 3, footprint and provenance (wire it).** The row shape and
   the labeled estimate exist (`src/human-scale/provenance.ts`,
   `rb-flops-v1`, tested). Now record: a per-project log (localStorage via a
   thin store, newest last, capped) fed from the Builder's own calls (the
   provider layer reports tokens) and from the kit helper's `ran` plus the
   server's `usage` (the helper can post its row to the Builder when it runs
   inside the preview, and keep its own small log in the app otherwise);
   show the rows in the build report and `describeRow` in a small app
   footer behind the flag. The first real community-runtime row comes from
   the smoke test above once Josh runs it. If a better public per-token
   method turns up (CO2.js, AI Energy Score), add it as `rb-*-v2` beside
   the first, never replace numbers already logged.

## After that, in order

3. **Workstream 4, export and delete (one run).** Export includes `app-data`
   rows and config in open formats; delete removes the project and its data;
   both proven by tests (vitest is in now).
4. **Self-host runbook (one run, no paid calls).** Builder from a clean
   machine in local-only mode with a local model; include Gebru's cost
   framing (one-time hardware versus recurring cloud) as the number a
   community decides on. Moves the Builder-app and backend layers.
5. **Kit helper in a real build.** Rebuild one existing template through the
   normal flow with the flag on and confirm the model imports `@/lib/ai` and
   exposes named jobs; fix the prompt rule where it does not. Needs a builder
   model key in the session (OpenRouter works) and a signed-in Builder, so it
   may need Josh in the room.
6. **Research rotation, when 15 minutes are left.** Next: the Hugging Face
   SLM overview (which 1B to 8B models fit an 8 GB laptop), then Bendor et
   al. "Small AI".

## Drop or defer

- The project-store `runtime` field from the original plan: not needed. The
  setting lives as four public env vars (see README "as built"); revisit
  only if a cloud project loses it across devices (the env stash is
  device-local, so a project opened on another machine shows the default
  until the setting is chosen again there; flag this in the runbook).
- Workstream 5 folds into item 1's prompt rule and the footer; template
  metadata fields after the bench.
- Workstreams 6 and 7 wait until 1 through 3 have results.
