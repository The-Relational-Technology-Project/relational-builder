# AI Outage Resiliency Plan

Written after Thread Workshop 2 (July 29, 2026), where a mid-session outage of
the major AI providers took Relational Builder's build loop down during a live
demo. The room pivoted to gallery browsing and architecture discussion — which
worked as a session, but the builder itself had no fallback. This doc is the
analysis of why, and the plan for making the next outage a hiccup instead of a
stop.

## What actually failed (verified against the code)

The outage exposed a chain of single points of failure, in order of impact:

**1. Every community builder runs on exactly one provider.** The default is
`claude` / Opus 5 (`provider-store.ts`), and community access — the tier every
workshop attendee is on — exists only for Anthropic chat models. The path is:
client → `llm-proxy` edge function → `api.anthropic.com` with
`ANTHROPIC_COMMUNITY_KEY`. When Anthropic is down, that whole tier is down.

**2. Every alternative is BYOK-only.** Gemini, OpenAI, OpenRouter, and
Together are registered providers, but for chat they only pass through a
personal API key. A community member (or facilitator) with no personal keys
has zero alternatives in the picker. Adding a key mid-outage only fixes one
browser — keys live in that device's localStorage — so it can't rescue a room.

**3. The fallbacks that exist don't cover outages.** The client retries
429/5xx/529 three times with backoff (~17s total) — built for busy-evening
spikes, not multi-hour outages. The proxy's `MODEL_FALLBACKS` fires only on
404 (model retirement) and maps Anthropic→Anthropic. The server-side refusal
fallback is also Anthropic-internal. All three are good; none helps when the
upstream itself is down.

**4. Tier 1 (RTP-hosted vLLM) isn't live.** `createRTPProvider()` returns
null without `VITE_RTP_MODEL_URL`, so the one designed non-Big-AI path doesn't
even appear in the model picker yet.

**5. No outage awareness anywhere.** The app can't tell "Anthropic is down
for everyone" from "your request failed" — each person discovers the outage
one error banner at a time, and the facilitator has no signal either.

**6. The operator fix path shared the same dependency.** Changing defaults or
deploying a fallback mid-session normally goes through Claude (Code) — which
was down too. There was no documented no-AI-required lever to flip.

**7. The correlated-outage lesson.** This outage hit all major AI services at
once. That means cross-provider fallback alone (Anthropic→Gemini) would *not*
have saved this particular session. Only inference that doesn't live in the
big clouds — a local model on the facilitator's laptop, or RTP-hosted vLLM —
survives a correlated outage. The plan needs both kinds of redundancy.

## The plan

Phased by value-per-effort. Phase 1 covers the common case (one provider
down); Phase 3 covers the rare-but-real case we just hit (everything down).

### Phase 1 — Cross-provider community fallback — **SHIPPED July 29, 2026**

*(Update: the Workshop 2 outage turned out to be Anthropic-only, so this
phase alone would have saved the session. Built the same week.)*

The community tier needs a second provider it can reach without anyone typing
a key. What shipped in `llm-proxy`:

