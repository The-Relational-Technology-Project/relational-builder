/**
 * Supabase Edge Function: community-monitor
 *
 * Watches two things and emails the steward when either needs attention:
 *
 *   1. Community plan spend — estimates today's (UTC) subsidized spend from
 *      community_usage token counts, priced per model where the llm-proxy
 *      recorded one (community_usage_models — Fable at Fable rates, Sonnet
 *      at Sonnet rates), and sends one email per day as each threshold is
 *      crossed ($5/day and $10/day by default).
 *   2. Supabase instance health — reads database stats (via the
 *      monitor_db_stats RPC) and the instance's Prometheus metrics endpoint,
 *      derives pressure signals, and recommends bumping compute past Micro
 *      when pressure is *sustained* (≥3 pressured samples in 2 hours), with
 *      a 72-hour cooldown between recommendations.
 *
 * Invoked every 15 minutes by pg_cron (see the community_monitoring
 * migration); can also be called manually. Auth is a shared secret:
 * the x-monitor-secret header must match the MONITOR_CRON_SECRET env
 * secret. Pass {"dry_run": true} to compute everything without sending
 * emails or recording alerts.
 *
 * Secrets/env:
 *   MONITOR_CRON_SECRET      — required; shared secret for callers
 *   RESEND_API_KEY           — email delivery (already set for notify-invite)
 *   MONITOR_ALERT_EMAIL      — default josh@relationaltechproject.org
 *   MONITOR_SPEND_THRESHOLDS — default "5,10" (USD/day)
 *   MONITOR_RATE_*           — overrides for the untracked-usage fallback
 *                              rates per MTok (see DEFAULT_RATES); per-model
 *                              rates live in MODEL_RATES in this file
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-monitor-secret',
};

// Since 2026-08-19 the llm-proxy records a per-(email, day, model) breakdown
// in community_usage_models, and each model prices at its own rates below —
// so a builder who picks Fable 5 ($10/$50 per MTok, double Opus) projects at
// Fable prices instead of quietly understating by half. Usage with no model
// row (recorded before the breakdown existed, or by an older proxy deploy)
// falls back to DEFAULT_RATES — Opus-class, the community default — which
// still errs on the safe side for Sonnet/Haiku sessions.
//
// Cache writes are priced at the 1-HOUR rate (2x base input), not the
// 5-minute one (1.25x): the llm-proxy sets ttl '1h' on every breakpoint,
// because builders think for longer than five minutes between turns and the
// short TTL had us re-writing the whole prompt every turn and never reading
// it back. The rows only carry a cache_creation_tokens total with no TTL
// attached, so pricing it at 1.25x here would quietly understate the bill on
// the one number these alerts exist to watch. Cache reads price at 0.1x.
const DEFAULT_RATES = {
  input: 5,
  output: 25,
  cacheWrite: 10,
  cacheRead: 0.5,
};

// Matched against the recorded model id, first hit wins (fable before opus
// etc. doesn't matter — the ids never overlap). Cache rates derive from the
// input rate per the 1h-write/0.1x-read reasoning above. Fallback-provider
// models (GPT/Gemini outage runs, Gemini image) match nothing and price at
// DEFAULT_RATES — safe-side, and rare enough not to matter.
const MODEL_RATES: { match: RegExp; input: number; output: number }[] = [
  { match: /fable|mythos/i, input: 10, output: 50 },
  { match: /opus/i, input: 5, output: 25 },
  { match: /sonnet/i, input: 3, output: 15 },
  { match: /haiku/i, input: 1, output: 5 },
];

interface Rates {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

function ratesForModel(model: string, fallback: Rates): Rates {
  const hit = MODEL_RATES.find((r) => r.match.test(model));
  if (!hit) return fallback;
  return {
    input: hit.input,
    output: hit.output,
    cacheWrite: hit.input * 2,
    cacheRead: hit.input * 0.1,
  };
}

interface TokenCounts {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

function priceTokens(t: TokenCounts, r: Rates): number {
  return (
    (t.input / 1e6) * r.input +
    (t.output / 1e6) * r.output +
    (t.cacheWrite / 1e6) * r.cacheWrite +
    (t.cacheRead / 1e6) * r.cacheRead
  );
}

// What "Micro" means, for signal thresholds and the email copy.
const MICRO = { ramGb: 1, cores: '2 (shared)' };

interface UsageRow {
  email: string;
  requests: number;
  input_tokens: number;
  output_tokens: number;
  cache_creation_tokens: number;
  cache_read_tokens: number;
}

interface ModelUsageRow extends UsageRow {
  model: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function env(name: string): string {
  return Deno.env.get(name) ?? '';
}

function rate(name: string, fallback: number): number {
  const v = Number(env(name));
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const cronSecret = env('MONITOR_CRON_SECRET');
  if (!cronSecret) return json({ error: 'Monitor is not configured (MONITOR_CRON_SECRET unset)' }, 503);
  if (req.headers.get('x-monitor-secret') !== cronSecret) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = env('SUPABASE_URL');
  const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing Supabase credentials' }, 503);

  let dryRun = false;
  let testEmail = false;
  try {
    const body = await req.json();
    dryRun = body?.dry_run === true;
    // Smoke-test lever: sends a status email through the real delivery path
    // without touching alert state. Also skips alert sends (like dry_run).
    testEmail = body?.send_test_email === true;
    if (testEmail) dryRun = true;
  } catch {
    // empty body is fine
  }

  const svc = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
  const alertEmail = env('MONITOR_ALERT_EMAIL') || 'josh@relationaltechproject.org';
  const sent: string[] = [];
  const errors: string[] = [];

  // ── 1. Spend ──────────────────────────────────────────────────────────

  const today = new Date().toISOString().slice(0, 10);
  const rates = {
    input: rate('MONITOR_RATE_INPUT', DEFAULT_RATES.input),
    output: rate('MONITOR_RATE_OUTPUT', DEFAULT_RATES.output),
    cacheWrite: rate('MONITOR_RATE_CACHE_WRITE', DEFAULT_RATES.cacheWrite),
    cacheRead: rate('MONITOR_RATE_CACHE_READ', DEFAULT_RATES.cacheRead),
  };

  let rows: UsageRow[] = [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/community_usage?day=eq.${today}` +
        `&select=email,requests,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens`,
      { headers: svc },
    );
    if (res.ok) rows = await res.json();
    else errors.push(`usage query failed (${res.status})`);
  } catch (err) {
    errors.push(`usage query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // Per-model breakdown — lets the estimate price Fable at Fable rates.
  // Missing table / empty rows degrade to the aggregate at DEFAULT_RATES.
  let modelRows: ModelUsageRow[] = [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/community_usage_models?day=eq.${today}` +
        `&select=email,model,requests,input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens`,
      { headers: svc },
    );
    if (res.ok) modelRows = await res.json();
    else errors.push(`model usage query failed (${res.status})`);
  } catch (err) {
    errors.push(`model usage query failed: ${err instanceof Error ? err.message : String(err)}`);
  }
  const modelRowsByEmail = new Map<string, ModelUsageRow[]>();
  for (const r of modelRows) {
    const list = modelRowsByEmail.get(r.email) ?? [];
    list.push(r);
    modelRowsByEmail.set(r.email, list);
  }

  const counts = (r: UsageRow): TokenCounts => ({
    input: Number(r.input_tokens ?? 0),
    output: Number(r.output_tokens ?? 0),
    cacheWrite: Number(r.cache_creation_tokens ?? 0),
    cacheRead: Number(r.cache_read_tokens ?? 0),
  });

  const memberSpend = rows
    .map((r) => {
      const total = counts(r);
      // Price each recorded model at its own rates; whatever the aggregate
      // holds beyond the model rows (older proxy deploys, pre-migration
      // usage) prices at the default Opus-class rates.
      const models: { model: string; usd: number }[] = [];
      const residual = { ...total };
      for (const m of modelRowsByEmail.get(r.email) ?? []) {
        const t = counts(m);
        residual.input = Math.max(0, residual.input - t.input);
        residual.output = Math.max(0, residual.output - t.output);
        residual.cacheWrite = Math.max(0, residual.cacheWrite - t.cacheWrite);
        residual.cacheRead = Math.max(0, residual.cacheRead - t.cacheRead);
        models.push({ model: m.model, usd: priceTokens(t, ratesForModel(m.model, rates)) });
      }
      if (residual.input + residual.output + residual.cacheWrite + residual.cacheRead > 0) {
        models.push({ model: 'untracked', usd: priceTokens(residual, rates) });
      }
      models.sort((a, b) => b.usd - a.usd);
      return {
        email: r.email,
        requests: Number(r.requests ?? 0),
        tokens: total.input + total.output + total.cacheWrite + total.cacheRead,
        usd: models.reduce((sum, m) => sum + m.usd, 0),
        models,
      };
    })
    .sort((a, b) => b.usd - a.usd);
  const totalSpend = memberSpend.reduce((sum, m) => sum + m.usd, 0);

  const thresholds = (env('MONITOR_SPEND_THRESHOLDS') || '5,10')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);

  const crossed = thresholds.filter((t) => totalSpend >= t);
  for (const threshold of crossed) {
    const key = `spend-${threshold}-${today}`;
    if (dryRun) continue;
    if (!(await claimAlert(supabaseUrl, svc, key, { totalSpend, threshold }))) continue;
    const ok = await sendEmail(
      alertEmail,
      `Community plan spend passed $${threshold} today (est. $${totalSpend.toFixed(2)})`,
      renderSpendEmail(threshold, totalSpend, memberSpend, today, rates),
    );
    if (ok) sent.push(key);
    else errors.push(`email send failed for ${key}`);
  }

  // ── 2. Instance health ────────────────────────────────────────────────

  const stats = await dbStats(supabaseUrl, svc, errors);
  const metrics = await instanceMetrics(supabaseUrl, serviceKey, errors);
  const signals = pressureSignals(stats, metrics);

  let sustained = false;
  if (!dryRun) {
    try {
      if (signals.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/monitor_infra_samples`, {
          method: 'POST',
          headers: svc,
          body: JSON.stringify({ signals: signals.map((s) => s.key), stats: { ...stats, ...metrics } }),
        });
      }
      // Prune old samples so the table stays tiny
      await fetch(
        `${supabaseUrl}/rest/v1/monitor_infra_samples?at=lt.${new Date(Date.now() - 7 * 86400_000).toISOString()}`,
        { method: 'DELETE', headers: svc },
      );
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const res = await fetch(
        `${supabaseUrl}/rest/v1/monitor_infra_samples?at=gte.${since}&select=at`,
        { headers: svc },
      );
      const recent = res.ok ? await res.json() : [];
      sustained = Array.isArray(recent) && recent.length >= 3;
    } catch (err) {
      errors.push(`infra sampling failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (sustained && signals.length > 0 && !dryRun) {
    const cooldownOk = await infraCooldownExpired(supabaseUrl, svc);
    if (cooldownOk) {
      const key = `infra-upgrade-${new Date().toISOString()}`;
      if (await claimAlert(supabaseUrl, svc, key, { signals: signals.map((s) => s.key), stats, metrics })) {
        const ok = await sendEmail(
          alertEmail,
          'Community Supabase: consider bumping compute past Micro',
          renderInfraEmail(signals, stats),
        );
        if (ok) sent.push(key);
        else errors.push('email send failed for infra alert');
      }
    }
  }

  // ── 3. Site health: builders hear when their published tool is hurting ──
  //
  // The error beacon in served sites lands runtime errors in site_errors.
  // When a site crosses a few occurrences in a day, its BUILDER (not the
  // steward) gets one plain-language email — with a 72h cooldown per site,
  // so a broken tool nudges rather than nags.

  const siteErrorMin = rate('MONITOR_SITE_ERROR_MIN', 3);
  const siteAlerts: string[] = [];
  if (!dryRun) {
    try {
      const errRes = await fetch(
        `${supabaseUrl}/rest/v1/site_errors?day=eq.${today}` +
          `&select=site_id,message,count,community_sites(slug,name,owner_email,kind)`,
        { headers: svc },
      );
      const errRows: {
        site_id: string; message: string; count: number;
        community_sites: { slug: string; name: string; owner_email: string; kind: string } | null;
      }[] = errRes.ok ? await errRes.json() : [];

      const bySite = new Map<string, { slug: string; name: string; owner: string; total: number; messages: { message: string; count: number }[] }>();
      for (const r of errRows) {
        const site = r.community_sites;
        if (!site || site.kind !== 'site' || !site.owner_email) continue;
        const cur = bySite.get(r.site_id) ?? { slug: site.slug, name: site.name, owner: site.owner_email, total: 0, messages: [] };
        cur.total += Number(r.count);
        cur.messages.push({ message: r.message, count: Number(r.count) });
        bySite.set(r.site_id, cur);
      }

      for (const s of bySite.values()) {
        if (s.total < siteErrorMin) continue;
        if (!(await siteAlertCooldownExpired(supabaseUrl, svc, s.slug))) continue;
        const key = `site-errors-${s.slug}-${today}`;
        if (!(await claimAlert(supabaseUrl, svc, key, { total: s.total }))) continue;
        const ok = await sendEmail(
          s.owner,
          `Your site "${s.name}" hit some errors today`,
          renderSiteErrorEmail(s),
        );
        if (ok) { sent.push(key); siteAlerts.push(s.slug); }
        else errors.push(`email send failed for ${key}`);
      }
    } catch (err) {
      errors.push(`site health check failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (testEmail) {
    const ok = await sendEmail(
      alertEmail,
      'Community monitoring is live',
      emailShell(
        'Community monitoring is live',
        `<p style="font-size:15px;line-height:1.6;margin:0 0 12px;">
          The community-monitor function is deployed and this email confirms the
          delivery path works. It checks every 15 minutes and will email you when:
        </p>
        <ul style="margin:0 0 12px;padding-left:20px;">
          <li style="font-size:14px;line-height:1.6;">Estimated community plan spend passes <strong>$5/day</strong>, then <strong>$10/day</strong> (once per threshold per day)</li>
          <li style="font-size:14px;line-height:1.6;">The community Supabase shows sustained pressure suggesting a compute bump past Micro (at most once per 72 hours)</li>
        </ul>
        <p style="font-size:13px;color:#78716C;line-height:1.6;margin:0;">
          Right now: estimated spend today is $${totalSpend.toFixed(2)},
          ${signals.length === 0 ? 'and the instance shows no pressure signals' : `with pressure signals: ${signals.map((s) => s.key).join(', ')}`}.
        </p>`,
      ),
    );
    if (ok) sent.push('test-email');
    else errors.push('test email send failed');
  }

  return json({
    ok: true,
    dry_run: dryRun,
    day: today,
    estimated_spend_usd: Number(totalSpend.toFixed(4)),
    thresholds,
    thresholds_crossed: crossed,
    site_alerts: siteAlerts,
    members: memberSpend.map((m) => ({
      ...m,
      usd: Number(m.usd.toFixed(4)),
      models: m.models.map((mm) => ({ ...mm, usd: Number(mm.usd.toFixed(4)) })),
    })),
    infra: { stats, metrics, signals: signals.map((s) => s.key), sustained },
    alerts_sent: sent,
    errors,
  });
});

// ── Alert state helpers ─────────────────────────────────────────────────

/** Insert the alert row; false means another run already claimed it. */
async function claimAlert(
  supabaseUrl: string,
  svc: Record<string, string>,
  key: string,
  detail: unknown,
): Promise<boolean> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/monitor_alerts`, {
      method: 'POST',
      headers: { ...svc, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({ alert_key: key, detail }),
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function infraCooldownExpired(
  supabaseUrl: string,
  svc: Record<string, string>,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/monitor_alerts?alert_key=like.infra-upgrade-*&order=sent_at.desc&limit=1&select=sent_at`,
      { headers: svc },
    );
    if (!res.ok) return true;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return true;
    return Date.now() - new Date(rows[0].sent_at).getTime() > 72 * 3600_000;
  } catch {
    return true;
  }
}

