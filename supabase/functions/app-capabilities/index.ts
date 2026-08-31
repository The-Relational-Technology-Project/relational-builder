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
 *
 * App actions (authenticate with app_id + app_key, like app-data):
 *   send_email {app_id, app_key, to, subject, text?, html?, reply_to?, member_token?}
 *     — sends via the app's vaulted Resend key. Rate-limited, daily-capped,
 *       and optionally restricted to signed-in neighbors (config.members_only_send).
 *   ai_chat {app_id, app_key, messages, system?, max_tokens?, member_token?}
 *     — one completion via whichever AI key is vaulted (anthropic | openai |
 *       gemini). Returns {text, service}. Same rate/daily-cap regime.
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
const MAX_AI_INPUT_BYTES = 32 * 1024;
const MAX_AI_TOKENS = 2048;
const MAX_SCRAPE_URL_CHARS = 2048;
const MAX_SCRAPE_MARKDOWN_CHARS = 300_000;
const AI_DEFAULT_MODEL: Record<string, string> = {
  anthropic: 'claude-haiku-4-5',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};

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

    if (action.startsWith('secret_')) {
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
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,owner_email`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!apps.length || String(apps[0].owner_email ?? '').toLowerCase() !== email) {
    return json({ error: 'Not your app' }, 403);
  }

  switch (action) {
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
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,app_key`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!Array.isArray(apps) || apps.length === 0 || apps[0].app_key !== appKey) {
    return json({ error: 'Unknown app or wrong key' }, 403);
  }

  // Whichever AI key the builder vaulted, in preference order
  let service: Service | null = null;
  let vault: SecretRow | null = null;
  for (const s of AI_SERVICES) {
    vault = await getSecret(appId, s);
    if (vault) { service = s; break; }
  }
  if (!service || !vault) {
    return json({ error: "AI isn't set up for this app — the builder can connect an AI key in the Services tab" }, 503);
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

  const model = String(vault.config?.model ?? '') || AI_DEFAULT_MODEL[service];
  try {
    const text = await callProvider(service, vault.secret, model, messages, system, maxTokens);
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
