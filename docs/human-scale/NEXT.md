# Next

The queue for the next run, rewritten at the end of every run. Pick the
smallest item that fits the day. Rules (from BRIEF.md): $20 of paid inference
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

## Questions for Josh

1. **Inference keys.** Only `OPENROUTER_API_KEY` is set in the cloud
   environment, and the OpenRouter balance was about $0.90 on Oct 28; Josh
   plans to top it up before the first paid bench run. The Opus comparison
   can go through OpenRouter at the same list price. Does Josh want a direct
   `ANTHROPIC_API_KEY` as an environment secret as well? Default if
   unanswered: OpenRouter for everything.

## Tomorrow

1. **Workstream 1, slice 1 (config and flag, no paid calls).** Add the
   `runtime` project setting to `src/store/project-store.ts` with the shape
   in README.md, persist it, write it into `.reltech.yml` in
   `src/project/export.ts`, and show it in Settings behind the flag. Add
   vitest and one test for the manifest line. Lint and typecheck.

## After that, in order

2. **Workstream 1, slice 2.** The kit helper `src/kit/files/lib/ai.ts` with
   `summarize`, `match`, `resurface` over the runtime config, targeting local
   Ollama first. Try it against one existing template in the preview with
   `qwen2.5:7b`. Local only, $0.
3. **Workstream 1, slice 3.** System prompt rule: when the flag is on, apps
   with AI features import the helper and expose named functions, not a
   prompt box. Then re-build one template through the normal flow.
4. **Workstream 2, prep.** Choose 10 to 20 representative commons builds as
   bench tasks (`bench/tasks.ts`, `exp-*` versions). Pick two or three
   open-weight coding models we could host and add them to `bench/models.ts`
   as OpenRouter entries with list pricing. Dry-run only (`--dry-run`) to get
   the cost estimate; no paid calls until the estimate fits $5 per
   experiment.
5. **Workstream 2, first paid run.** One open-weight model on three tasks,
   one trial each, with cost logged to SPEND.md before the call. Compare with
   the Opus 5.5 rows on the same tasks.
6. **Research rotation.** Read one source per run and log what it changes
   for us: start with Gebru "Frugal AI," then the Hugging Face SLM overview
   for which 1B to 8B models fit a 8 GB laptop.

## Drop or defer

- Nothing dropped yet.
- Workstream 6 (anchor stubs) and 7 (demo) wait until 1 and 2 have results.
