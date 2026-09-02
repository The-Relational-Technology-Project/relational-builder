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
3. **Auth → URL Configuration**: set *Site URL* to your canonical production
   URL (e.g. `https://relationalbuilder.org`) and list every origin a magic
   link may return to under *Redirect URLs* — the canonical domain
   (`https://relationalbuilder.org/**`), any `*.vercel.app` preview you sign in
   from, and `http://localhost:5173` for local dev. **This is what decides
   where a magic link lands:** if the redirect target isn't allow-listed here,
   Supabase ignores it and falls back to *Site URL*, so a sign-in can end up on
   the wrong domain (e.g. the `*.vercel.app` URL instead of `.org`). The client
   pins its redirect to `VITE_SITE_URL` (see below).
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
| `ALLOWED_ORIGINS` | Comma-separated list of allowed browser origins. **List every origin the app is served from, including the canonical apex domain** — a missing origin is blocked by CORS. Entries may use a `*` wildcard (e.g. `https://*.vercel.app`) to cover preview deploys. Unset = allow all (dev). | unset |
| `RATE_LIMIT_PER_MIN` | Best-effort per-minute request cap, keyed per credential (community token or BYOK key) so a room on shared venue WiFi doesn't throttle itself; per-IP only for credential-less requests | `30` |
| `RATE_LIMIT_PER_MIN_PER_IP` | Loose per-IP backstop on credentialed traffic (bounds credential-rotation abuse from a single address) | `RATE_LIMIT_PER_MIN` × 20 |
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
supabase secrets set ALLOWED_ORIGINS="https://relationalbuilder.org,https://*.vercel.app,http://localhost:5173"
```

## 3. Email via Resend (relationalbuilder.org)

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
| Sender | `Relational Builder <hello@relationalbuilder.org>` |

**b) Invite notifications.** The `notify-invite` edge function sends a
branded email when someone adds a collaborator (includes the pilot passcode).
It no-ops until the key is set:

```bash
supabase functions deploy notify-invite --no-verify-jwt
supabase functions deploy request-project-access --no-verify-jwt
supabase secrets set RESEND_API_KEY=re_... APP_URL=https://relationalbuilder.org ACCESS_CODE=6767
```

**`APP_URL` is load-bearing, not cosmetic.** Every emailed link is built from
it, and the invite button carries `?invite=<project id>&to=<invited email>` so
the app can open the right project — or say which address the invitation was
for when you're signed in as a different one. Leave `APP_URL` unset and all of
that still works, but on whatever the fallback domain is, which is a *second
live copy of the app with its own session storage*: people click, land signed
in as someone else, and see nothing wrong. Set it.

`request-project-access` is what the "wrong account" screen uses to ask a
project's owner to invite the address you actually use. It grants nothing —
the owner still adds you from Share → Collaborate.

**c) Account requests (the open front door).** Anyone can request an
account from the passcode screen; the steward gets an email and approves
in the super admin dashboard (account menu → Account requests, visible to
`VITE_SUPER_ADMIN_EMAILS`). Approval creates the auth account + community
membership and sends the requester a welcome email — sign-in then just
works. Unapproved emails can't sign in: the sign-in form checks the
signin-gate function first and shows a friendly pointer to the request
form instead of sending a link.

```bash
# Run supabase/migrations/20260706010000_account_requests.sql in the SQL editor, then:
supabase functions deploy request-account --no-verify-jwt
supabase functions deploy admin-requests --no-verify-jwt
supabase functions deploy signin-gate --no-verify-jwt
supabase secrets set STEWARD_EMAIL=josh@relationaltechproject.org
```

Who counts as a steward lives in code, not in config: `STEWARD_EMAILS` in
`supabase/functions/admin-requests/index.ts`, mirrored by the same constant
in `src/cloud/account-requests.ts`. Adding or removing a steward is a
two-line PR plus a redeploy of both halves, which leaves a trace. The
`SUPER_ADMIN_EMAILS` secret and `VITE_SUPER_ADMIN_EMAILS` build var still
work and are *added* to that list (handy for a staging project) — neither
can shorten it, so a missing env var never locks the stewards out.

For the gate to be enforced (not just friendly UX), close public signups
at the Auth level — the app sends OTPs with `shouldCreateUser: false`, and
this stops raw API calls from creating accounts either (approval creates
users via the admin API, which is unaffected):

```bash
curl -s -X PATCH -H "Authorization: Bearer $SUPABASE_MGMT_TOKEN" \
  -H 'Content-Type: application/json' \
  https://api.supabase.com/v1/projects/YOUR_REF/config/auth \
  -d '{"disable_signup": true}'
