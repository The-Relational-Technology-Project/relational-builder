# Community Plan Limits — Strategy & Cost Model

*Written 2026-07-06. Companion to the limit-hit UX shipped the same day
(CommunityBudgetBanner, friendly 429 messages).*

## Where limits live today

- Every community member gets **5,000,000 tokens/day** (input + output
  combined), enforced server-side in the `llm-proxy` edge function.
  Per-member overrides live in `community_members.daily_token_budget`.
- The client shows a banner at **80% used** (dismissible per day) and a
  persistent one at 100%, both with an "Add your own key" path.
- Usage refreshes after every generation, so the picture is honest.

## The strategy, in one paragraph

Keep the free tier generous and quiet — most builders should never see a
limit. When someone does get close, treat it as a *graduation moment*,
not a wall: explain that the budget resets tomorrow, that their project
is safe, and that a personal API key (they pay their provider directly)
removes the daily cap. BYOK is the pressure valve that keeps RTP's costs
bounded without ever stranding an engaged builder mid-build.

## Will builders actually hit 5M tokens/day?

Anatomy of a message: the system prompt carries base instructions, RTP
principles, studio frame, profile, commons results, and a project-files
snapshot capped at 120k chars (~30k tokens). A realistic heavy build
message is ~40–60k input tokens; outputs run 5–30k tokens (64k cap).

| Session shape | Messages | Tokens (in + out) | % of daily budget |
|---|---|---|---|
| Light evening (small tool, edits) | ~10 | ~300k | 6% |
| Solid build session | ~15 | ~700k | 14% |
| Marathon (workshop day, big app, auto-fixes) | ~50+ | ~2.5M+ | 50%+ |

**Expectation: hitting the cap should be rare — well under 5% of active
builder-days.** It takes roughly 80–100 heavy messages in one day. The
realistic triggers are workshop days, runaway retry loops (already
bounded: one auto-fix, one continuation), and very large projects where
every message re-sends a 30k-token file snapshot.

## Cost model for ~50 builders

Assumptions: Claude Opus 4.8 default ($5 input / $25 output per MTok),
~3 sessions/builder/week, mix of light and solid sessions
(~$2.50–$7 per session, input-dominated).

- **Per builder:** ~$8–20/week → **~$35–85/month**
- **50 builders:** roughly **$1,700–4,300/month**, midpoint ≈ **$3k/month**

### Levers that change the math (biggest first)

1. **Prompt caching in the llm-proxy** — the project-files snapshot and
   base instructions are re-sent every message; cache reads bill at
   ~0.1×. Realistic input savings of 60–80% → total bill roughly
   **halves**. Highest-leverage engineering task on this list.
2. **Sonnet 5 for edits** — first build on Opus 4.8, then steer small
   edits to Sonnet 5 ($3/$15, intro $2/$10 through 2026-08-31): ~40–60%
   cheaper on the long tail of tweaks. Could be a soft default rather
   than a hard switch.
3. **BYOK conversion** — every builder who adds a key after the nudge is
   ~$40–85/month off RTP's bill.
4. **Budget tuning** — 5M/day is generous; even 2M/day would rarely be
   felt but caps worst-case single-day spend at ~$25/builder.

With caching + a Sonnet-for-edits default, the same 50 builders land
closer to **$800–1,500/month**.

## Recommended posture

1. **Encourage BYOK, gently** (shipped): nudge at 80%, clear path at 100%.
2. **Never block mid-thought silently** (shipped): the proxy's words
   ("resets tomorrow — thanks for building!") now surface verbatim.
3. **Next:** prompt caching in the proxy, then a Sonnet-for-edits default.
4. **Watch the data:** `community_usage` already records per-member
   daily tokens — a monthly look at the distribution will show whether
   5M/day is right long before anyone complains. Since 2026-07-31 the
   `community-monitor` function watches spend automatically and emails
   the steward at $5/day and $10/day — see [MONITORING.md](./MONITORING.md).
