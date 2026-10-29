# Next

The queue for the next run, rewritten at the end of every run. Items are
day-sized chunks; a run works through them in order, committing after each,
until about 75 minutes are used. Rules (from BRIEF.md): $20 of paid inference
per day, stop at $18; 90 minutes; max two parallel subagents; no step retried
more than twice; one experiment at most $5 and 30 minutes. Work around open
questions, never wait on them.

## Decisions from Josh (2026-10-28)

1. **Runtime default is `community` when the flag is on, with `local` one
   click away.** Revised from an earlier call the same day. To keep the
   brief's rule that a hosted frontier model is never the silent default,
   the community runtime on this branch points at an open-weight model
   through OpenRouter (today's Community AI runs Claude Opus; that stays
   available as an explicit choice). `local` is a visible switch in the
   project's runtime setting, not buried. The kit helper still degrades
   honestly when a local endpoint is chosen and not reachable. An
   https-hosted app can reach a model on the visitor's own device
   (localhost) but not a box in the room at a private address; document
   that limit rather than work around it.
2. **OpenRouter-hosted open-weight models count as community-hostable** for
   the demo and the bench. A model on community-controlled hardware is still
   the preferred story where it is practical.

## Direction from Josh (2026-10-29)

Daily runs must make meaningful progress toward a fully community-controlled
RB stack. README.md now has the layer-by-layer map; each run names the layer
it moved. OpenRouter balance topped up to about $25; pace paid work at $3 to
$5 a day.

## Questions for Josh

1. **Inference keys.** Only `OPENROUTER_API_KEY` is set in the cloud
   environment, and the OpenRouter balance was about $0.90 on Oct 28; Josh
   plans to top it up before the first paid bench run. The Opus comparison
   can go through OpenRouter at the same list price. Does Josh want a direct
   `ANTHROPIC_API_KEY` as an environment secret as well? Default if
   unanswered: OpenRouter for everything.

## Tomorrow (one run, about 75 minutes, no paid calls)

1. **Workstream 1, the runtime split end to end, behind the flag.**
   - Add vitest to the repo (`npm test`), with one test to prove the
     runner works.
   - The `runtime` project setting (`src/store/project-store.ts`): shape per
     README.md, default `community` when the flag is on, persisted, written
     into `.reltech.yml` by `src/project/export.ts` (test the manifest
     line). Migration leaves existing projects untouched.
   - A Settings surface for it behind the flag: community (open-weight,
     default), local (endpoint and model), byok, with the explicit fallback
     choice and plain-language copy about what each means.
   - The kit helper `src/kit/files/lib/ai.ts`: `summarize`, `match`,
     `resurface` over the runtime config. `local` calls an OpenAI-compatible
     endpoint from the browser and degrades honestly when unreachable.
     `community` and `byok` call `app-capabilities` `ai_chat` as today;
     routing the community path to an open-weight model is item 2.
   - System prompt rule in `src/knowledge/context-builder.ts`, flag-gated:
     apps with AI features import the helper and expose named functions,
     not a prompt box.
   - Update README.md's stack table rows for runtime model. LOG, NEXT,
     SPEND as always.

## After that, in order

2. **Community runtime on an open-weight model (one run, small paid cost).**
   Extend `app-capabilities` `ai_chat` so a project whose runtime is
   `community` with `model: open` routes to an open-weight model through
   OpenRouter (a Qwen or Gemma, picked from the model list and priced in
   SPEND.md before any call), with Claude Opus kept as the explicit choice.
   Deploy through the Supabase Management API per CLAUDE.md, smoke-test
   with one call, and rebuild one existing template through the normal
   flow on it. Record model, host and tokens for that call as the first
   provenance row (workstream 3 starts here).
3. **Workstream 2, the open-weight builder bench (two runs, about $5 each).**
   Run one: pick 10 to 20 representative commons builds as `exp-*` tasks in
   `bench/tasks.ts`, add two or three hostable open-weight coding models to
   `bench/models.ts` as OpenRouter entries with list pricing, dry-run for the
   cost estimate, then run the open models on three tasks with cost logged
   first. Run two: the remaining tasks, the Opus 5.5 comparison once, and
   the commons-retrieval variant; commit the report in the existing format.
4. **Workstream 3, footprint and provenance (one run).** The per-project
   provenance log for builder and runtime calls, a labeled energy estimate
   (CO2.js or an AI Energy Score style method, method named), shown in the
   build report and as a small footer in built apps behind the flag.
5. **Workstream 4, export and delete (one run).** Export includes the
   app's `app-data` rows and config in open formats; delete removes the
   project and its data; both proven by tests.
6. **Self-host runbook (one run, no paid calls).** Stand the Builder up
   from a clean machine with local-only mode and a local model, run the
   checklist once, write down what broke. Moves the Builder-app and backend
   layers.
7. **Research rotation, when a run has 15 minutes left.** One source per
   run and what it changes for us: Gebru "Frugal AI" first, then the
   Hugging Face SLM overview for which 1B to 8B models fit an 8 GB laptop.

## Drop or defer

- Nothing dropped yet.
- Workstream 5 (human-scale defaults) folds into item 1's prompt rule and
  item 4's footer; the template metadata fields come after the bench.
- Workstream 6 (anchor stubs) and 7 (demo) wait until 1 through 3 have
  results.