```

Existing accounts are untouched — the gate only guards account creation.
NB for open events (see docs/EVENT-OWNER-TASKS-HANDOFF.md): walk-ins can
no longer self-serve sign in; pre-approve attendees or batch-approve
requests from the dashboard during the session.

**d) Referral codes (the self-serve door).** Every builder carries a
personal invite code (`profiles.referral_code`, shown on their Builder
Profile and at the end of onboarding, shareable as `APP_URL/?ref=CODE`).
A signup with a valid code is approved on the spot by `request-account`:
auth user + community membership created, welcome email out, steward gets
an FYI email instead of an approve ask — and the join still lands in the
dashboard's request history tagged with the code. The magic-link sign-in
that follows is the email confirmation (OTPs only ever reach the address
itself). Unrecognized codes fall back to the normal pending flow.
`profiles.referred_by_code` is stamped at first sign-in, and the
`my_referral_stats()` RPC powers the "N builders joined through your
code" count.

```bash
# Run supabase/migrations/20260807000000_referral_codes.sql in the SQL
# editor (backfills codes for existing builders), then redeploy:
supabase functions deploy request-account --no-verify-jwt
```

**e) Event codes + invite auto-join (hackathons and build-a-thons).**
A steward mints a code for a whole room (dashboard → Events): custom or
generated, optional expiry, deactivate any time. It opens the door
exactly like a builder's referral code — `APP_URL/?ref=CODE`, approved
on the spot — and stamps `profiles.event_code` on each joiner, which
powers the per-event joined counts and same-event connection
suggestions in chat. This replaces the walk-in caveat in (c): put the
event code on a slide and the room lets itself in.
Project invitations open the door the same way now: `signin-gate`
creates an invited address's account on the spot (a steward's decline
still outranks any invite) and the profile trigger credits the
inviter's referral code, so collaborator invites count in
`my_referral_stats()` and the dashboard's referral list.

```bash
# Run supabase/migrations/20260808000000_event_codes.sql in the SQL
# editor, then redeploy:
supabase functions deploy request-account --no-verify-jwt
supabase functions deploy signin-gate --no-verify-jwt
supabase functions deploy connect --no-verify-jwt
supabase functions deploy admin-requests
```

**f) Share Live + the demo wall.** Share → Share Live turns the current
build into a three-slide deck (title + one-liner, screenshot + features,
QR + live link) published as two unlisted preview links — no new server
pieces, it rides on publish-site and story-photos. Event participants can
pin the result to their event's demo wall, a public section in the
Commons Gallery backed by `event_showcase` (RLS + column grants keep the
event *code* write-only for clients; everything else is public). The
steward's Events tab also gets a printable "room key" page per code —
all client-side.

```bash
# Run supabase/migrations/20260808120000_event_showcase.sql in the SQL
# editor. No function deploys needed.
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
- `VITE_SITE_URL` — canonical domain magic-link sign-in returns to
  (`https://relationalbuilder.org`). Set this so sign-ins from a preview URL
  still land on the real domain; must also be in Supabase's Redirect URLs.
- `VITE_SUPER_ADMIN_EMAILS` (optional — extra addresses that see the Steward
  dashboard, on top of the `STEWARD_EMAILS` list in `src/cloud/account-requests.ts`)
- `VITE_RTP_MODEL_URL` (optional — Tier 1 model endpoint)

For a custom domain, add it in Vercel and remember to add the same origin to
the proxy's `ALLOWED_ORIGINS` and Supabase Auth's *Site URL*.

### Redeploying after a change

**Pushing to `main` deploys.** Vercel's Git integration is attached to this
repo, so a push to `main` builds and promotes to production on its own — there
is no workflow file here because none is needed. A doc-only commit deploys too;
any push to `main` does.

That makes a stale production site a *deploy failure*, not a missing step.
Production is a static build baked at deploy time, so when a change is on `main`
but the live site still shows the old behaviour, open the project's
**Deployments** tab and look for a build that errored — that is where the change
stopped. Reach for a cache explanation only after ruling that out. (This has
happened: the Connections page served a section for two days after it was
deleted from the source, because the deploy for that commit never landed.)

The live bundle is fingerprinted, so you can check what's deployed without
trusting a browser cache:

```bash
# which chunk is the site serving right now
curl -s https://relationalbuilder.org/ | grep -o 'src="[^"]*\.js"'
# then fetch the chunk your change touched and grep for a string it added or removed
curl -s https://relationalbuilder.org/assets/ConnectionsPage-XXXX.js | grep -c "Some removed string"
```

The chunk names change on every build, so start from the entry point and follow
it to the chunk you care about.

To force a deploy without a code change, push an empty commit:

```bash
git commit --allow-empty -m "Redeploy" && git push origin main
```

Or ship from your machine, which also works when the Git integration is the
thing that's broken:

```bash
npm i -g vercel   # once
vercel login      # once
vercel link       # once — pick the existing relational-builder project
vercel --prod
```

`vercel --prod` uploads the source and builds *on Vercel*, so it picks up the
Environment Variables configured above. Don't reach for `--prebuilt` unless
every `VITE_*` var is set in your local shell first — Vite bakes them in at
build time, so a prebuilt deploy with vars missing ships a working-looking app
with no backend attached.

One trap in the dashboard: **Redeploy rebuilds the source of the deployment you
clicked on**, not the current `main`. If the newest deployment is the stale one,
redeploying it faithfully reproduces the stale build. Check the commit shown on
the deployment before using that button, or push instead.

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
