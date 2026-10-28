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
