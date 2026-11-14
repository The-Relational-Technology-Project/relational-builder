# The daily run

This is the prompt the scheduled Claude Code job receives each day. It is
committed here so changes to it are reviewed like code. The scheduled task
holds a copy; if you change this file, update the task's prompt to match.

---

You are running the daily human-scale loop for Relational Builder. Work only
on the `human-scale` branch. Start by fetching it and checking it out:

```bash
git fetch origin human-scale && git checkout human-scale && git pull --ff-only origin human-scale
```

Then read, in this order, before deciding anything:

1. `docs/human-scale/BRIEF.md` (the rules; the budget table is binding)
2. `docs/human-scale/LOG.md` (what previous runs tried and learned)
3. `docs/human-scale/NEXT.md` (the queue the last run left you)
4. `docs/human-scale/SPEND.md` (what has been spent)
5. The newest entry under `bench/results/` if the queue touches the bench

The goal the loop serves: community control of the AI in Relational Builder,
with smaller-scale and open models wherever they can do the job, so a
community could run the Builder end to end without us or any one vendor.
README.md's "community-controlled stack" table scores each layer; every run
moves one layer and says which. These docs are public: write them for a
reader outside the project, and keep funding or deadline talk out of them.

Work through NEXT in order. Each item is cut to be a real chunk of a
workstream, not a sliver. Finish an item, then run `npm run lint` and
`npx tsc -b`, commit, and push before starting the next one, so partial
progress is never lost. Keep going until about 75 minutes of the 90 are used
or the day's inference budget is reached; aim to use most of the window
every day. Stop earlier only when NEXT is empty or everything left needs a
missing key or an answer from Josh. Do the work behind the flag
(src/human-scale/flag.ts), with tests where it is code. Run `npm ci` first if
node_modules is missing. Commit to human-scale and push with
`git push -u origin human-scale`. Do not touch main. Do not open a PR unless
NEXT says the workstream is ready for one.

Hard limits, from the brief:

- $20 of paid inference per day, stop at $18. Log every paid call's estimated
  cost to SPEND.md before making it. If you cannot tell what something costs,
  assume the worst case and count it.
- 90 minutes of wall time. At most two parallel subagents. No step retried
  more than twice. Ending early is fine; log it and stop.
- Any single experiment: at most $5 and 30 minutes.
- Only synthetic or consented data in tests and demos.
- Energy numbers are estimates and are labeled as estimates.
- No fake integrations; adapters to kindred projects carry `NOT IMPLEMENTED` markers.

Before you stop, in this order:

1. Add a LOG entry at the top: the date, a five-line non-technical summary for
   Josh, one line "Stack layer moved: <layer>, from <before> to <after>"
   (or "none" with why), then what was tried, what happened, what it cost, and an honest read
   on what it means. On Fridays, add the weekly rollup (spend, what moved,
   decisions needed) above the day's entry.
2. Rewrite NEXT: what tomorrow should do, what to drop, and questions for Josh
   under the "Questions for Josh" heading. Work around open questions; never
   wait on them.
3. Append today's spend to SPEND.md, including a $0 row when nothing was paid.
4. If any bench run happened, make sure its screenshots exist
   (`npm run bench -- shots <runDir>` retakes them), then `npm run bench:board`
   so BENCH-BOARD.md shows every model, build and screenshot over time.
5. Commit and push.
6. **Publish each contact sheet as an Artifact** (Josh, Nov 14: reports
   must open with one tap on a phone, never as a file to download). Build
   the sheet with the script (`design-ab-sheet.mjs`, `spread-sheet.mjs`,
   `reference-sheet.mjs`; they emit Artifact-ready pages), publish it with
   the Artifact tool, put the link in the day's LOG entry, and give the
   link in the final message. Every sheet carries a Gemma column.

The standard bench invocation for open models (so rows stay like for like):

```bash
VITE_HUMAN_SCALE=1 BENCH_MAX_TOKENS=24000 BENCH_OPENROUTER_IGNORE=Darkbloom \
  timeout 1200 npm run bench -- --models <alias> --tasks compare --trials 3 \
  --import-guard --fix-passes 2
```

Two fix passes since Nov 5, matching the preview behind the flag (see
`src/human-scale/fix-passes.ts`); hosts on the ignore list are the ones the
board's by-host table shows at 0 clean over three or more builds.

Spending pace: the OpenRouter balance is small (about $25 as of Oct 29).
Plan paid runs at $3 to $5 a day so the balance lasts;
the $20 daily cap is a ceiling, not a target. Open-weight models through
OpenRouter cost cents per build; the Opus comparison is the expensive part,
so run it once per task set, not per experiment.

Inference keys come from environment secrets (`OPENROUTER_API_KEY` is set
today; `ANTHROPIC_API_KEY` and `TOGETHER_API_KEY` are not). If a key you need
is missing, log it, put the ask in NEXT, and pick something else.
