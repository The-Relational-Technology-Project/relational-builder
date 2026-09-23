/**
 * Supabase Edge Function: app-capabilities — managed capabilities for built apps.
 *
 * Sibling to app-data. Where app-data is public-by-design storage, this
 * function holds things that must NEVER ship in an app's page: the builder's
 * own service keys (Resend first), vaulted server-side and used only here.
 * A built app calls capabilities with its public app_id/app_key from
 * anywhere — the builder preview, community-hosted sites, any other host —
 * and the secret stays on the server.
 *
 * Builder actions (require the owner's Builder session in Authorization;
 * these power the Services tab and the Cloud tab in Relational Builder):
 *   secret_set    {app_id, service, secret, config?} — vault/replace a key (write-only)
 *   secret_config {app_id, service, config}          — update settings without re-pasting the key
 *   secret_delete {app_id, service}
 *   secret_status {app_id}            — services, config, caps, usage; never values
 *   secret_test   {app_id, service}   — live server-side key check (Resend: GET /domains)
 *   secret_log    {app_id, limit?}    — recent email history
 *   community_ai_enable {app_id}      — turn on Community AI for this app (no key:
 *                                       the owner must be on the community plan)
 *
 * App actions (authenticate with app_id + app_key, like app-data):
 *   send_email {app_id, app_key, to, subject, text?, html?, reply_to?, member_token?}
 *     — sends via the app's vaulted Resend key. Rate-limited, daily-capped,
 *       and optionally restricted to signed-in neighbors (config.members_only_send).
 *   ai_chat {app_id, app_key, messages, system?, max_tokens?, member_token?}
 *     — one completion. A builder-vaulted AI key (anthropic | openai | gemini)
 *       wins; otherwise, when the builder turned on Community AI, the call
 *       runs on RTP's shared Anthropic key (ANTHROPIC_COMMUNITY_KEY) with
 *       Claude Opus, metered against the OWNER's weekly community token
 *       budget exactly like their building turns (community_usage, model
 *       recorded as `app:<model>` so the steward view can tell them apart).
 *       Returns {text, service}. Same rate/daily-cap regime.
 *   scrape {app_id, app_key, url, member_token?}
 *     — reads one public web page as markdown via the app's vaulted
 *       Firecrawl key. Returns {markdown, title, source_url}. Same
 *       rate/daily-cap regime.
 *
 * Deploy: supabase functions deploy app-capabilities --no-verify-jwt
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const SERVICES = ['resend', 'anthropic', 'openai', 'gemini', 'firecrawl'] as const;
type Service = (typeof SERVICES)[number];
const AI_SERVICES: Service[] = ['anthropic', 'openai', 'gemini'];

const RATE_LIMIT_PER_MIN = 30;
const MAX_RECIPIENTS = 5;
const MAX_SUBJECT_CHARS = 200;
const MAX_BODY_BYTES = 50 * 1024;
const MAX_LOG_LIMIT = 100;
const MAX_AI_MESSAGES = 20;
// 200KB (~50k tokens): room for a meeting transcript, the headline use case
// for in-app AI. Per-call spend at Opus rates stays well under a dollar, and
// the owner's weekly community budget is the real ceiling.
const MAX_AI_INPUT_BYTES = 200 * 1024;
const MAX_AI_TOKENS = 2048;
const MAX_SCRAPE_URL_CHARS = 2048;
const MAX_SCRAPE_MARKDOWN_CHARS = 300_000;
const AI_DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};

// ── Community AI: in-app AI on the community plan, no key from the builder ──
//
// The app_secrets row for this "service" is a switch, not a key: its secret
// column holds a sentinel and is never sent anywhere. It exists so the usual
// machinery (per-app daily cap, members_only_send, last_used_at, secret_status)
// applies unchanged. The real credential is the ANTHROPIC_COMMUNITY_KEY secret
// the llm-proxy already uses; the real cap is the owner's weekly token budget.
const COMMUNITY_AI_SERVICE = 'community_ai';
const COMMUNITY_AI_SENTINEL = 'community-plan';
// Opus by default (the model that serves community builds). Override without a
// deploy via the COMMUNITY_APP_MODEL secret; per-model choice for builders can
// come later.
const COMMUNITY_APP_MODEL = Deno.env.get('COMMUNITY_APP_MODEL') ?? 'claude-opus-5-5';
// Adaptive thinking shares max_tokens with the answer on Opus 5.5, so the
// community path gives the request headroom rather than truncating a summary
// mid-sentence. Effort stays low: summaries and Q&A don't need deep reasoning,
// and low effort keeps thinking tokens (billed as output) small.
const COMMUNITY_AI_MAX_TOKENS = 4096;
const COMMUNITY_AI_EFFORT = Deno.env.get('COMMUNITY_APP_EFFORT') ?? 'low';

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(appId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(appId);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(appId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function svcHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function restUrl(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const action = String(body.action ?? '');

    if (action.startsWith('secret_') || action === 'community_ai_enable') {
      return await handleBuilder(req, body, action);
    }

    if (action === 'send_email') {
      return await sendEmail(body);
    }

    if (action === 'ai_chat') {
      return await aiChat(body);
    }

    if (action === 'scrape') {
      return await scrapeUrl(body);
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

/** Resolve the signed-in builder's email from the Authorization header */
async function resolveBuilder(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const email = String(user.email ?? '').toLowerCase();
  return email || null;
}

