# Build Jam owner tasks — handoff for a local Claude Code session

Companion to `docs/EVENT-RUNBOOK-2026-07-08.md`. These are the pre-event
steps that need owner credentials (Supabase CLI login, and optionally
Vercel). A local Claude Code session with `supabase` CLI access can do
nearly all of it. Project ref: `texakzqqenzpxawktbgx`.

Prereqs: `supabase login` completed (or `SUPABASE_ACCESS_TOKEN` set).
The Management API calls below use that same token:
`TOKEN=$(supabase auth token 2>/dev/null || echo "$SUPABASE_ACCESS_TOKEN")`
— if `supabase auth token` isn't a command in your CLI version, read the
token from `~/.supabase/access-token`.

## 1. Deploy the two changed edge functions (required)

```bash
supabase link --project-ref texakzqqenzpxawktbgx
supabase functions deploy llm-proxy --no-verify-jwt
supabase functions deploy enroll-community --no-verify-jwt
```

Verify llm-proxy is alive after deploy (expect a JSON error, NOT a 5xx):

```bash
curl -s -X POST https://texakzqqenzpxawktbgx.supabase.co/functions/v1/llm-proxy \
  -H 'Content-Type: application/json' -H 'x-llm-provider: anthropic' \
  -H 'x-community-token: bogus' -H 'Origin: https://relationalbuilder.org' \
  -d '{"model":"claude-sonnet-5","stream":false,"messages":[{"role":"user","content":"hi"}]}'
# → {"error":"Sign in to use community access"} with HTTP 401 = healthy
```

## 2. Secrets: event code + model allowlist (required)

```bash
# Event code alongside the standing invite code (case-insensitive)
supabase secrets set ACCESS_CODE="6767,BUILDJAM"

# The UI steers community members to Opus 4.8 — the allowlist must cover it
supabase secrets set COMMUNITY_MODELS="claude-opus-4-8,claude-sonnet-5,claude-haiku-4-5"
```

(`supabase secrets list` shows digests, not values — that's expected.)

## 3. Auth settings via the Management API (required)

Settings to PATCH: the email templates must include the 6-digit code (the
new code-entry UI depends on it), the email send rate must survive 56
sign-ins in ~45 minutes, and signups must be open.

**Both** email templates need the code, not just Magic Link. Supabase
sends the **Confirm signup** template (`mailer_templates_confirmation_content`)
to brand-new emails and Magic Link (`mailer_templates_magic_link_content`)
only to returning ones — at an event nearly everyone is new, so the
Confirmation template is the critical one. Also set `mailer_otp_length: 6`
to match the UI's "6-digit" copy (it defaults/drifted to 8 here).
`verifyOtp({type:'email'})` accepts the signup code either way — verified
end to end.

First GET the current config and inspect the existing magic-link template
so you edit rather than clobber it (field names can drift between API
versions — trust the GET response over this doc):

```bash
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.supabase.com/v1/projects/texakzqqenzpxawktbgx/config/auth \
  | jq 'to_entries | map(select(.key | test("magic|rate_limit_email|disable_signup"))) | from_entries'
```

Then PATCH (adapt the template field name to what the GET returned; keep
`{{ .ConfirmationURL }}` AND add `{{ .Token }}`):

```bash
curl -s -X PATCH -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  https://api.supabase.com/v1/projects/texakzqqenzpxawktbgx/config/auth \
  -d '{
    "rate_limit_email_sent": 300,
    "disable_signup": false,
    "mailer_templates_magic_link_content": "<h2>Sign in to Relational Builder</h2><p><a href=\"{{ .ConfirmationURL }}\">Tap to sign in</a> — or type this code in the app:</p><p style=\"font-size:24px;letter-spacing:4px\"><strong>{{ .Token }}</strong></p><p>This link and code expire in an hour. If you didn'\''t request this, ignore it.</p>"
  }'
```

Re-GET to confirm all three stuck. Then send yourself a real magic link
from relationalbuilder.org and check the email shows the 6-digit code.

## 4. Vercel: event code in the client gate (optional but nice)

The QR/slide link works TODAY with `?code=6767`. To use the friendlier
event code on the slide, add it client-side too:

```bash
# With Vercel CLI authenticated in this project:
vercel env rm VITE_ACCESS_CODE production -y 2>/dev/null
printf '6767,BUILDJAM' | vercel env add VITE_ACCESS_CODE production
vercel redeploy --prod   # or: vercel --prod
```

(Or dashboard: Project → Settings → Environment Variables, then redeploy.)
Verify: open `https://relationalbuilder.org/?code=BUILDJAM` in a private
window — it should land inside the app, not on the landing page.

## 5. Load test (required — the brief's one prep step)

Human step: sign in at relationalbuilder.org, grab your session token
(DevTools console):

```js
JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => k.endsWith('-auth-token')))).access_token
```

Then:

```bash
RB_SESSION_TOKEN=<token> RB_CONCURRENCY=8 node scripts/event-load-test.mjs
RB_SESSION_TOKEN=<token> RB_CONCURRENCY=8 RB_MODEL=claude-sonnet-5 node scripts/event-load-test.mjs
```

Green = 8/8 succeed on BOTH models with first tokens in a few seconds.
The script names the fixes for the two failure signatures (403 → model
allowlist; 429 → rate limits / key tier).

## 6. Quick spot-checks that today's fixes are live server-side

```bash
# enroll-community accepts the EVENT code (needs any signed-in session token):
curl -s -X POST https://texakzqqenzpxawktbgx.supabase.co/functions/v1/enroll-community \
  -H "Authorization: Bearer <session-token>" -H 'Content-Type: application/json' \
  -d '{"passcode":"buildjam"}'
# → {"ok":true,...} = multi-code deploy worked (case-insensitive on purpose)
```

## What still needs a human

- **Anthropic key headroom**: eyeball the community key's rate-limit tier
  at console.anthropic.com (Limits page). Tier 2+ is comfortable.
- **Grabbing your session token** for the load test (above).
- **Day-after cleanup** (see runbook): remove `BUILDJAM` from both
  `ACCESS_CODE` and `VITE_ACCESS_CODE`, restore the email rate limit.