/** One nudge per site per 72 hours, however long it stays broken. */
async function siteAlertCooldownExpired(
  supabaseUrl: string,
  svc: Record<string, string>,
  slug: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/monitor_alerts?alert_key=like.site-errors-${encodeURIComponent(slug)}-*&order=sent_at.desc&limit=1&select=sent_at`,
      { headers: svc },
    );
    if (!res.ok) return true;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return true;
    return Date.now() - new Date(rows[0].sent_at).getTime() > 72 * 3600_000;
  } catch {
    return true;
  }
}

// ── Health data sources ─────────────────────────────────────────────────

async function dbStats(
  supabaseUrl: string,
  svc: Record<string, string>,
  errors: string[],
): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/monitor_db_stats`, {
      method: 'POST',
      headers: svc,
      body: '{}',
    });
    if (!res.ok) {
      errors.push(`monitor_db_stats failed (${res.status})`);
      return {};
    }
    const data = await res.json();
    return typeof data === 'object' && data ? data : {};
  } catch (err) {
    errors.push(`monitor_db_stats failed: ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

/**
 * The instance's Prometheus endpoint (Basic auth: service_role + the service
 * role key) exposes node-level RAM/CPU/swap/disk that Postgres can't see.
 * Everything here degrades gracefully — a missing endpoint just means fewer
 * signals.
 */
async function instanceMetrics(
  supabaseUrl: string,
  serviceKey: string,
  errors: string[],
): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${supabaseUrl}/customer/v1/privileged/metrics`, {
      headers: { Authorization: `Basic ${btoa(`service_role:${serviceKey}`)}` },
    });
    if (!res.ok) {
      errors.push(`metrics endpoint returned ${res.status}`);
      return {};
    }
    const text = await res.text();

    const first = (re: RegExp): number | null => {
      const m = text.match(re);
      return m ? Number(m[1]) : null;
    };
    const out: Record<string, number> = {};
    const set = (key: string, val: number | null) => {
      if (val !== null && Number.isFinite(val)) out[key] = val;
    };

    set('mem_total_bytes', first(/^node_memory_MemTotal_bytes(?:\{[^}]*\})? ([\d.e+]+)/m));
    set('mem_available_bytes', first(/^node_memory_MemAvailable_bytes(?:\{[^}]*\})? ([\d.e+]+)/m));
    set('swap_total_bytes', first(/^node_memory_SwapTotal_bytes(?:\{[^}]*\})? ([\d.e+]+)/m));
    set('swap_free_bytes', first(/^node_memory_SwapFree_bytes(?:\{[^}]*\})? ([\d.e+]+)/m));
    set('load1', first(/^node_load1(?:\{[^}]*\})? ([\d.e+]+)/m));
    const cpus = text.match(/^node_cpu_seconds_total\{[^}]*mode="idle"[^}]*\}/gm);
    if (cpus) out.cpu_count = cpus.length;
    set(
      'data_disk_avail_bytes',
      first(/^node_filesystem_avail_bytes\{[^}]*mountpoint="\/data"[^}]*\} ([\d.e+]+)/m),
    );
    set(
      'data_disk_size_bytes',
      first(/^node_filesystem_size_bytes\{[^}]*mountpoint="\/data"[^}]*\} ([\d.e+]+)/m),
    );
    return out;
  } catch (err) {
    errors.push(`metrics fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    return {};
  }
}

interface Signal {
  key: string;
  detail: string;
}

function pressureSignals(
  stats: Record<string, number>,
  metrics: Record<string, number>,
): Signal[] {
  const signals: Signal[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  if (metrics.mem_total_bytes && metrics.mem_available_bytes !== undefined) {
    const frac = metrics.mem_available_bytes / metrics.mem_total_bytes;
    if (frac < 0.15) {
      signals.push({
        key: 'memory',
        detail: `Only ${pct(frac)} of RAM available (${(metrics.mem_available_bytes / 1e6).toFixed(0)} MB of ${(metrics.mem_total_bytes / 1e9).toFixed(1)} GB)`,
      });
    }
  }
  if (metrics.swap_total_bytes && metrics.swap_free_bytes !== undefined) {
    const usedFrac = 1 - metrics.swap_free_bytes / metrics.swap_total_bytes;
    if (usedFrac > 0.6) {
      signals.push({
        key: 'swap',
        detail: `Swap is ${pct(usedFrac)} used — the database working set no longer fits in RAM`,
      });
    }
  }
  if (metrics.load1 !== undefined) {
    const cpus = metrics.cpu_count || 2;
    if (metrics.load1 > cpus * 1.5) {
      signals.push({
        key: 'cpu',
        detail: `1-minute load average ${metrics.load1.toFixed(2)} on ${cpus} (shared) cores`,
      });
    }
  }
  if (stats.connections && stats.max_connections) {
    const frac = stats.connections / stats.max_connections;
    if (frac > 0.7) {
      signals.push({
        key: 'connections',
        detail: `${stats.connections} of ${stats.max_connections} Postgres connections in use (${pct(frac)})`,
      });
    }
  }
  if (
    stats.cache_hit_ratio !== undefined &&
    stats.cache_hit_ratio < 0.98 &&
    (stats.db_size_bytes ?? 0) > 500e6
  ) {
    signals.push({
      key: 'cache-hit',
      detail: `Postgres buffer cache hit ratio is ${(stats.cache_hit_ratio * 100).toFixed(1)}% (healthy is 99%+) with a ${(stats.db_size_bytes / 1e9).toFixed(1)} GB database`,
    });
  }
  if (metrics.data_disk_size_bytes && metrics.data_disk_avail_bytes !== undefined) {
    const frac = metrics.data_disk_avail_bytes / metrics.data_disk_size_bytes;
    if (frac < 0.2) {
      signals.push({
        key: 'disk',
        detail: `Data disk is ${pct(1 - frac)} full (disk scales separately from compute, but worth a look)`,
      });
    }
  }
  return signals;
}

// ── Email ───────────────────────────────────────────────────────────────

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  const resendKey = env('RESEND_API_KEY');
  if (!resendKey) return false;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Relational Builder Monitor <alerts@relationalbuilder.org>',
        to: [to],
        subject,
        html,
      }),
    });
    if (!res.ok) await res.text().catch(() => {});
    return res.ok;
  } catch {
    return false;
  }
}

function emailShell(title: string, inner: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F5F5F4;font-family:Georgia,'Times New Roman',serif;color:#292524;">
    <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
      <div style="background:#FFFFFF;border-radius:14px;padding:36px 32px;border:1px solid #E7E5E4;">
        <div style="font-size:28px;line-height:1;margin-bottom:20px;">
          <span style="color:#E86F4E;">&#9679;</span><span style="color:#3D8B6D;">&#9679;</span><span style="color:#E8B84E;">&#9679;</span>
        </div>
        <h1 style="font-size:21px;font-weight:600;margin:0 0 14px;">${title}</h1>
        ${inner}
      </div>
      <p style="font-size:12px;color:#A8A29E;text-align:center;margin:20px 0 0;line-height:1.6;">
        Automated alert from the Relational Builder community monitor
        (community-monitor edge function, checked every 15 minutes).
      </p>
    </div>
  </body>
</html>`;
}

/** "claude-fable-5 $6.10 · claude-opus-5 $3.20" → "fable-5 $6.10 · opus-5 $3.20" */
function modelMixLabel(models: Array<{ model: string; usd: number }>): string {
  if (models.length === 0) return '—';
  return models
    .slice(0, 3)
    .map((m) => `${m.model.replace(/^claude-/, '')} $${m.usd.toFixed(2)}`)
    .join(' · ');
}

function renderSpendEmail(
  threshold: number,
  total: number,
  members: Array<{
    email: string;
    requests: number;
    tokens: number;
    usd: number;
    models: Array<{ model: string; usd: number }>;
  }>,
  day: string,
  rates: { input: number; output: number; cacheWrite: number; cacheRead: number },
): string {
  const rowsHtml = members
    .slice(0, 15)
    .map(
      (m) => `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #E7E5E4;font-size:13px;">${escapeHtml(m.email)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #E7E5E4;font-size:13px;text-align:right;">${m.requests}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #E7E5E4;font-size:13px;text-align:right;">${(m.tokens / 1e6).toFixed(2)}M</td>
        <td style="padding:6px 8px;border-bottom:1px solid #E7E5E4;font-size:12px;text-align:right;color:#78716C;">${escapeHtml(modelMixLabel(m.models))}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #E7E5E4;font-size:13px;text-align:right;">$${m.usd.toFixed(2)}</td>
      </tr>`,
    )
    .join('');
  return emailShell(
    `Community plan spend passed $${threshold} today`,
    `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      Estimated subsidized spend for <strong>${day}</strong> (UTC) is
      <strong>$${total.toFixed(2)}</strong>, past the $${threshold}/day mark.
    </p>
    <table style="border-collapse:collapse;width:100%;margin:0 0 16px;">
      <tr>
        <th style="text-align:left;padding:6px 8px;font-size:12px;color:#78716C;border-bottom:2px solid #E7E5E4;">Member</th>
        <th style="text-align:right;padding:6px 8px;font-size:12px;color:#78716C;border-bottom:2px solid #E7E5E4;">Requests</th>
        <th style="text-align:right;padding:6px 8px;font-size:12px;color:#78716C;border-bottom:2px solid #E7E5E4;">Tokens</th>
        <th style="text-align:right;padding:6px 8px;font-size:12px;color:#78716C;border-bottom:2px solid #E7E5E4;">Models</th>
        <th style="text-align:right;padding:6px 8px;font-size:12px;color:#78716C;border-bottom:2px solid #E7E5E4;">Est. cost</th>
      </tr>
      ${rowsHtml}
    </table>
    <p style="font-size:13px;color:#78716C;line-height:1.6;margin:0;">
      Each model prices at its own rates: Fable $10/$50 per MTok, Opus $5/$25, Sonnet $3/$15,
      Haiku $1/$5, with 1-hour cache writes at 2&times; input and cache reads at 0.1&times;.
      Usage without a recorded model prices at Opus-class rates
      ($${rates.input}/$${rates.output}, cache writes $${rates.cacheWrite}, reads $${rates.cacheRead})
      and shows as "untracked". Daily budgets reset at midnight UTC. This alert sends once per
      threshold per day.
    </p>`,
  );
}

function renderInfraEmail(
  signals: Signal[],
  stats: Record<string, number>,
): string {
  const signalsHtml = signals
    .map(
      (s) =>
        `<li style="font-size:14px;line-height:1.6;margin:0 0 8px;"><strong>${escapeHtml(s.key)}</strong> — ${escapeHtml(s.detail)}</li>`,
    )
    .join('');
  const dbSize = stats.db_size_bytes ? `${(stats.db_size_bytes / 1e9).toFixed(2)} GB` : 'unknown';
  return emailShell(
    'The community Supabase looks ready for more than Micro',
    `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      The community instance (Micro: ${MICRO.ramGb} GB RAM, ${MICRO.cores} cores) has shown
      sustained pressure — these signals fired repeatedly over the last two hours:
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;">${signalsHtml}</ul>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
      Database size is ${dbSize}. Next step up is <strong>Small</strong> (2 GB RAM), changed in
      the Supabase dashboard under Project Settings &rarr; Compute and Disk (a few minutes of
      downtime while the instance resizes).
    </p>
    <p style="font-size:13px;color:#78716C;line-height:1.6;margin:0;">
      This recommendation sends at most once every 72 hours. If it keeps arriving after an
      upgrade, the thresholds in the community-monitor function may need retuning.
    </p>`,
  );
}

function renderSiteErrorEmail(s: {
  slug: string; name: string; total: number;
  messages: { message: string; count: number }[];
}): string {
  const appUrl = Deno.env.get('APP_URL') ?? 'https://relationalbuilder.org';
  const top = s.messages
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
    .map(
      (m) =>
        `<li style="font-size:13px;line-height:1.6;margin:0 0 8px;font-family:ui-monospace,monospace;">${escapeHtml(m.message)} <span style="color:#78716C;">(${m.count}&times;)</span></li>`,
    )
    .join('');
  return emailShell(
    `Your site "${escapeHtml(s.name)}" hit some errors today`,
    `<p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
      Neighbors visiting <a href="${appUrl}/s/${escapeHtml(s.slug)}/" style="color:#C2410C;">${escapeHtml(s.name)}</a>
      ran into errors ${s.total} times today. The tool may still mostly work —
      but something is breaking for real people, and it's worth a look.
    </p>
    <ul style="margin:0 0 16px;padding-left:20px;">${top}</ul>
    <p style="font-size:14px;line-height:1.6;margin:0 0 16px;">
      Two ways to fix it, both from <a href="${appUrl}" style="color:#C2410C;">Relational Builder</a>:
      open the project and paste one of the errors above into the chat ("neighbors
      are seeing this error"), or restore an earlier version of the site from
      Your Sites on the home page — it goes live again at the same address.
    </p>
    <p style="font-size:13px;color:#78716C;line-height:1.6;margin:0;">
      You'll get at most one of these every three days per site. Errors are
      collected anonymously — messages only, nothing about your visitors.
    </p>`,
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