// ── Builder actions: vault management, authenticated by session + ownership ──

async function handleBuilder(req: Request, body: Record<string, unknown>, action: string): Promise<Response> {
  const email = await resolveBuilder(req);
  if (!email) return json({ error: 'Sign in to manage app services' }, 401);

  const appId = String(body.app_id ?? '');
  if (!appId) return json({ error: 'app_id required' }, 400);
  const appRes = await fetch(
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,owner_email,name`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!apps.length || String(apps[0].owner_email ?? '').toLowerCase() !== email) {
    return json({ error: 'Not your app' }, 403);
  }
  const appName = String(apps[0].name ?? 'Untitled app');

  switch (action) {
    case 'community_ai_enable': {
      // The owner has to be on the community plan — that's whose weekly
      // budget every in-app call draws on.
      if (!Deno.env.get('ANTHROPIC_COMMUNITY_KEY')) {
        return json({ error: 'Community AI is not configured on this server' }, 503);
      }
      const gate = await communityPlanGate(email);
      if ('error' in gate && gate.status === 403) return json({ error: gate.error }, 403);
      // Re-enabling an app that already has the switch is silent; the
      // steward hears about each app once, when it first turns on.
      const alreadyOn = !!(await getSecret(appId, COMMUNITY_AI_SERVICE));
      const res = await fetch(restUrl('/app_secrets?on_conflict=app_id,service'), {
        method: 'POST',
        headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          app_id: appId,
          service: COMMUNITY_AI_SERVICE,
          secret: COMMUNITY_AI_SENTINEL,
          config: {},
          created_by_email: email,
        }),
      });
      if (!res.ok) return json({ error: 'Could not turn on Community AI' }, 500);
      if (!alreadyOn) notifyStewardCommunityAiOn(email, appId, appName);
      return json({ ok: true, model: COMMUNITY_APP_MODEL });
    }

    case 'secret_set': {
      const service = String(body.service ?? '');
      if (!(SERVICES as readonly string[]).includes(service)) {
        return json({ error: `Unknown service: ${service}` }, 400);
      }
      const secret = String(body.secret ?? '').trim();
      if (!secret || secret.length > 500) return json({ error: 'A service key is required' }, 400);
      const config = body.config && typeof body.config === 'object' ? body.config : {};
      const res = await fetch(restUrl('/app_secrets?on_conflict=app_id,service'), {
        method: 'POST',
        headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ app_id: appId, service, secret, config, created_by_email: email }),
      });
      if (!res.ok) return json({ error: 'Could not save the key' }, 500);
      return json({ ok: true });
    }

    case 'secret_config': {
      const service = String(body.service ?? '');
      const config = body.config && typeof body.config === 'object' ? body.config : null;
      if (!config) return json({ error: 'config object required' }, 400);
      const res = await fetch(
        restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&service=eq.${encodeURIComponent(service)}`),
        { method: 'PATCH', headers: { ...svcHeaders(), Prefer: 'return=representation' }, body: JSON.stringify({ config }) },
      );
      const rows = res.ok ? await res.json() : [];
      if (!rows.length) return json({ error: 'No key saved for this service yet' }, 404);
      return json({ ok: true });
    }

    case 'secret_delete': {
      const service = String(body.service ?? '');
      await fetch(
        restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&service=eq.${encodeURIComponent(service)}`),
        { method: 'DELETE', headers: svcHeaders() },
      );
      return json({ ok: true });
    }

    case 'secret_status': {
      // Everything about the vault except the values — those never come back
      const res = await fetch(
        restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&select=service,config,daily_cap,created_at,last_used_at`),
        { headers: svcHeaders() },
      );
      const secrets = res.ok ? await res.json() : [];
      const usageRes = await fetch(
        restUrl(`/app_capability_usage?app_id=eq.${encodeURIComponent(appId)}&day=eq.${today()}&select=service,count`),
        { headers: svcHeaders() },
      );
      const usage = usageRes.ok ? await usageRes.json() : [];
      const byService = new Map(usage.map((u: { service: string; count: number }) => [u.service, u.count]));
      return json({
        secrets: secrets.map((s: Record<string, unknown>) => ({
          ...s,
          sends_today: byService.get(String(s.service)) ?? 0,
        })),
      });
    }

    case 'secret_test': {
      const service = String(body.service ?? '');
      // Community AI: no key to probe — "works" means the server has the
      // shared key, the switch is on, and the owner is still on the plan
      // with budget left this week.
      if (service === COMMUNITY_AI_SERVICE) {
        if (!(await getSecret(appId, COMMUNITY_AI_SERVICE))) {
          return json({ error: 'Community AI is not turned on for this app yet' }, 404);
        }
        if (!Deno.env.get('ANTHROPIC_COMMUNITY_KEY')) {
          return json({ ok: false, error: 'Community AI is not configured on this server' });
        }
        const gate = await communityPlanGate(email);
        if ('error' in gate) return json({ ok: false, error: gate.error });
        return json({ ok: true, model: COMMUNITY_APP_MODEL });
      }
      if (!(SERVICES as readonly string[]).includes(service)) {
        return json({ error: `No test available for: ${service}` }, 400);
      }
      const secret = await getSecret(appId, service);
      if (!secret) return json({ error: 'No key saved for this service yet' }, 404);
      // Firecrawl: the credit-usage endpoint proves the key without spend
      if (service === 'firecrawl') {
        const probe = await fetch('https://api.firecrawl.dev/v2/team/credit-usage', {
          headers: { Authorization: `Bearer ${secret.secret}` },
        });
        if (probe.ok) return json({ ok: true });
        if ([400, 401, 403].includes(probe.status)) {
          return json({ ok: false, error: 'Firecrawl rejected this key — check that you copied it fully' });
        }
        return json({ ok: false, error: 'Could not reach Firecrawl — try again shortly' });
      }
      // AI providers: a free models-list call proves the key without spend
      if (service !== 'resend') {
        const probe =
          service === 'anthropic'
            ? await fetch('https://api.anthropic.com/v1/models', {
                headers: { 'x-api-key': secret.secret, 'anthropic-version': '2023-06-01' },
              })
            : service === 'openai'
              ? await fetch('https://api.openai.com/v1/models', {
                  headers: { Authorization: `Bearer ${secret.secret}` },
                })
              : await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                  headers: { 'x-goog-api-key': secret.secret },
                });
        if (probe.ok) return json({ ok: true });
        if ([400, 401, 403].includes(probe.status)) {
          return json({ ok: false, error: 'The provider rejected this key — check that you copied it fully' });
        }
        return json({ ok: false, error: 'Could not reach the provider — try again shortly' });
      }
      // Resend: free, no email sent — and the verified-domain list powers
      // the from-address picker in the Services tab.
      const res = await fetch('https://api.resend.com/domains', {
        headers: { Authorization: `Bearer ${secret.secret}` },
      });
      if (res.ok) {
        const data = await res.json();
        const domains = Array.isArray(data?.data)
          ? data.data
              .filter((d: { status?: string }) => d.status === 'verified')
              .map((d: { name?: string }) => String(d.name ?? ''))
              .filter(Boolean)
          : [];
        return json({ ok: true, verified_domains: domains });
      }
      let name = '';
      try {
        const err = await res.json();
        name = String(err?.name ?? '');
      } catch { /* non-JSON error body */ }
      // A sending-only (restricted) key can't list domains but is valid for
      // exactly what we vault it for — treat it as verified.
      if (name === 'restricted_api_key') {
        return json({ ok: true, verified_domains: [], restricted: true });
      }
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        return json({ ok: false, error: 'Resend rejected this key — check that you copied it fully' });
      }
      return json({ ok: false, error: 'Could not reach Resend — try again shortly' });
    }

    case 'secret_log': {
      const limit = Math.min(Number(body.limit ?? 20) || 20, MAX_LOG_LIMIT);
      const res = await fetch(
        restUrl(`/app_email_log?app_id=eq.${encodeURIComponent(appId)}&select=recipient,subject,status,error,created_at&order=created_at.desc&limit=${limit}`),
        { headers: svcHeaders() },
      );
      return json({ log: res.ok ? await res.json() : [] });
    }

    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }
}

