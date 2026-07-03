# Security review — 2026-07-03 (pre-pilot)

A defensive review before Relational Builder accepts real community data. Two
areas were audited in depth: every Supabase edge function (authorization +
injection) and every Row-Level-Security policy across all migrations. Plus the
client's secret handling and the community-hosting serving path.

**Overall:** the data model is sound. Every table has RLS enabled; no table is
open to the anon key by accident; every secret-bearing table (sign-in codes,
sessions, app keys, member lists, connection requests, community-member and
usage rows) is service-role-only. Three code-level issues were found and fixed.
One infrastructure item remains and is the single thing to resolve before
inviting neighbors to log into hosted apps.

## Fixed (verified live) — commit 7d12c14

| Sev | Issue | Fix |
|---|---|---|
| Critical | `app-data` interpolated the client-supplied `app_id` into PostgREST filters without encoding. A crafted `app_id` could smuggle extra query operators (`&`, `=`, `()`) and defeat the per-app tenant isolation the whole Community Cloud rests on. | `encodeURIComponent` on every `app_id` filter. Verified: injection-laden `app_id` → 403; legit → 200. |
| High | Neighbor sign-in codes are 6 digits with a 10-minute life and had **no verify-attempt cap** — brute-forceable by anyone holding a public `app_id`+`app_key`, targeting a known email. | `app_login_codes.attempts` column; capped at 6 wrong guesses per issued code, then the code is burned. Verified: 6×403 then 429. |
| Medium | The `prompts` "shared read" RLS policy exposed `owner_id` (a stable `auth.users` UUID) to the anon key — RLS gates rows, not columns. | Column-level `SELECT` grant keeps `owner_id` server-side while the remixable fields (title, body, slug, author_name, lineage) stay public. Client no longer selects it. Verified: anon `owner_id` → permission denied; safe columns → ok. |
| Low | `profiles` UPDATE policy had no `WITH CHECK`. | Added `with check (id = auth.uid())`. |

## Open — resolve before neighbors log into hosted apps

### Community-hosted sites share an origin with the builder app (and with each other)

**What:** Hosted sites are served at `https://relationalbuilder.xyz/s/<slug>/`
via a Vercel proxy (added when we fixed the text/plain rendering bug). Because
they run on the **same origin** as the builder app, a malicious published site's
JavaScript can read `localStorage` for that origin — which includes:
1. a logged-in **builder's Supabase session token** (account takeover), and
2. **neighbor `member_token`s** that *other* community apps stored on the shared
   origin (cross-app impersonation).

**Why it exists:** before the proxy, sites were served from
`texakzqqenzpxawktbgx.supabase.co` — a *different* origin from the app, so this
risk didn't exist, but pages rendered as source text (Supabase's gateway
sanitizes `text/html`). The proxy fixed rendering by moving serving onto the
app's own domain, which reintroduced same-origin access.

**Realism for the pilot:** requires a malicious builder to publish exfil JS
*and* get a logged-in builder (or a neighbor of another app) to open that
specific site. Not mass-exploitable, but real — and Josh browsing the gallery is
a plausible victim. This is the classic "user content on the apex domain"
problem GitHub solves with `github.io` and Lovable with per-project subdomains.

**Fix (needs DNS + Vercel — Josh):**
- **Phase 1 (must-do, closes builder-token theft):** serve all hosted sites from
  a dedicated origin off the apex, e.g. `sites.relationalbuilder.xyz`. Attach the
  subdomain to the Vercel project and move the `/s/:path` rewrite so it only
  answers on that host; make the apex refuse `/s/`. A different origin can't read
  the app's `localStorage`. The `api/site.ts` proxy code is unchanged — only the
  host it answers on moves.
- **Phase 2 (closes cross-app neighbor tokens):** per-slug subdomains
  (`<slug>.sites.relationalbuilder.xyz`) with a wildcard cert, so no two hosted
  apps share an origin either. Follow-up after Phase 1.

Until Phase 1 ships, treat hosted-site URLs as you would any user-published
page: don't open an untrusted builder's site in the same browser profile you're
signed into Relational Builder with.

## Accepted risks (documented, fine for an invited pilot)

- **In-memory rate limits** in `llm-proxy` (per-IP) and `app-data` (per-app) are
  per-warm-isolate, so they're best-effort backstops against loops/casual abuse,
  not hard guarantees. Durable limits would need a shared store (Postgres/Redis).
- **The RTP Tier-1 model relay** (`proxyRTP`) is an unauthenticated, IP-throttled
  passthrough — only relevant once `RTP_MODEL_URL` points at a real hosted model
  (it doesn't today).
- **The invitation passcode** (`VITE_ACCESS_CODE`) ships in the client bundle by
  design — it's a soft speed-bump, not a security boundary. `enroll-community`
  gates on the same value, so "invited" means "holds the passcode." Move to
  per-person invite tokens if the pilot widens.
- **`notify-invite`** lets an invited builder send branded email to arbitrary
  addresses (20/day soft cap) — limited spam potential from a verified domain.

## Confirmed safe

- No real secrets in tracked source (only RLS-guidance text and the
  security-scanner's own pattern list match secret-shaped strings).
- `.env` is gitignored; only publishable/anon keys reach the client (public by
  design).
- All AI/feedback/prompt/directory content is rendered through React (auto-
  escaped) — no `dangerouslySetInnerHTML` on untrusted input. The one injected
  HTML widget (`site` feedback) strips angle brackets from the only interpolated
  value.
- The publish-time security scan (secret/PII patterns) already warns builders
  before anything secret-shaped ships in a published site.
