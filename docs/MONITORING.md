# Community Plan Monitoring & Alerts

*Shipped 2026-07-31. Companion to [COMMUNITY-LIMITS.md](./COMMUNITY-LIMITS.md).*

The `community-monitor` edge function runs every 15 minutes (pg_cron →
pg_net → function, shared secret held in Vault) and emails
**josh@relationaltechproject.org** when either of two things needs
attention. No dashboard to check — quiet until it matters.

## 1. Daily spend alerts ($5, then $10)

Estimated subsidized spend for the current UTC day is computed from
`community_usage` token counts. As each threshold is crossed
(`MONITOR_SPEND_THRESHOLDS`, default `5,10` USD), one email goes out —
once per threshold per day, deduped in `monitor_alerts` — with the
per-member breakdown (requests, tokens, estimated cost).

**How the estimate works.** Usage isn't recorded per model, so everything
is priced at Opus-class rates (the community default): $5/MTok input,
$25/MTok output, cache writes at 1.25×, cache reads at 0.1×. Sessions on
Sonnet/Haiku cost less than the estimate shows — it errs on the safe
side. The llm-proxy now records cache-creation and cache-read tokens
separately (`community_usage.cache_creation_tokens` / `cache_read_tokens`),
so prompt caching — most of a build conversation's input — is priced at
its real ~0.1× rate rather than inflating the estimate 3–5×.

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
If the spend estimate drifts from the real Anthropic invoice, adjust the
`MONITOR_RATE_*` secrets rather than editing code.