// ── App action: send email with the vaulted key ──

interface SecretRow {
  secret: string;
  config: Record<string, unknown>;
  daily_cap: number;
}

async function getSecret(appId: string, service: Service | string): Promise<SecretRow | null> {
  const res = await fetch(
    restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&service=eq.${encodeURIComponent(service)}&select=secret,config,daily_cap`),
    { headers: svcHeaders() },
  );
  const rows = res.ok ? await res.json() : [];
  return rows[0] ?? null;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

async function sendEmail(body: Record<string, unknown>): Promise<Response> {
  const appId = String(body.app_id ?? '');
  const appKey = String(body.app_key ?? '');
  if (!appId || !appKey) return json({ error: 'app_id and app_key required' }, 401);
  if (isRateLimited(appId)) {
    return json({ error: 'Rate limit exceeded — try again in a minute' }, 429);
  }

  const appRes = await fetch(
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,app_key,name`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!Array.isArray(apps) || apps.length === 0 || apps[0].app_key !== appKey) {
    return json({ error: 'Unknown app or wrong key' }, 403);
  }
  const appName = String(apps[0].name ?? 'this community app');

  const vault = await getSecret(appId, 'resend');
  if (!vault) {
    return json({ error: "Email isn't set up for this app — the builder can connect Resend in the Services tab" }, 503);
  }

  // Recipients: one address or a small list
  const toRaw = body.to;
  const to = (Array.isArray(toRaw) ? toRaw : [toRaw])
    .map((t) => String(t ?? '').trim().toLowerCase())
    .filter(Boolean);
  if (to.length === 0 || to.length > MAX_RECIPIENTS) {
    return json({ error: `Send to 1–${MAX_RECIPIENTS} addresses per call` }, 400);
  }
  for (const addr of to) {
    if (!EMAIL_RE.test(addr)) return json({ error: `Not a valid email address: ${addr}` }, 400);
  }

  const subject = String(body.subject ?? '').trim().slice(0, MAX_SUBJECT_CHARS);
  if (!subject) return json({ error: 'subject required' }, 400);
  const text = body.text === undefined ? undefined : String(body.text);
  const html = body.html === undefined ? undefined : String(body.html);
  if (!text && !html) return json({ error: 'text or html body required' }, 400);
  if ((text?.length ?? 0) + (html?.length ?? 0) > MAX_BODY_BYTES) {
    return json({ error: `Email body too large (max ${MAX_BODY_BYTES / 1024}KB)` }, 413);
  }
  const replyTo = String(body.reply_to ?? '').trim();
  if (replyTo && !EMAIL_RE.test(replyTo)) return json({ error: 'reply_to is not a valid email address' }, 400);

  // Builders can require a signed-in neighbor before this app may send
  if (vault.config?.members_only_send) {
    const member = await resolveMember(appId, body.member_token);
    if (!member) return json({ error: 'Sign in to send email from this app' }, 403);
  }

  // Daily cap: bump-and-check in one RPC round trip
  const usageRes = await fetch(restUrl('/rpc/increment_capability_usage'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ p_app_id: appId, p_service: 'resend' }),
  });
  const sendsToday = usageRes.ok ? Number(await usageRes.json()) : 0;
  if (sendsToday > vault.daily_cap) {
    return json({ error: "This app reached today's email limit — try again tomorrow" }, 429);
  }

  const fromEmail = String(vault.config?.from_email ?? '').trim() || 'onboarding@resend.dev';
  const fromName = String(vault.config?.from_name ?? '').trim() || appName;
  const payload: Record<string, unknown> = {
    from: `${fromName} <${fromEmail}>`,
    to,
    subject,
  };
  if (text) payload.text = text;
  if (html) payload.html = html;
  if (replyTo) payload.reply_to = replyTo;

  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vault.secret}` },
    body: JSON.stringify(payload),
  });
  const ok = sendRes.ok;
  let sendError: string | null = null;
  if (!ok) {
    try {
      const err = await sendRes.json();
      sendError = String(err?.message ?? `Resend error ${sendRes.status}`).slice(0, 300);
    } catch {
      sendError = `Resend error ${sendRes.status}`;
    }
  }

  // History + last-used stamp: best-effort, never blocks the response
  const logRows = to.map((recipient) => ({
    app_id: appId,
    recipient,
    subject,
    status: ok ? 'sent' : 'failed',
    error: sendError,
  }));
  fetch(restUrl('/app_email_log'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify(logRows),
  }).catch(() => {});
  fetch(restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&service=eq.resend`), {
    method: 'PATCH',
    headers: svcHeaders(),
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch(() => {});

  if (!ok) {
    return json({ error: sendError ?? 'Could not send the email' }, 502);
  }
  return json({ ok: true });
}

