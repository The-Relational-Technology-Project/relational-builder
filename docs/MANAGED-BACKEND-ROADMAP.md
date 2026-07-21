# Managed Backend Roadmap

How Relational Builder reaches parity with managed-Supabase platforms (Lovable
et al.) for non-technical builders: migrations that just work, secrets entered
once that work everywhere, production deployment with no platform accounts.

**The benchmark.** A Lovable-built production app (a county microgrant program:
bilingual public application form, admin review pipeline, analytics, email
sequences) runs on 11 Postgres tables, ~58 RLS migrations, and 7 edge
functions — none of which its builder ever touched directly. Lovable's real
differentiator is not code generation (our stack is the same); it is that the
platform *operates* the backend. This roadmap closes that gap on our terms.

**Our terms.** Two decisions shape everything below:

1. **Both database models, phased.** RTP-hosted managed data (Community Cloud,
   zero signup) stays the default for non-technical builders; an automated
   builder-owned-Supabase path is the "graduate to your own database" story
   for apps that outgrow it. We never force a Supabase account on someone
   organizing a block party, and we never trap a grown app on our infra.
2. **BYO keys, managed server-side.** Builders bring their own service keys
   (Resend first). Keys are vaulted on the builder platform's Supabase —
   never in browser code, localStorage-as-source-of-truth, or generated
   apps — and used only by RTP edge functions. No shared RTP key for app
   email: cost and deliverability responsibility stay with the builder, while
   the *operational* burden stays with us.

The architectural claim underneath all four phases: **capabilities are
origin-agnostic, so hosting never needs to execute app code.** A capability
endpoint (email today; AI, SMS, scraping tomorrow) authenticates by app
identity, not origin, which means the same generated `fetch` call works from
the in-browser preview, community-hosted static sites, and any external
deploy. Community hosting can stay a static file server forever.

---

## Phase 1 — Secrets vault + email capability ✅ (shipped with this doc)

**What shipped**

- `app_secrets` — per-app, per-service vault on the builder platform
  (deny-all RLS, service-role-only, write-only from the client: set, replace,
  delete — never read back). Plus `app_capability_usage` (daily caps) and
  `app_email_log` (builder-visible history).
- `app-capabilities` edge function — sibling to `app-data`. Builder-session
  actions manage the vault (`secret_set/config/delete/status/test/log`);
  the app-authed `send_email` action sends through the vaulted Resend key
  with rate limiting (30/min), a daily cap (200/day default), optional
  members-only sending, and per-recipient logging.
- Services tab: connecting Resend with Community Cloud on vaults the key
  server-side and verifies it live against Resend (fixing the old
  "unverifiable" dead end); one-click Community Cloud enable when it isn't
  on yet. The legacy secret-env-var path remains for Netlify/Vercel-only
  builders.
- Cloud tab: per-backend email status — sends today vs cap, from-address
  editing (no key re-paste needed), recent send history.
- AI guidance: with the vault connected, the model emits a `sendEmail()`
  fetch against the capability endpoint instead of generating
  `netlify/functions`/`api/` serverless code.

**What it unlocks:** transactional email — invites, notifications, digests,
contact-the-organizer — that works in the preview on day one, with zero
platform accounts.

**Hardening backlog:** move `app_secrets.secret` to Supabase Vault /
pgsodium (additive; invisible to callers), encourage domain-scoped
sending-only Resend keys in UI copy, `suspended` flag on `cloud_apps`
honored by both edge functions.

---

## Phase 2 — Managed structured data (typed collections)

Real data modeling on RTP's Supabase — without running AI-generated SQL on a
shared database.

**Recommendation: extend the jsonb document store into typed collections,
not schema-per-app SQL.** A privileged DDL-runner on shared Postgres is the
single scariest capability we could build: it demands a perfect (not merely
good) SQL linter, produces catalog bloat at thousands of schemas, and lands
every rollback/drift incident on RTP ops. Typed collections keep the existing
trust model — deny-all RLS, service-role mediation, `app_id` scoping — and
the AI already speaks `cloudRequest()`.

- `app_collections` (app_id, name, schema jsonb, version): a declarative
  field spec — types, required, unique, indexed — plus per-collection
  visibility/write rules (the RLS rules from the Supabase guidance, restated
  as spec assertions).
