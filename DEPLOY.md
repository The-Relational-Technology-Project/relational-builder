# Deploying Relational Builder

The builder is a static Vite app plus two pieces of Supabase infrastructure:

1. **Builder backend** — a dedicated Supabase project for accounts, cloud
   projects, and collaboration (magic-link auth + Postgres + Realtime)
2. **LLM proxy** — a Supabase Edge Function that routes model calls
   server-side (CORS-free, keys never touch third-party pages)

The RTS Studio knowledge base is a *separate, read-only* Supabase project —
nothing in this guide touches it.

## 1. Create the Builder Supabase project

1. Go to [database.new](https://database.new) and create a project
   (suggested name: `relational-builder`).
2. Open the **SQL editor** and run the entire contents of
   [`supabase/migrations/20260702000000_builder_core.sql`](supabase/migrations/20260702000000_builder_core.sql).
   This creates `profiles`, `projects`, `project_members`, all RLS policies,
   the invite-linking triggers, and adds `projects` to the Realtime publication.
3. **Auth → URL Configuration**: set *Site URL* to your production URL
   (e.g. `https://builder.relationaltechproject.org`) and add
   `http://localhost:5173` to *Redirect URLs* for local dev.
   Magic-link email sign-in is enabled by default; no other providers needed.
4. **Settings → API**: copy the *Project URL* and *anon public* key into your
   env:

   ```bash
   VITE_BUILDER_SUPABASE_URL=https://YOUR_REF.supabase.co
   VITE_BUILDER_SUPABASE_ANON_KEY=eyJ...
   ```

Without these two vars the builder runs in local-only mode (localStorage) —
cloud features simply don't appear.

> **Email note:** Supabase's built-in email service is fine for pilots but
> rate-limited (~4 emails/hour). For production, plug Resend into
> Supabase Auth (Settings → Auth → SMTP) with an RTP sending domain.

## 2. Deploy the LLM proxy

The proxy can live on the same Builder project (recommended — one backend):

```bash
supabase login
supabase link --project-ref YOUR_REF
supabase functions deploy llm-proxy --no-verify-jwt
```

Then set the env var:

```bash
VITE_LLM_PROXY_URL=https://YOUR_REF.supabase.co/functions/v1/llm-proxy
```

### Proxy hardening (production)

Set these as Edge Function secrets (`supabase secrets set KEY=value`):

| Secret | Purpose | Default |
|---|---|---|
| `ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins. Unset = allow all (dev). | unset |
| `RATE_LIMIT_PER_MIN` | Best-effort per-IP request cap per minute | `30` |
| `RTP_MODEL_URL` | Base URL of the RTP-hosted vLLM instance (Tier 1) | `https://api.relationaltech.org` |
| `ANTHROPIC_COMMUNITY_KEY` | RTP's shared Anthropic key for the community pilot (Tier 3). Never reaches the browser. | unset (community access off) |
| `COMMUNITY_MODELS` | Models the community key may be used with | `claude-sonnet-5,claude-haiku-4-5` |

### Community access pilot (Tier 3)

With `ANTHROPIC_COMMUNITY_KEY` set, invited builders get free Claude without
their own key. The proxy verifies their Builder sign-in, checks the allowlist,
enforces a per-person daily token budget, and meters usage. Invite builders in
the SQL editor:

```sql
insert into public.community_members (email, note) values
  ('builder@example.org', 'July 2026 pilot cohort');
```

Watch spend per person per day in `community_usage`. The default budget is
750k tokens/day (≈ $3–6/day ceiling per person at Sonnet 5 intro pricing);
adjust `daily_token_budget` per member as needed. Rough pilot math: 10
builders, a few sessions a week ≈ $50–200/month total.

Example:

```bash
supabase secrets set ALLOWED_ORIGINS="https://builder.relationaltechproject.org,http://localhost:5173"
```

## 3. Email via Resend (relationalbuilder.xyz)

Two separate email paths, both through the verified Resend domain:

**a) Auth emails (magic links).** Supabase's built-in mailer caps at ~4
emails/hour — not enough for a pilot. In the Supabase dashboard:
*Authentication → Emails → SMTP Settings*, enable custom SMTP with:

| Field | Value |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | *your Resend API key* |
| Sender | `Relational Builder <hello@relationalbuilder.xyz>` |

**b) Invite notifications.** The `notify-invite` edge function sends a
branded email when someone adds a collaborator (includes the pilot passcode).
It no-ops until the key is set:

```bash
supabase functions deploy notify-invite --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_... APP_URL=https://relational-builder.vercel.app ACCESS_CODE=6767
```

## 4. Deploy the builder itself (Vercel)

```bash
vercel --prod
```

Set these Environment Variables in the Vercel project (then redeploy —
Vite bakes them in at build time):

- `VITE_BUILDER_SUPABASE_URL`
- `VITE_BUILDER_SUPABASE_ANON_KEY`
- `VITE_LLM_PROXY_URL`
- `VITE_ACCESS_CODE` — pilot passcode gate (client-side, soft)
- `VITE_RTP_MODEL_URL` (optional — Tier 1 model endpoint)

For a custom domain, add it in Vercel and remember to add the same origin to
the proxy's `ALLOWED_ORIGINS` and Supabase Auth's *Site URL*.

## 5. Community Hosting

Built apps deploy free to RTP-hosted community hosting (3 sites per
builder, paid by RTP for the pilot):

```bash
supabase functions deploy publish-site --no-verify-jwt
supabase functions deploy site --no-verify-jwt
```

Run `supabase/migrations/20260702030000_community_hosting.sql` in the SQL
editor. Sites serve at `{APP_URL}/s/{slug}/` via the `vercel.json` rewrite
(and directly at `.../functions/v1/site/{slug}/`). Visits are counted
daily per site in `site_stats` — no cookies, no visitor tracking. Adjust
the per-builder cap via `MAX_SITES_PER_BUILDER` in publish-site.

## 6. Smoke test

1. Open the deployed URL → Settings → add a Claude API key → send a build
   message → files appear + preview renders.
2. Toggle **Plan** mode → ask for something → structured plan, no files
   created → **Build this plan** generates the files.
3. **Sign in** with your email → magic link lands you back signed in.
4. **Projects** → save the workspace → open it from another browser/device.
5. Invite a second email as editor → sign in with it elsewhere → the project
   is listed under "shared with you"; edits sync within seconds.
6. **Services** tab → connect Supabase/Resend/Firecrawl → ask the AI to use
   them → generated code reads `env.*` and creates serverless functions for
   secrets.
7. **Publish** → Download: zip contains `.reltech.yml` with `version: 2`
   (and a `lineage:` block if the project started from an imported plan).
