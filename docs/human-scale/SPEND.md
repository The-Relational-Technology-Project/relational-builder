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