// ── App action: one AI completion with whichever key is vaulted ──

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

async function aiChat(body: Record<string, unknown>): Promise<Response> {
  const appId = String(body.app_id ?? '');
  const appKey = String(body.app_key ?? '');
  if (!appId || !appKey) return json({ error: 'app_id and app_key required' }, 401);
  if (isRateLimited(appId)) {
    return json({ error: 'Rate limit exceeded — try again in a minute' }, 429);
  }

  const appRes = await fetch(
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,app_key,owner_email`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!Array.isArray(apps) || apps.length === 0 || apps[0].app_key !== appKey) {
    return json({ error: 'Unknown app or wrong key' }, 403);
  }
  const ownerEmail = String(apps[0].owner_email ?? '').toLowerCase();

  // A key the builder vaulted themselves wins (their own spend, their own
  // model choice); otherwise the Community AI switch, if they turned it on.
  let service: Service | typeof COMMUNITY_AI_SERVICE | null = null;
  let vault: SecretRow | null = null;
  for (const s of AI_SERVICES) {
    vault = await getSecret(appId, s);
    if (vault) { service = s; break; }
  }
  if (!vault) {
    vault = await getSecret(appId, COMMUNITY_AI_SERVICE);
    if (vault) service = COMMUNITY_AI_SERVICE;
  }
  if (!service || !vault) {
    return json({ error: "AI isn't set up for this app — the builder can turn on Community AI (or connect their own key) in the Services tab" }, 503);
  }
  const viaCommunity = service === COMMUNITY_AI_SERVICE;

  // Community AI: the shared key must exist, and the OWNER must still be on
  // the plan with weekly budget left — checked before any spend, same gate
  // as their building turns.
  if (viaCommunity) {
    if (!Deno.env.get('ANTHROPIC_COMMUNITY_KEY')) {
      return json({ error: 'Community AI is not configured on this server' }, 503);
    }
    if (!ownerEmail) return json({ error: "AI isn't available for this app right now" }, 503);
    const gate = await communityPlanGate(ownerEmail);
    if ('error' in gate) return json({ error: gate.error }, gate.status);
  }

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  if (rawMessages.length === 0 || rawMessages.length > MAX_AI_MESSAGES) {
    return json({ error: `messages: 1–${MAX_AI_MESSAGES} required` }, 400);
  }
  const messages: AiMessage[] = [];
  let inputBytes = 0;
  for (const m of rawMessages) {
    const role = m?.role === 'assistant' ? 'assistant' : 'user';
    const content = String(m?.content ?? '');
    if (!content) return json({ error: 'Every message needs content' }, 400);
    inputBytes += content.length;
    messages.push({ role, content });
  }
  const system = body.system === undefined ? undefined : String(body.system);
  inputBytes += system?.length ?? 0;
  if (inputBytes > MAX_AI_INPUT_BYTES) {
    return json({ error: `Input too large (max ${MAX_AI_INPUT_BYTES / 1024}KB)` }, 413);
  }
  const maxTokens = Math.min(Math.max(Number(body.max_tokens ?? 1024) || 1024, 16), MAX_AI_TOKENS);

  if (vault.config?.members_only_send) {
    const member = await resolveMember(appId, body.member_token);
    if (!member) return json({ error: 'Sign in to use AI features in this app' }, 403);
  }

  const usageRes = await fetch(restUrl('/rpc/increment_capability_usage'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ p_app_id: appId, p_service: service }),
  });
  const callsToday = usageRes.ok ? Number(await usageRes.json()) : 0;
  if (callsToday > vault.daily_cap) {
    return json({ error: "This app reached today's AI limit — try again tomorrow" }, 429);
  }

  try {
    let text: string;
    if (viaCommunity) {
      const result = await callCommunityAnthropic(messages, system, maxTokens);
      text = result.text;
      // Metered under the owner's email so the weekly gate, the budget
      // banner, and the steward's utilization view all see it. The model
      // is prefixed so app usage is distinguishable from building turns;
      // the monitor's pricing matches on substring, so `app:claude-opus-5-5`
      // still prices at Opus rates.
      recordCommunityUsage(ownerEmail, result.usage, `app:${result.model}`);
    } else {
      const model = String(vault.config?.model ?? '') || AI_DEFAULT_MODEL[service];
      text = await callProvider(service as Service, vault.secret, model, messages, system, maxTokens);
    }
    fetch(restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&service=eq.${encodeURIComponent(service)}`), {
      method: 'PATCH',
      headers: svcHeaders(),
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }).catch(() => {});
    return json({ text, service });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'The AI provider returned an error' }, 502);
  }
}

