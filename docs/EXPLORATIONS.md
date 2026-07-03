# Explorations — sovereignty upgrades (discussion, not yet built)

Three directions Josh raised, each a way to loosen dependence on any single
vendor or host. The through-line: **none of these should replace the
zero-setup default** that makes a first build easy (Community Cloud data,
RTP hosting, the Claude community key). They're *graduation paths* — offered
when a neighborhood's values or capacity call for them, and, because prompts
are seeds now, a pattern proven by one builder can spread by link.

Each is sketched cheapest → deepest so we can start where the leverage is.

---

## 1. Apps built on protocols (AT Protocol, habitat.network, alt identity)

**Where we are:** built apps get identity from Community Cloud's email-code
neighbor accounts (a `member_token`), and store shared data as JSON docs. Simple,
zero-setup — but the identity is per-app and lives with RTP.

**What "support" means:** let a built app authenticate people by their AT Proto
DID or Habitat org identity, and read/write typed records to a PDS / Habitat
*space* — so identity and data become portable and consent-governed. This is
literally the "trust & belonging" layer from the Habitat evaluation, and the
Builder is where apps are made, so it's the natural place to make that layer the
path of least resistance.

- **(a) Knowledge-only — possible now.** Add "identity providers" as a service-
  guidance category (exactly how Supabase/Resend guidance works today). Teach the
  model AT Proto OAuth + `com.atproto.repo.*`, Habitat's OAuth server + spaces,
  and Antler's device-local `did:key`. Then when a builder says "let people sign
  in with their handle," a capable model writes a correct integration against a
  builder-supplied instance. Zero infra; opt-in per build.
- **(b) A first-class "Identity" choice** in the Cloud/Services area, parallel to
  "Neighbor accounts (email code)": connect a Habitat instance (URL + OAuth app
  registration) and the model wires sign-in to it and stores shared records in a
  space instead of `app_documents`. Mirrors the Community Cloud one-click pattern.
- **(c) RTP-hosted shared org — the Deb pilot.** RTP runs one Habitat org (or PDS)
  that community apps point at by default, so neighbors "enter once, appear
  everywhere with consent" across RTP apps. This is the felt benefit (continuity),
  not "data ownership" as an abstraction.

**Caveats:** Habitat is pre-1.0 with no license as of mid-2026 — fine to *target*
opt-in, not to bake into a default. AT Proto's PDS/DID complexity clashes with
"no accounts, no setup," so protocols must stay the upgrade, never the first-time
default. **Suggested order:** (a) now → (b) when Habitat pins a version + license
→ (c) as the profiles/gifts pilot.

---

## 2. Local-first apps, hosted locally (home machines, libraries)

Two things bundled here — worth separating:

**"Hosted locally"** — the app runs on a library machine, a home server, an old
laptop, a Raspberry Pi, instead of RTP/Vercel.

- **(a) A "Run it on your own machine" export — high value, low lift.** Alongside
  Download, produce a self-contained bundle: the files + a one-command local
  server (a tiny Caddy/Node/`python -m http.server` script) + a librarian-grade
  README, and optionally a Dockerfile. The Builder already exports files; this is
  mostly packaging and docs. A library becomes a neighborhood's host with no cloud
  account. Directly serves "no enclosure, including by us" — and sidesteps the
  hosting-origin security issue in SECURITY.md entirely (data never leaves the
  building).
- **(c) A neighborhood self-hosting appliance** — an RTP "home base" image that
  hosts a neighborhood's apps + data on the local network, reachable at something
  like `sunset.local`. More a hardware/ops story than a Builder feature, but the
  Builder could target it as a deploy destination.

**"Local-first"** — data lives on-device and syncs peer-to-peer when neighbors
meet; works fully offline.

- **(b) A local-first data option** parallel to Community Cloud: the model
  generates CRDT-backed apps (Yjs/Automerge) that sync over local network or a
  light relay. Pairs naturally with **Antler** (device-local `did:key`) for
  identity — no server, no accounts. This is the deeper lift, and the Sandpack
  preview can't fully exercise P2P sync, so it needs its own testing path.

**Why it fits RTP:** sovereignty, resilience (works when the internet or RTP
doesn't), the library-as-civic-infrastructure angle, "scale deep in place."
**Suggested order:** (a) the self-hosting export now → (b) local-first + Antler as
an explicit stack choice → (c) the appliance later.

---

## 3. Local & community-hosted open-source AI models for building

**Where we are:** the provider layer already accepts *any* OpenAI-compatible
endpoint, and the llm-proxy already has a dormant `rtp` tier (`RTP_MODEL_URL` +
`proxyRTP`). So the plumbing for both a local model and an RTP-hosted open model
mostly **exists** — it's just not pointed at anything or surfaced nicely.

- **(a) A friendly "Local model" provider — mostly UX, works today underneath.**
  Someone running Ollama / LM Studio / vLLM / llama.cpp exposes an OpenAI-
  compatible endpoint; the Builder can already use it via a custom URL. What's
  missing is a real option that pre-fills `http://localhost:11434/v1`, checks
  reachability, and lists local models — instead of a raw URL field. Caveat: an
  https page calling `http://localhost` hits mixed-content/CORS limits (solvable —
  Ollama supports CORS, or run the Builder locally). Low lift.
- **(b) A model-eval harness — the "testing and suggesting" ask, and genuinely
  Builder-shaped.** Build quality depends heavily on the model. A small harness
  that runs a fixed set of build tasks through candidate open models and scores
  the outputs (does it compile? valid edit-blocks? working preview? follows the
  RLS/design rules?) would let RTP **recommend specific open models with
  evidence**, and re-test as new ones land. This is the honest way to answer "is
  an open model good enough yet?" instead of guessing.
- **(c) Light up the RTP community open-model tier.** Point `RTP_MODEL_URL` at an
  RTP-run vLLM serving a strong open model (Qwen / Llama / DeepSeek-Coder-class,
  or a fine-tune) so *free building doesn't depend on any vendor's key at all* —
  the Tier-1 the three-tier system was designed for. Work is ops (GPU hosting,
  model choice, cost) **plus** a security fix: `proxyRTP` is currently an open
  relay; it needs the same community gate the Anthropic path has before it's
  exposed (noted in SECURITY.md).

**Why it fits RTP:** independence from any single AI vendor, cost sovereignty for
the free tier, and values alignment — building relational tech with open tools.
**Suggested order:** (a) the local-model provider now → (b) the eval harness (so
recommendations are evidence-based) → (c) the hosted open tier once a model
clears the bar and the gate is added.

---

## The shared shape

All three are the same move: a **frictionless default** (RTP data, RTP hosting,
Claude) with a **graduation path** beside it — portable identity, local hosting,
open models — that a neighborhood can climb as its capacity and values demand.
The cheapest first step in each is largely **knowledge + packaging + UX** on
plumbing we mostly already have, which is where I'd start. The deeper steps
(shared Habitat org, local-first sync, hosted open model) are real infrastructure
and want their own runway.
