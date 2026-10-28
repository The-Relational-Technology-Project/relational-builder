# Next

The queue for the next run, rewritten at the end of every run. Pick the
smallest item that fits the day. Rules (from BRIEF.md): $20 of paid inference
per day, stop at $18; 90 minutes; max two parallel subagents; no step retried
more than twice; one experiment at most $5 and 30 minutes. Work around open
questions, never wait on them.

## Questions for Josh

1. **Runtime default when the flag is on.** The proposal makes `local`
   (Ollama on the person's machine or a box in the room) the default for new
   projects, with `community` as an explicit fallback. That means a published
   app's AI features only work for visitors who run Ollama, unless the
   builder picks a fallback. Is that the right first pass, or should the
   default be `community` with `local` one click away? The brief says hosted
   is "never the silent default," so the proposal follows the brief; the
   question is whether that is too hard a line for the demo.
2. **Hosted open-weight runtime.** OpenRouter can serve Qwen or Gemma as a
   hosted open-weight runtime. Should that count as "community-hostable" for
   the demo, or only a model on hardware the community controls?
3. **Inference keys.** Only `OPENROUTER_API_KEY` is set in the cloud
   environment. The Opus comparison in workstream 2 can go through OpenRouter
   too, at the same list price. Fine, or do you want a direct
   `ANTHROPIC_API_KEY` added as an environment secret?

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