// ── Community AI helpers: the plan gate and metering, mirrored from llm-proxy ──

interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

type PlanGate = { ok: true } | { error: string; status: number };

/**
 * Is this builder on the community plan with weekly budget left? Same rules
 * as the llm-proxy's checkCommunityAccess minus the identity step (the caller
 * already knows whose email this is): membership row, then all token traffic
 * since Monday 00:00 UTC against weekly_token_budget.
 */
async function communityPlanGate(email: string): Promise<PlanGate> {
  const memberRes = await fetch(
    restUrl(`/community_members?email=eq.${encodeURIComponent(email)}&select=weekly_token_budget`),
    { headers: svcHeaders() },
  );
  const members = memberRes.ok ? await memberRes.json() : [];
  if (!Array.isArray(members) || members.length === 0) {
    return {
      error: "Community AI needs the app's builder to be on the community plan — reach out to the Relational Tech Project to join, or connect your own AI key in the Services tab.",
      status: 403,
    };
  }
  const budget = Number(members[0].weekly_token_budget ?? 20000000);
  const usageRes = await fetch(
    restUrl(`/community_usage?email=eq.${encodeURIComponent(email)}&day=gte.${weekStartUtc()}&select=input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens`),
    { headers: svcHeaders() },
  );
  const usage = usageRes.ok ? await usageRes.json() : [];
  const used = Array.isArray(usage)
    ? usage.reduce(
        (sum: number, row: Record<string, unknown>) =>
          sum +
          Number(row.input_tokens ?? 0) +
          Number(row.output_tokens ?? 0) +
          Number(row.cache_creation_tokens ?? 0) +
          Number(row.cache_read_tokens ?? 0),
        0,
      )
    : 0;
  if (used >= budget) {
    return {
      error: "This app's AI features are resting until Monday — its builder's weekly community plan budget is used up.",
      status: 429,
    };
  }
  return { ok: true };
}

