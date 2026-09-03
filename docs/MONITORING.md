# Community Plan Monitoring & Alerts

*Shipped 2026-07-31. Companion to [COMMUNITY-LIMITS.md](./COMMUNITY-LIMITS.md).*

The `community-monitor` edge function runs every 15 minutes (pg_cron →
pg_net → function, shared secret held in Vault) and emails
**josh@relationaltechproject.org** when either of two things needs
attention — plus site-health emails to builders (§3). No dashboard to
check — quiet until it matters.

## 1. Daily spend alerts ($5, then $10)

Estimated subsidized spend for the current UTC day is computed from
`community_usage` token counts. As each threshold is crossed
(`MONITOR_SPEND_THRESHOLDS`, default `5,10` USD), one email goes out —
once per threshold per day, deduped in `monitor_alerts` — with the
per-member breakdown (requests, tokens, model mix, estimated cost).

**How the estimate works.** Since 2026-08-19 the llm-proxy records a
per-(email, day, model) breakdown in `community_usage_models`, and the
estimate prices each model at its own rates (`MODEL_RATES` in the
function): Fable $10/$50 per MTok, Opus $5/$25, Sonnet $3/$15, Haiku
$1/$5 — so a builder who picks Fable 5 projects at Fable prices instead
of understating by half. Cache writes price at the 1-hour rate (2×
input; the proxy sets `ttl: '1h'` on every breakpoint) and cache reads
at 0.1× (Fable 5.1: $0.25 per MTok, its listed rate), using the separately-recorded `cache_creation_tokens` /
`cache_read_tokens` — so prompt caching, most of a build conversation's
input, is priced at its real rate rather than inflating the estimate
3–5×. Any usage the aggregate holds beyond the model rows (recorded
before the breakdown existed, or via outage-fallback providers) prices
at Opus-class fallback rates and shows as "untracked" in the alert.

## 2. Supabase tier recommendation

Each run also samples instance health from two sources:

- `monitor_db_stats()` (SQL): database size, connection count vs
  `max_connections`, buffer cache hit ratio.
- The instance's Prometheus endpoint
  (`/customer/v1/privileged/metrics`): RAM available, swap usage, load
  average, data-disk fill.

Pressure signals: RAM available < 15%, swap > 60% used, load1 > 1.5× core
count, connections > 70% of max, cache hit < 98% (on a ≥500 MB database),
disk > 80% full. A single hot sample never alerts — pressured samples are
recorded in `monitor_infra_samples`, and the "consider bumping past
Micro" email sends only when **≥3 pressured samples land within 2 hours**,
with a 72-hour cooldown between recommendations.

## 3. Site health emails (to builders, not the steward)

The error beacon injected into every served community site posts runtime
errors back to the `site` function, deduplicated into `site_errors`. When
a site accumulates ≥3 errors in a day (`MONITOR_SITE_ERROR_MIN`), its
**builder** gets one plain-language "your site hit some errors today"
email, at most once per 72 hours per site.

**Noise filtering (added 2026-08-21).** Errors thrown by a *visitor's*
browser extensions — crypto-wallet injections (MetaMask etc.), redacted
cross-origin `Script error.`, `ResizeObserver loop` chatter — are not the
builder's to fix and used to trigger false alarms. The beacon drops them
client-side (including anything originating from a
`chrome-extension://`-style URL), so they never leave the visitor's
browser; `community-monitor` applies the same message denylist as a
backstop for rows recorded before the filter (or by cached pages). The
two lists live in `ERROR_BEACON` (`supabase/functions/site/index.ts`) and
§3 of `community-monitor/index.ts` — keep them in sync.

## Operating it

```bash
# Manual check (never emails, never records):
curl -X POST "https://$REF.supabase.co/functions/v1/community-monitor" \
  -H "x-monitor-secret: $MONITOR_CRON_SECRET" \
  -H "Content-Type: application/json" -d '{"dry_run": true}'

# End-to-end email pipeline test (sends a status email, touches no alert state):
... -d '{"send_test_email": true}'
```

- **Secrets:** `MONITOR_CRON_SECRET` (required; also stored in Vault as
  `monitor_cron_secret` for the cron job), `RESEND_API_KEY` (shared with
  notify-invite), optional `MONITOR_ALERT_EMAIL`,
  `MONITOR_SPEND_THRESHOLDS`, `MONITOR_RATE_INPUT` / `_OUTPUT` /
  `_CACHE_WRITE` / `_CACHE_READ`.
- **Schedule:** `select jobname, schedule, active from cron.job;` — job
  `community-monitor`, `*/15 * * * *`. Recent deliveries:
  `select status_code from net._http_response order by id desc limit 5;`
- **Alert history:** `select * from public.monitor_alerts order by sent_at desc;`
- **Deploy:** via the Management API like every other function (see
  CLAUDE.md); the migration is `20260731000000_community_monitoring.sql`
  (its `{{MONITOR_CRON_SECRET}}` placeholder is substituted at apply time).

## Tuning

If the tier email arrives repeatedly after an upgrade, thresholds live in
`pressureSignals()` in `supabase/functions/community-monitor/index.ts`.
If the spend estimate drifts from the real Anthropic invoice: per-model
rates live in `MODEL_RATES` in the function (edit + redeploy); the
`MONITOR_RATE_*` secrets only override the fallback rates used for
usage with no recorded model.
