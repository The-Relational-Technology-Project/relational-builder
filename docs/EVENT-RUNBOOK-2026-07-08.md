# Build Jam Runbook — Neighborhood Tech Build Jam, July 8 2026

Getting ~56 people (mostly non-technical, on phones and laptops, all on one
venue WiFi) from the door to a working tool inside a 45-minute build block.
This is the checklist for the code shipped on July 7 plus the dashboard
settings that can't live in the repo.

## The attendee path (what you're setting up)

1. Scan the QR / open **`https://relationalbuilder.org/?code=EVENTCODE`** —
   the passcode gate opens itself, no typing.
2. Tap **Sign in**, enter email, then **type the 6-digit code from the
   email** (no more "the link opened in the wrong browser" stranding).
3. Signing in + holding the passcode auto-enrolls them in free community
   building (Claude Opus 4.8, per-person daily budget). Quick profile
   (~1 min), then build.
4. **Publish → Community hosting** gives a live URL on their phone;
   the commons card underneath offers it back to the network.

## Before the event — deploy (≈15 min)

**1. Mint the event code.** Pick something sayable from a stage, e.g.
`BUILDJAM`. It's case-insensitive. Then set it in BOTH places:

- Supabase secret (server, checked by enroll-community):
  ```bash
  supabase secrets set ACCESS_CODE="6767,BUILDJAM"
  ```
- Vercel env var (client gate): `VITE_ACCESS_CODE=6767,BUILDJAM`, then
  **redeploy** (Vite bakes it in at build time).

**2. Deploy the two changed edge functions:**

```bash
supabase functions deploy llm-proxy --no-verify-jwt        # per-credential rate limit (venue-WiFi fix)
supabase functions deploy enroll-community --no-verify-jwt  # multi-code support
```

**3. Supabase Auth dashboard** (project `texakzqqenzpxawktbgx`):

- **Magic-link email template** (Authentication → Emails → Magic Link):
  make sure the body includes the 6-digit code, e.g. add
  `<p>Or type this code: {{ .Token }}</p>`. **The new code-entry box is
  only useful if the email actually shows the code.** Keep the link too —
  both work.
- **Email rate limit** (Authentication → Rate Limits): raise "emails sent
  per hour" to **≥200** for the evening — 56 people signing in between
  6:15 and 7:00 will blow through a default of 30/hr. (SMTP is already
  Resend, so the 4/hr built-in cap doesn't apply, but this dashboard
  limit still does.)
- **Signups allowed**: confirm new emails can sign in (Authentication →
  Sign In / Up → email provider — don't require pre-existing users).
- **OTP expiry**: default 1 hour is fine.

**4. Check the proxy's model allowlist matches the UI default.** The app
steers community members to `claude-opus-4-8`; if the secret still has the
old default, every build 403s:

```bash
supabase secrets set COMMUNITY_MODELS="claude-opus-4-8,claude-sonnet-5,claude-haiku-4-5"
```

**5. Load test (the brief's one prep step).** Sign in at
relationalbuilder.org, grab your session token, and run:

```bash
RB_SESSION_TOKEN=<token> RB_CONCURRENCY=8 node scripts/event-load-test.mjs
```

Green: 8/8 succeed, first token in a few seconds. The script calls out the
two known failure signatures (403 = model allowlist; 429 = rate limit /
Anthropic key limits) with what to do about each.

**6. Budget & cost sanity.** Each member gets `daily_token_budget` tokens
(combined in+out) per day — check the current default on the
`community_members` table. Free community building now steps down
automatically: Opus 4.8 does each project's first build, then edits default
to Sonnet 5 (~5× cheaper; a chat note explains the switch, and anyone can
pin Opus back for a big change). Napkin math for 56 people: one Opus first
build ≈ 100–200k tokens ≈ $2–6 each, with the edit tail on Sonnet — a
realistic room-scale evening lands in the low hundreds of dollars worst
case. If that's still too hot, lower per-member budgets for the batch you
enroll tomorrow (`update community_members set daily_token_budget = …`).

**7. Anthropic key headroom.** Check the community key's org rate-limit tier
at console.anthropic.com — a dozen simultaneous Opus streams with 64k
max_tokens can brush output-TPM limits on lower tiers. The client now
retries 429/529 with backoff and shows "lots of building happening right
now," so brief spikes feel like a pause, not a failure — but tier 2+ is
where you want to be.

## The slide

- **`relationalbuilder.org/?code=BUILDJAM`** big, plus a QR of the same URL.
- "Sign in with your email → type the 6-digit code from the email."
- "Tell it what your block needs. Plain words. It builds; you steer."
- "Done? Publish → Community hosting → show your neighbor."

## During the event — triage cheat sheet

| Symptom | What it is | Move |
|---|---|---|
| "Lots of building happening right now…" in chat | Automatic retry (shared key busy) | It resolves itself; if constant, switch the room to Sonnet 5 |
| "You've reached today's community building budget" | Personal daily cap hit | Raise that person's `daily_token_budget` in SQL, effective immediately |
| Sign-in email not arriving | Email rate limit or spam folder | Check Auth rate limit; have them search "Relational Builder"; the code and the link both work |
| "This email isn't part of the community pilot" | Auto-enroll didn't fire (they signed in without entering the passcode first) | Have them sign out is NOT needed: enter the passcode via `?code=` link again, reload — or insert their email into `community_members` |
| Publish button greyed out | Not signed in | Sign in (top right) — publishing needs it |
| "It's live but my fix isn't showing" | 60s cache on republished sites | Wait a minute, hard-refresh the phone |
| Someone burns their 3 community sites | Renames create new sites | Republish using the SAME name to replace; or bump `MAX_SITES_PER_BUILDER` |

**Fallback (decided before you're on the mic, per the brief):** if the
builder itself struggles, route groups to RT Studio remixing
(studio.relationaltechproject.org) and pair Lovable-account-holders with
groups. The load test above is what makes this unlikely.

## After the event

- Retire the event code: remove `BUILDJAM` from the `ACCESS_CODE` secret and
  from `VITE_ACCESS_CODE` (+ redeploy). Standing invite code keeps working.
- Skim `community_usage` for the day — real numbers for the next event's
  budget math.
- Restore the email rate limit if you raised it.
- Captains follow-up: everyone who signed in tonight is in `profiles` with
  a neighborhood — that's your captain-pipeline list.