/**
 * Steward heads-up when an app first turns on Community AI: who, which app,
 * the model, and where their weekly budget stands. Fire-and-forget through
 * Resend (RESEND_API_KEY; STEWARD_EMAIL defaults to Josh) — never blocks or
 * fails the enable.
 */
function notifyStewardCommunityAiOn(builderEmail: string, appId: string, appName: string): void {
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return;
  const steward = Deno.env.get('STEWARD_EMAIL') ?? 'josh@relationaltechproject.org';
  (async () => {
    // Budget snapshot: this week's token traffic vs their allowance
    let budgetLine = '';
    try {
      const memberRes = await fetch(
        restUrl(`/community_members?email=eq.${encodeURIComponent(builderEmail)}&select=weekly_token_budget`),
        { headers: svcHeaders() },
      );
      const members = memberRes.ok ? await memberRes.json() : [];
      const budget = Number(members[0]?.weekly_token_budget ?? 0);
      const usageRes = await fetch(
        restUrl(`/community_usage?email=eq.${encodeURIComponent(builderEmail)}&day=gte.${weekStartUtc()}&select=input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens`),
        { headers: svcHeaders() },
      );
      const usage = usageRes.ok ? await usageRes.json() : [];
      const used = (Array.isArray(usage) ? usage : []).reduce(
        (sum: number, r: Record<string, unknown>) =>
          sum + Number(r.input_tokens ?? 0) + Number(r.output_tokens ?? 0) +
          Number(r.cache_creation_tokens ?? 0) + Number(r.cache_read_tokens ?? 0),
        0,
      );
      if (budget > 0) {
        budgetLine = `<p style="margin:0 0 8px;">Weekly budget: ${(used / 1e6).toFixed(2)}M of ${(budget / 1e6).toFixed(0)}M tokens used so far this week.</p>`;
      }
    } catch { /* the notice still goes out without the snapshot */ }
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Relational Builder Monitor <alerts@relationalbuilder.org>',
        to: [steward],
        subject: `Community AI turned on: ${appName} (${builderEmail})`,
        html: [
          '<div style="font-family:Georgia,serif;color:#292524;font-size:15px;line-height:1.6;">',
          `<p style="margin:0 0 8px;"><strong>${esc(builderEmail)}</strong> turned on in-app AI for <strong>${esc(appName)}</strong>.</p>`,
          `<p style="margin:0 0 8px;">Model: ${esc(COMMUNITY_APP_MODEL)} on the shared community key. Backend id: <code>${esc(appId)}</code>.</p>`,
          budgetLine,
          `<p style="margin:0 0 8px;">Calls are metered under their email as <code>app:${esc(COMMUNITY_APP_MODEL)}</code> against their weekly plan budget, with a per-app daily cap on top. ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.</p>`,
          '</div>',
        ].join('\n'),
      }),
    });
  })().catch(() => {});
}

