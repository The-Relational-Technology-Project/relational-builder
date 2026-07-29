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

### Phase 1 — Cross-provider community fallback (highest priority)

The community tier needs a second provider it can reach without anyone typing
a key. Half the plumbing already exists: `GEMINI_COMMUNITY_KEY` is provisioned
and community-gated in the proxy — but only for image generation.

- **Community-gated chat on a second provider.** Extend the proxy so
  `x-community-token` works on the Gemini (and optionally Together) chat
  paths, using server-side community keys under the same allowlist + daily
  budget as Anthropic. Gemini first: key already provisioned, pass-through
  path already written, metering helper already shared.
- **Automatic failover in the proxy.** When Anthropic returns 5xx/529 or times
  out after the existing retries — and nothing has streamed yet — re-run the
  request against a mapped cross-provider model (e.g. `claude-opus-5` →
  `gemini-3.1-pro-preview`). Emit a note on the reasoning channel so the
  builder sees "Claude is having trouble — building with Gemini instead"
  rather than silence. This is the cross-provider sibling of the existing
  404 `MODEL_FALLBACKS`, keyed on outage-shaped statuses instead.
- **A no-deploy, no-AI outage lever.** An `OUTAGE_PROVIDER` secret on the
  proxy: when set (e.g. to `gemini`), all community chat routes there
  immediately. Edge-function secrets update via one Management API curl — no
  deploy, no Claude, works from a phone. Document the exact command in the
  event runbook.
- **Outage-aware client messaging.** When the proxy fails over (or the outage
  lever is set), the retry banner should say what's happening at room scale —
  "Claude is down for everyone right now; your builds are running on Gemini" —
  instead of a per-person error.

*Would this have saved Workshop 2?* Only if Gemini was up. For an
Anthropic-only outage (the far more common case), yes, transparently.

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

| Order | Item | Effort | What it buys |
|---|---|---|---|
| 1 | Community Gemini chat + proxy failover | ~1 day | Room survives any single-provider outage, hands-free |
| 2 | `OUTAGE_PROVIDER` lever + runbook curl | ~1 hour | Operator control with no deploy and no AI |
| 3 | Outage-aware banner + health probe | ~half day | Calm rooms; facilitator sees it coming |
| 4 | Ollama preset + facilitator kit | ~half day + doc | Survives the everything-down outage we just had |
| 5 | Build replay demo | ~1 day | Demo always works, even fully offline |
| 6 | Recovery notifier | ~half day | Automates the "tell me when it's back" loop |
| 7 | Tier 1 vLLM go-live | weeks + $ | Community-owned inference at scale |

Items 1–4 together mean the next Workshop 2-style outage costs the room a
one-line banner and a model swap, not the demo.
