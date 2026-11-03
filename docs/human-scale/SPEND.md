# Spend

Every paid inference call is logged here before it runs, with its estimated
cost. Rules (from BRIEF.md): $20 per day of paid inference, no carryover,
stop at $18; any single experiment at most $5. If a run cannot tell what
something cost, it assumes the worst case and counts it. Claude Code session
time is logged per run as a rough minute count so Josh can see the share of
his weekly usage this loop takes. OpenRouter balance: about $25 as of Oct 29; pace paid runs at $3 to $5 a day so it lasts the bench weeks.

| Date | What | Provider / model | Est. cost (USD) | Day total | Session minutes |
|---|---|---|---|---|---|
| 2026-10-28 | First run: setup, no inference | none | 0.00 | 0.00 | ~25 |
| 2026-10-30 | Bench run one: 3 open-weight models x 3 commons tasks, 1 trial (qwen3-coder-30b, gemma-4-26b, gpt-oss-120b), logged before the run; harness estimate $0.06, counted at worst case | OpenRouter | 0.60 (worst case; actual below) | 0.60 | ~ |
| 2026-10-30 | Bench run one, second slice: gemma-4-26b on hs-community-fridge, 1 trial, logged before the run; harness estimate under $0.01, counted at worst case | OpenRouter | 0.05 (worst case; actual below) | 0.65 | ~ |
| 2026-10-30 | Actual: bench run one (two qwen3-coder-30b builds finished; harness estimate $0.007; the cut-off third counted at $0.005) | OpenRouter / qwen/qwen3-coder-30b-a3b-instruct | 0.01 actual (0.65 reserved above) | 0.65 | ~60 |
| 2026-10-30 | Actual: bench run one, second slice (gemma-4-26b, fridge task; harness estimate $0.003) | OpenRouter / google/gemma-4-26b-a4b-it | 0.00 actual (0.05 reserved above) | 0.65 | ~60 |
| 2026-10-30 | Bench run one, third slice: gpt-oss-120b on hs-community-fridge, 1 trial, logged before the run; harness estimate about $0.01, counted at worst case | OpenRouter | 0.05 (worst case; actual below) | 0.70 | ~ |
| 2026-10-30 | Actual: bench run one, third slice (gpt-oss-120b, fridge task; harness estimate $0.004) | OpenRouter / openai/gpt-oss-120b | 0.00 actual (0.05 reserved above) | 0.70 | ~60 |
| 2026-10-31 | Bench run two, logged before it runs: hs-listening-wall on gemma-4-26b, gpt-oss-120b, qwen3-coder-30b; both comparison prompts on qwen3-coder-next and glm-4.5-air; 7 builds, 1 trial each, own caps; harness estimate under $0.10, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 1.00 | ~ |
| 2026-10-31 | Actual: bench run two, eight builds (gemma-4-26b x2 incl. one rerun, gpt-oss-120b, qwen3-coder-30b, qwen3-coder-next x2, glm-4.5-air x2); harness estimate $0.06 | OpenRouter / five open models | 0.06 actual (1.00 reserved above) | 1.00 | ~60 |
| 2026-10-31 | Import guardrail, after-run, logged before it runs: all five open models on --tasks compare with --import-guard, 10 builds, own caps; harness estimate about $0.08, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 2.00 | ~ |
| 2026-10-31 | Actual: import-guard runs, nine builds (gemma-4-26b x2, gpt-oss-120b x2, qwen3-coder-next x2, glm-4.5-air x2, qwen3-coder-30b x1 incl. fix passes); harness estimate $0.08 | OpenRouter / five open models | 0.08 actual (1.00 reserved above) | 2.00 | ~75 |
| 2026-10-31 | Opus 5.5 reference, logged before it runs: --tasks compare through OpenRouter, 2 builds, 1 trial, 20-minute cap; harness estimate about $0.50 | OpenRouter / anthropic/claude-opus-5.5 | 2.50 (worst case; actual below) | 4.50 | ~ |
| 2026-10-31 | Actual: Opus 5.5 reference, two builds (fridge $0.17, wall $0.28, harness estimate) | OpenRouter / anthropic/claude-opus-5.5 | 0.45 actual (2.50 reserved above) | 4.50 | ~80 |
| 2026-11-01 | Guarded bench, second sample, logged before it runs: five open models on --tasks compare with --import-guard (the fix prompt now carries the missing-file and bad-icon clauses), 10 builds, own caps; harness estimate about $0.10, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 1.00 | ~ |
| 2026-11-01 | Guard plus prompt rules run, logged before it runs: five open models on --tasks compare with --import-guard and VITE_HUMAN_SCALE=1, 10 builds, own caps; harness estimate about $0.10, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 2.00 | ~ |
| 2026-11-01 | Actual: twenty guarded builds across pass A (fix-prompt clauses) and pass B (prompt rules), five open models, both comparison prompts; harness estimate $0.14 | OpenRouter / five open models | 0.14 actual (2.00 reserved above) | 2.00 | ~35 |
| 2026-11-01 | Three trials per cell, logged before it runs: gemma-4-26b, gpt-oss-120b, glm-4.5-air, qwen3-coder-next on --tasks compare, --trials 3, guard and rules on; 24 builds, own caps; harness estimate about $0.30, counted at worst case | OpenRouter | 1.50 (worst case; actual below) | 3.50 | ~ |
| 2026-11-01 | Actual: three trials per cell, 24 builds (gemma-4-26b, gpt-oss-120b, glm-4.5-air, qwen3-coder-next); harness estimate $0.24 | OpenRouter / four open models | 0.24 actual (1.50 reserved above) | 3.50 | ~65 |
| 2026-11-02 | Fix-pass hints, measured, logged before it runs: gemma-4-26b and glm-4.5-air on --tasks compare, --trials 3, guard, rules and hints on; 12 builds, own caps; harness estimate about $0.15, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 1.00 | ~ |
| 2026-11-02 | A/B for gemma, logged before it runs: gemma-4-26b on --tasks compare, --trials 3, guard and hints on, prompt rules OFF (to tell the rules from variance after a 0 of 6); harness estimate about $0.05, counted at worst case | OpenRouter | 0.50 (worst case; actual below) | 1.50 | ~ |
| 2026-11-02 | Actual: hint runs, twelve builds (gemma-4-26b x6, glm-4.5-air x6); harness estimate $0.10 | OpenRouter / two open models | 0.10 actual (1.00 reserved above) | 1.50 | ~60 |
| 2026-11-02 | Actual: gemma A/B, five builds before the cap (guard and hints on, rules off); harness estimate $0.03 | OpenRouter / google/gemma-4-26b-a4b-it | 0.03 actual (0.50 reserved above) | 1.50 | ~75 |
| 2026-11-03 | Doubled-quote hint measured, logged before it runs: gemma-4-26b on --tasks compare, --trials 3, guard, rules and hints on; six builds, own cap; harness estimate about $0.05, counted at worst case | OpenRouter | 0.50 (worst case; actual below) | 0.50 | ~ |
| 2026-11-03 | Like-for-like hints, logged before it runs: gpt-oss-120b and qwen3-coder-next on --tasks compare, --trials 3, guard, rules and hints on; twelve builds, own caps; harness estimate about $0.20, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 1.50 | ~ |
| 2026-11-03 | Host test, logged before it runs: gemma-4-26b on --tasks compare, --trials 3, guard, rules and hints on, OpenRouter host Darkbloom excluded (the doubled quotes came only from that host in the morning run); six builds; harness estimate about $0.05, counted at worst case | OpenRouter | 0.50 (worst case; actual below) | 2.00 | ~ |
| 2026-11-03 | Actual: morning runs, twelve builds (gemma-4-26b x6 at $0.03, gpt-oss-120b x6 at $0.03); harness estimate | OpenRouter / two open models | 0.06 actual (1.50 reserved above) | 2.00 | ~60 |
| 2026-11-03 | Actual: gemma-4-26b with Darkbloom excluded, six builds ($0.03), and qwen3-coder-next, five builds before the 20-minute cap ($0.07); harness estimate | OpenRouter / two open models | 0.10 actual (reserved above) | 2.00 | ~75 |
| 2026-11-03 | Router guard measured, logged before it runs: gpt-oss-120b and glm-4.5-air on --tasks compare, --trials 3, guard, rules and hints on (BrowserRouter check live); twelve builds, own caps; harness estimate about $0.10, counted at worst case | OpenRouter | 1.00 (worst case; actual below) | 3.00 | ~ |