/** The UTC date (YYYY-MM-DD) of the Monday that starts the current budget week */
function weekStartUtc(now = new Date()): string {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday))
    .toISOString()
    .slice(0, 10);
}

/** Fire-and-forget: add one in-app call to the owner's community_usage rows */
function recordCommunityUsage(email: string, usage: TokenUsage, model: string): void {
  fetch(restUrl('/rpc/increment_community_usage'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({
      p_email: email,
      p_input: usage.input,
      p_output: usage.output,
      p_cache_write: usage.cacheWrite,
      p_cache_read: usage.cacheRead,
      p_model: model,
    }),
  }).catch(() => {});
}

/**
 * One Opus completion on the shared community key. Not streamed: in-app
 * features are short (max_tokens ≤ 4096) and the app expects one JSON reply.
 * A refusal or an empty reply surfaces as an error the app can show.
 */
async function callCommunityAnthropic(
  messages: AiMessage[],
  system: string | undefined,
  requestedMaxTokens: number,
): Promise<{ text: string; model: string; usage: TokenUsage }> {
  const key = Deno.env.get('ANTHROPIC_COMMUNITY_KEY') ?? '';
  // Headroom for adaptive thinking, which shares the output budget
  const maxTokens = Math.min(Math.max(requestedMaxTokens * 2, 1024), COMMUNITY_AI_MAX_TOKENS);
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: COMMUNITY_APP_MODEL,
      max_tokens: maxTokens,
      output_config: { effort: COMMUNITY_AI_EFFORT },
      ...(system ? { system } : {}),
      messages,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Upstream detail goes to the log; the app gets something it can show
    console.error('community ai upstream error', res.status, JSON.stringify(data).slice(0, 500));
    throw new Error(res.status === 429 ? 'The AI is busy right now — try again in a moment' : 'The AI is unavailable right now — try again shortly');
  }
  if (data?.stop_reason === 'refusal') {
    throw new Error('The AI declined this request');
  }
  const text = (Array.isArray(data?.content) ? data.content : [])
    .filter((b: { type?: string }) => b.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('');
  const u = data?.usage ?? {};
  return {
    text,
    model: String(data?.model ?? COMMUNITY_APP_MODEL),
    usage: {
      input: Number(u.input_tokens ?? 0),
      output: Number(u.output_tokens ?? 0),
      cacheWrite: Number(u.cache_creation_input_tokens ?? 0),
      cacheRead: Number(u.cache_read_input_tokens ?? 0),
    },
  };
}