- Server-side validation on create/update; a `query` action with typed
  filters/sort/cursor compiled to PostgREST jsonb operators; uniqueness via
  partial expression indexes on `app_documents`.
- **The spec is a project file** (`cloud-schema.json`) the AI edits like any
  other file. A post-generation hook (ChatPanel `onComplete`, where quality
  review already runs) reconciles it idempotently against the server. The
  server is the source of truth; no applied-migration ledger threads through
  project-store / local-projects / cloud sync.
- Linting becomes assertion-checking on a declarative spec (deterministic,
  security-scan style) — not SQL parsing. Destructive changes (dropping a
  field, tightening a type) require explicit builder confirmation; rollback
  is re-applying a prior spec version.
- Raise quotas per tier as needed; byte metering and doc caps already exist.

**What it unlocks for the benchmark app:** structured applications,
reflections, and status pipelines with real queries — the microgrant program's
data layer — still zero-signup.

*(Open decision: owner sign-off on collections-over-SQL for the shared
instance. Schema-per-app is documented here as considered and deferred;
builders who genuinely need SQL graduate via Phase 3.)*

## Phase 3 — Builder-owned Supabase, automated

The graduation path: the builder's own Supabase project, with Relational
Builder as its operator. This is Lovable-managed-Supabase parity with better
ownership.

- **One-time connect:** paste a Supabase personal access token (OAuth app
  later) → stored in a `builder_secrets` vault keyed by builder identity
  (tokens span projects) → pick a project via `GET /v1/projects`.
- **New builder-authed edge function `supabase-admin`:** `apply_migrations`
  (Management API `/database/query`), `deploy_function` (multipart
  `/functions/deploy`), `set_secrets` (`/secrets`) — the exact recipes this
  repo already uses to deploy itself.
- **Client flow:** the post-generation hook detects `supabase/migrations/*.sql`
  in applied files (github-sync's `analyzeActionsNeeded` already detects
  these — its "paste into the SQL editor" advice becomes an automated apply)
  → deterministic pre-apply linter (RLS enabled on every CREATE TABLE,
  per-action policies, no `USING (true)` on UPDATE/DELETE, no service_role
  references) → plain-language SQL preview dialog → apply.
- **Drift and idempotency:** a `_rb_migrations` ledger table (filename +
  hash) lives in the *builder's* database, so applied-state is queryable
  from anywhere and survives device changes; a drift check runs before every
  apply.
- **Convention change at phase start:** AI guidance moves from a single
  `supabase-schema.sql` to versioned `supabase/migrations/NNNN_name.sql`
  files (already the detected convention in GitHub sync).

**Risks:** PATs are all-projects scoped (acceptable v1 tradeoff, OAuth
narrows it later); destructive SQL (linter + preview + ledger); support
burden when builders hand-edit their DB (that's what the drift check is for).

**What it unlocks:** real relational data, real auth, the builder's own edge
functions and secrets — full parity, builder-owned, exportable.

## Phase 4 — Capability family + hosting maturity

- Vaulted BYO keys behind `llm-proxy` → in-app AI features that work in
  preview and community hosting (llm-proxy's identity gating and metering
  already exist; add app-scoped auth against the vault).
- Same capability pattern for Firecrawl (scraping) and Twilio (SMS nudges).
- Community hosting stays static; custom domains on community-hosted sites
  (CNAME + host-header routing) as a stretch goal.

---

## Sequencing and cross-cutting concerns

**Sequencing:** Phase 1 ✅ → Phase 2 and Phase 3 are independent and can
proceed in either order (2 serves the zero-signup majority; 3 serves the
power minority); Phase 4 items slot in on demand.

**Abuse:** daily caps and rate limits per app; `members_only_send` for
neighbor-gated sending; a `suspended` flag on `cloud_apps` gives one switch
that both edge functions honor.

**Cost posture:** email and AI spend ride builder-owned keys by design; RTP
carries storage and function execution, both bounded by existing quotas.

**Key blast radius:** vault values are write-only and deny-all at the DB
layer; UI copy steers builders toward domain-scoped, sending-only keys;
Supabase Vault encryption is the standing hardening item.

**The benchmark app, phase by phase:** Phase 1 gives it applicant
notifications and reviewer emails in the preview; Phase 2 gives it
applications/reflections as typed collections with queries; Phase 3 gives it
its own database with the full 11-table relational schema, applied
automatically; Phase 4 adds AI-assisted review and SMS reminders.