- **Automatic failover on outage.** When a community chat request can't reach
  Anthropic (network error) or gets a 5xx — even after one quick same-provider
  retry, so a lone busy-evening 529 doesn't switch providers — the proxy
  re-runs the request on a fallback chain of non-Anthropic providers, under
  the same allowlist, daily budget, and metering. Nothing has streamed yet at
  that point, so the switch is seamless; a notice rides the reasoning channel
  ("Claude is unreachable right now — this build is running on Gemini 3.5
  Flash instead") so nobody wonders. BYOK requests never fail over — a
  personal Claude key must not silently spend community Gemini/OpenAI money.
- **Config-driven chain.** Default order `openai:gpt-5.6-sol,
  gemini:gemini-3.5-flash`; entries whose community key secret
  (`OPENAI_COMMUNITY_KEY`, `GEMINI_COMMUNITY_KEY`, `OPENROUTER_COMMUNITY_KEY`,
  `TOGETHER_COMMUNITY_KEY`) isn't provisioned drop out automatically. Override
  order/models without a deploy via the `COMMUNITY_OUTAGE_FALLBACKS` secret.
- **The no-deploy, no-AI outage lever.** Set the `OUTAGE_PROVIDER` secret
  (e.g. `gemini`) and all community chat skips Anthropic immediately — no
  waiting out doomed calls. One Management API curl, works from a phone (see
  "Operating during an outage" below). Delete the secret to restore.

Still open from this phase:

- **Valid fallback keys.** As of July 29: `OPENAI_COMMUNITY_KEY` isn't
  provisioned yet, and the existing `GEMINI_COMMUNITY_KEY` secret is
  **invalid** — Google answers `API_KEY_INVALID` on the native endpoint too,
  so community image generation has likely been broken as well. Until at
  least one valid key is set, the failover chain is empty and outages behave
  as before (the chain degrades gracefully — bad keys are skipped, the
  original error surfaces). Mint a fresh Gemini key and an OpenAI key and
  set them with the curl below.
- **Outage-aware client messaging.** The reasoning-channel notice ships; a
  room-scale banner ("Claude is down for everyone; builds are running on
  Gemini") is a nicer future layer on top.

### Operating during an outage (the runbook bit)

All of these are Supabase Management API calls — no deploy, no Claude, no
local checkout needed. `$SUPABASE_ACCESS_TOKEN` and `$SUPABASE_PROJECT_REF`
are in the usual place.

**Confirmed Anthropic outage — route community builds elsewhere now:**

```bash
curl -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '[{"name":"OUTAGE_PROVIDER","value":"gemini"}]'
```

(Value is any provider in the chain with a key: `openai`, `gemini`,
`openrouter`, `together`. Takes effect as function instances refresh —
within a couple of minutes.)

**Anthropic is back — restore normal service:**

```bash
curl -X DELETE "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '["OUTAGE_PROVIDER"]'
```

**Provision a new fallback key (e.g. OpenAI):**

```bash
curl -X POST "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/secrets" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" \
  -d '[{"name":"OPENAI_COMMUNITY_KEY","value":"sk-…"}]'
```

Note that even without the lever, failover is automatic — the lever just
skips the failed-call-plus-retry wait (~20s per message) once you *know*
it's an outage.

### Phase 2 — Health visibility

- **Provider health probe + status banner.** A lightweight check (proxy
  endpoint or client-side ping on first error) that distinguishes "provider
  outage" from "your request failed," and shows one calm banner instead of
  N error bubbles. The facilitator sees it too and can pivot early.
- **Recovery notifier.** A tiny monitor that watches provider status and
  pings when service is restored (this week's manual "notify Josh when it's
  back" action item, automated).

### Phase 3 — Non-cloud last resort (the small-models case)

This is the only hedge against a correlated all-providers outage, and it's
also the sovereignty story: community tools that don't stop working when the
big clouds do.

- **"Local model (Ollama)" provider preset.** RB already speaks
  OpenAI-compatible to any base URL — this is a registry entry with a
  configurable URL (default `http://localhost:11434`), `requiresKey: false`,
  and a default model list (qwen2.5-coder, llama3.3, etc.). A facilitator
  laptop running Ollama can serve a workshop room over venue LAN with zero
  cloud dependency. Cheapest real insurance that exists; mostly configuration.
- **Facilitator local-model kit.** A short doc: which models to pre-pull
  (2–3 good coder models, not 6–7 — curation beats count), how to expose
  Ollama on the LAN (`OLLAMA_HOST=0.0.0.0`), and how attendees point RB at
  the facilitator's IP. Pre-pull models before the session — you can't
  download 20GB during an outage.
- **Tier 1 go-live (RTP-hosted vLLM).** The architecture and proxy path
  already exist; what's missing is the GPU endpoint. Hosted on infra not
  shared with the major AI clouds, this is the community-scale version of the
  laptop backstop. Bigger lift (hosting cost, ops) — worth sequencing after
  the Ollama preset proves the demand.
- **Honest expectations in the UI.** A 7–32B local model will not match Opus
  on a full multi-file build. Label local mode accordingly ("keeps simple
  tools and edits working during outages") so it reads as a backstop, not a
  bait-and-switch.

### Phase 4 — Workshop-mode resilience (no model required at all)

The gallery pivot worked. Make it a designed fallback instead of an
improvised one:

- **Canned build replay.** Record one real build (transcript + streamed files
  + preview states) and make it replayable from cache. The live demo of "you
  describe it, an app appears" can then always be *shown*, even with zero
  connectivity — clearly labeled as a replay.
- **Pre-flight AI check in the runbook.** The July 8 runbook's load test
  already exists; add "run it 30 minutes before doors" plus a check of
  provider status pages, and add a full-provider-outage row to the triage
  cheat sheet: flip `OUTAGE_PROVIDER` → if that's down too, switch to the
  local model → if no local model, gallery + replay + idea capture (which
  is, genuinely, most of the workshop's value anyway).

## Sequencing recommendation

| Order | Item | Effort | Status | What it buys |
|---|---|---|---|---|
| 1 | Community fallback chain + proxy failover | ~1 day | ✅ shipped 7/29 | Room survives any Anthropic outage, hands-free |
| 2 | `OUTAGE_PROVIDER` lever + runbook curl | ~1 hour | ✅ shipped 7/29 | Operator control with no deploy and no AI |
| 3 | Outage-aware banner + health probe | ~half day | open | Calm rooms; facilitator sees it coming |
| 4 | Ollama preset + facilitator kit | ~half day + doc | open | Survives a correlated everything-down outage |
| 5 | Build replay demo | ~1 day | open | Demo always works, even fully offline |
| 6 | Recovery notifier | ~half day | open | Automates the "tell me when it's back" loop |
| 7 | Tier 1 vLLM go-live | weeks + $ | open | Community-owned inference at scale |

With 1–2 shipped, a Workshop 2-style (Anthropic-only) outage now costs each
build a ~20-second pause and a model swap note — or nothing at all once the
lever is set. Items 3–5 cover the rarer correlated-outage case.