async function callProvider(
  service: Service, key: string, model: string,
  messages: AiMessage[], system: string | undefined, maxTokens: number,
): Promise<string> {
  if (service === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, ...(system ? { system } : {}), messages }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error?.message ?? `Anthropic error ${res.status}`).slice(0, 300));
    return (Array.isArray(data?.content) ? data.content : [])
      .filter((b: { type?: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text ?? '')
      .join('');
  }
  if (service === 'openai') {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(String(data?.error?.message ?? `OpenAI error ${res.status}`).slice(0, 300));
    return String(data?.choices?.[0]?.message?.content ?? '');
  }
  // gemini
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...(system ? { system_instruction: { parts: [{ text: system }] } } : {}),
        contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        generationConfig: { maxOutputTokens: maxTokens },
      }),
    },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(String(data?.error?.message ?? `Gemini error ${res.status}`).slice(0, 300));
  return (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p.text ?? '')
    .join('');
}

// ── App action: read one public web page with the vaulted Firecrawl key ──

async function scrapeUrl(body: Record<string, unknown>): Promise<Response> {
  const appId = String(body.app_id ?? '');
  const appKey = String(body.app_key ?? '');
  if (!appId || !appKey) return json({ error: 'app_id and app_key required' }, 401);
  if (isRateLimited(appId)) {
    return json({ error: 'Rate limit exceeded — try again in a minute' }, 429);
  }

  const appRes = await fetch(
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,app_key`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!Array.isArray(apps) || apps.length === 0 || apps[0].app_key !== appKey) {
    return json({ error: 'Unknown app or wrong key' }, 403);
  }

  const vault = await getSecret(appId, 'firecrawl');
  if (!vault) {
    return json({ error: "Scraping isn't set up for this app — the builder can connect Firecrawl in the Services tab" }, 503);
  }

  const url = String(body.url ?? '').trim();
  if (!url || url.length > MAX_SCRAPE_URL_CHARS) return json({ error: 'url required' }, 400);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return json({ error: 'url must be a full web address (https://…)' }, 400);
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return json({ error: 'url must be http(s)' }, 400);
  }

  if (vault.config?.members_only_send) {
    const member = await resolveMember(appId, body.member_token);
    if (!member) return json({ error: 'Sign in to use this feature' }, 403);
  }

  const usageRes = await fetch(restUrl('/rpc/increment_capability_usage'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ p_app_id: appId, p_service: 'firecrawl' }),
  });
  const callsToday = usageRes.ok ? Number(await usageRes.json()) : 0;
  if (callsToday > vault.daily_cap) {
    return json({ error: "This app reached today's scraping limit — try again tomorrow" }, 429);
  }

  const scrapeRes = await fetch('https://api.firecrawl.dev/v2/scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${vault.secret}` },
    body: JSON.stringify({ url, formats: ['markdown'] }),
  });
  const data = await scrapeRes.json().catch(() => ({}));
  if (!scrapeRes.ok || data?.success === false) {
    const message = String(data?.error ?? `Firecrawl error ${scrapeRes.status}`).slice(0, 300);
    return json({ error: message }, 502);
  }

  fetch(restUrl(`/app_secrets?app_id=eq.${encodeURIComponent(appId)}&service=eq.firecrawl`), {
    method: 'PATCH',
    headers: svcHeaders(),
    body: JSON.stringify({ last_used_at: new Date().toISOString() }),
  }).catch(() => {});

  return json({
    markdown: String(data?.data?.markdown ?? '').slice(0, MAX_SCRAPE_MARKDOWN_CHARS),
    title: String(data?.data?.metadata?.title ?? ''),
    source_url: String(data?.data?.metadata?.sourceURL ?? url),
  });
}

/** Resolve a neighbor from a session token (null when absent/expired) — same as app-data */
async function resolveMember(appId: string, tokenRaw: unknown): Promise<{ id: string } | null> {
  const token = String(tokenRaw ?? '');
  if (!token) return null;
  const res = await fetch(
    restUrl(`/app_sessions?token=eq.${encodeURIComponent(token)}&app_id=eq.${encodeURIComponent(appId)}&select=member_id,expires_at`),
    { headers: svcHeaders() },
  );
  const sessions = res.ok ? await res.json() : [];
  if (!sessions.length || new Date(sessions[0].expires_at) < new Date()) return null;
  return { id: String(sessions[0].member_id) };
}
