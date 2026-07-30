# Model bench — 2026-07-30T03-32-9cd604b

- **Tasks:** mutual-aid-board (harness 1.0.0, commit `9cd604b`)
- **Date:** 2026-07-30T03:32:05.402Z
- **Trials per model per task:** 2
- **Human review:** _pending_

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.
> **Bundle** = final compile success; **First try** = compiled without the auto-fix; **Fix** = of the builds that first failed, how many the single auto-fix pass solved. **~$** includes the fix pass when one ran.

### Task: mutual-aid-board (v1)

| Model | Bundle | First try | Fix | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| kimi-k3 | ✗ all errored | 0/0 | — | — | — | no | —/0 | — | — | — | — | — | 2 errored

## Human review

_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._

### Run notes (Kimi K3 first spin — blocked)

- **No signal on the model itself.** Both trials died before generation with
  OpenRouter 402s: the account balance covers ~570 tokens against a 65,536-token
  request. Same credit exhaustion the 2026-07-27 Opus 5 run hit mid-run — the
  account was never topped up.
- **To retry:** add credits at openrouter.ai/settings/credits (a 2-trial run is
  ~$0.40–0.60 at Kimi K3 list prices), then
  `npm run bench -- --models kimi-k3 --trials 2`.

## Errors

- **kimi-k3** · mutual-aid-board t1: OpenRouter API error (402): {"error":{"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits","code":402,"metadata":{"limit_source":"openrouter_credits","remedy_hint":"Add credits at https://openrouter.ai/settings/credits, or lower max_tokens / prompt size to fit your remaining balance.","provider_name":null,"previous_errors":[{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 380. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"}]}},"user_id":"user_3Gbh2zmbkUZRqGfiXTo62nfbcec"}
- **kimi-k3** · mutual-aid-board t2: OpenRouter API error (402): {"error":{"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits","code":402,"metadata":{"limit_source":"openrouter_credits","remedy_hint":"Add credits at https://openrouter.ai/settings/credits, or lower max_tokens / prompt size to fit your remaining balance.","provider_name":null,"previous_errors":[{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 380. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"},{"code":402,"message":"This request requires more credits, or fewer max_tokens. You requested up to 65536 tokens, but can only afford 570. To increase, visit https://openrouter.ai/settings/credits and add more credits"}]}},"user_id":"user_3Gbh2zmbkUZRqGfiXTo62nfbcec"}

