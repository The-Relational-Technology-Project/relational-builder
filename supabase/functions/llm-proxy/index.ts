/**
 * Supabase Edge Function: LLM Proxy
 *
 * Accepts OpenAI-compatible /v1/chat/completions requests and routes them
 * to the appropriate upstream LLM provider. Eliminates CORS issues and
 * keeps API keys server-side.
 *
 * Supported providers (via `x-llm-provider` header):
 *   - "anthropic" → Anthropic Messages API (translates format)
 *   - "openai"    → OpenAI API (pass-through)
 *   - "gemini"    → Google Gemini via its OpenAI-compatibility layer (pass-through)
 *   - "openrouter"→ OpenRouter (pass-through)
 *   - "rtp"       → RTP-hosted vLLM (pass-through, no key needed)
 *
 * For BYOK: client sends their API key in the Authorization header.
 * For Tier 1 (RTP): no key required — the function uses RTP_MODEL_URL.
 *
 * Deploy:
 *   supabase functions deploy llm-proxy --no-verify-jwt
 */

// Restrict CORS in production by setting ALLOWED_ORIGINS as a comma-separated
// list of origins. List every origin the app is served from, including the
// canonical apex domain (e.g.
// "https://relationalbuilder.org,https://relational-builder.vercel.app,http://localhost:5173").
// Entries may contain a "*" wildcard to cover preview deploys
// (e.g. "https://*.vercel.app"). Unset = allow all (development default).
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// An origin is allowed if it matches an allowlist entry exactly, or matches a
// wildcard entry where "*" stands in for any run of characters.
function originAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) => {
    if (!allowed.includes('*')) return allowed === origin;
    const pattern = new RegExp(
      '^' + allowed.split('*').map(escapeRegExp).join('.*') + '$',
    );
    return pattern.test(origin);
  });
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-llm-provider, x-community-token',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.length === 0) {
    // Development default: reflect all origins.
    headers['Access-Control-Allow-Origin'] = '*';
  } else if (origin && originAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  // A disallowed origin gets no Access-Control-Allow-Origin header at all, so
  // the browser blocks it with a clear "no 'Access-Control-Allow-Origin'
  // header is present" error — rather than a misleading mismatch against some
  // other allowed origin, which is easy to misread as a server bug.
  return headers;
}

// Best-effort rate limit (per warm isolate). A determined abuser can still
// rotate IPs or hit cold starts — this guards against accidental loops and
// casual abuse, which is the realistic threat for a BYOK proxy.
//
// Keyed per credential, not per IP: a workshop room shares one NAT'd IP, so
// an IP-keyed limit makes fifty phones on venue WiFi collectively throttle
// each other. Requests that carry a community token or a BYOK key get their
// own bucket; a much looser per-IP bucket remains as a backstop against
// credential-less floods and rotated fake tokens.
const RATE_LIMIT = Number(Deno.env.get('RATE_LIMIT_PER_MIN') ?? '30');
const IP_RATE_LIMIT = Number(
  Deno.env.get('RATE_LIMIT_PER_MIN_PER_IP') ?? String(RATE_LIMIT * 20),
);
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function bumpBucket(key: string, limit: number, now: number): boolean {
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > limit;
}

function isRateLimited(req: Request): boolean {
  const now = Date.now();
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const credential =
    req.headers.get('x-community-token') ?? req.headers.get('Authorization') ?? '';
  if (credential) {
    return (
      bumpBucket(`cred:${credential}`, RATE_LIMIT, now) ||
      bumpBucket(`ip:${ip}`, IP_RATE_LIMIT, now)
    );
  }
  return bumpBucket(`ip:${ip}`, RATE_LIMIT, now);
}

Deno.serve(async (req: Request) => {
  const CORS_HEADERS = corsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  if (isRateLimited(req)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded — try again in a minute' }), {
      status: 429,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json', 'Retry-After': '60' },
    });
  }

  try {
    const provider = req.headers.get('x-llm-provider') ?? 'anthropic';
    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json();

    if (provider === 'anthropic') {
      const communityToken = req.headers.get('x-community-token');
      return await proxyAnthropic(body, authHeader, CORS_HEADERS, communityToken);
    } else if (provider === 'gemini-image') {
      const communityToken = req.headers.get('x-community-token');
      return await proxyGeminiImage(body, authHeader, CORS_HEADERS, communityToken);
    } else if (provider === 'rtp') {
      return await proxyRTP(body, CORS_HEADERS);
    } else {
      // Generic OpenAI-compatible pass-through (openai, gemini, openrouter, etc.)
      return await proxyOpenAI(body, authHeader, getChatCompletionsUrl(provider), CORS_HEADERS);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal proxy error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

// ── Community access (Tier 3 — RTP-subsidized key for invited builders) ──
//
// When a signed-in Builder user has no personal key, the client sends their
// Supabase access token in x-community-token. The proxy verifies identity,
// checks the community_members allowlist + daily token budget, and forwards
// the request using the ANTHROPIC_COMMUNITY_KEY secret. The shared key never
// leaves the server. Usage is metered per email per day.

const COMMUNITY_MODELS = (
  Deno.env.get('COMMUNITY_MODELS') ??
  // Canonical covered set (mirrored in the client's community-store). The
  // env secret exists to narrow or extend this in an emergency without a
  // deploy; when it's unset, this list is the source of truth.
  'claude-opus-5,claude-fable-5,claude-opus-4-8,claude-sonnet-5,claude-haiku-4-5'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// If a headline model is retired upstream (e.g. Claude Fable 5's API access
// sunsetting), requests retry once on the mapped fallback so community
// building never breaks on a model sunset. Format: 'model:fallback,...'.
const MODEL_FALLBACKS: Record<string, string> = Object.fromEntries(
  (Deno.env.get('MODEL_FALLBACKS') ?? 'claude-fable-5:claude-opus-4-8,claude-opus-5:claude-opus-4-8')
    .split(',')
    .map((pair) => pair.split(':').map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && p[1]),
);

// ── Cross-provider outage failover (community chat) ──────────────────
//
// July 29, 2026: Anthropic went down mid-workshop and every community build
// died with it — community access only spoke Anthropic. When Claude is
// unreachable (network error, or 5xx even after one quick retry), community
// requests re-run on the first configured non-Anthropic fallback whose
// community key secret exists. BYOK requests never fail over — a personal
// Claude key must not silently spend the community's Gemini/OpenAI budget.
//
// COMMUNITY_OUTAGE_FALLBACKS reorders/replaces the chain without a deploy
// ('provider:model,…' in priority order); OUTAGE_PROVIDER pins one provider
// to the front and skips the failed-Anthropic-call wait entirely — the
// confirmed-outage lever. Set it while Claude is down, delete it after.

const FALLBACK_KEY_ENVS: Record<string, string> = {
  openai: 'OPENAI_COMMUNITY_KEY',
  gemini: 'GEMINI_COMMUNITY_KEY',
  openrouter: 'OPENROUTER_COMMUNITY_KEY',
  together: 'TOGETHER_COMMUNITY_KEY',
};

// Friendlier names for the in-chat notice; unknown ids show as-is
const FALLBACK_MODEL_NAMES: Record<string, string> = {
  'gpt-5.6-sol': 'GPT-5.6 Sol',
  'gemini-3.5-flash': 'Gemini 3.5 Flash',
};

interface OutageFallback {
  provider: string;
  model: string;
  apiKey: string;
}

function outageFallbackChain(): OutageFallback[] {
  const chain = (
    Deno.env.get('COMMUNITY_OUTAGE_FALLBACKS') ??
    // Default order: OpenAI's top model, then Gemini's. Entries without a
    // provisioned community key drop out, so the chain is exactly the
    // providers RTP has actually funded.
    'openai:gpt-5.6-sol,gemini:gemini-3.5-flash'
  )
    .split(',')
    .map((pair) => pair.split(':').map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && p[1])
    .map(([provider, model]) => ({
      provider,
      model,
      apiKey: Deno.env.get(FALLBACK_KEY_ENVS[provider] ?? '') ?? '',
    }))
    .filter((f) => !!f.apiKey);

  const forced = Deno.env.get('OUTAGE_PROVIDER');
  if (forced) {
    chain.sort((a, b) => Number(b.provider === forced) - Number(a.provider === forced));
  }
  return chain;
}

/** The original request minus everything Claude-specific: cache markers mean
 *  nothing elsewhere, web_tools is an Anthropic server-side feature, and
 *  Claude's 128k max_tokens can exceed other providers' caps — their own
 *  defaults apply instead. */
function fallbackChatBody(
  body: Record<string, unknown>,
  model: string,
  provider: string,
): Record<string, unknown> {
  // Both Anthropic cache markers: the system-segment boundaries and the
  // turn-context boundary at the end of the final user message.
  const stripMarkers = (t: string) =>
    t.replaceAll('<<<RB_CACHE_BREAK>>>', '\n').replaceAll('<<<RB_TURN_BREAK>>>', '\n');
  type Part = { type?: string; text?: string };
  type Msg = { role: string; content: unknown };
  const messages = ((body.messages as Msg[]) ?? []).map((m) => {
    if (typeof m.content === 'string') return { ...m, content: stripMarkers(m.content) };
    if (Array.isArray(m.content)) {
      return {
        ...m,
        content: (m.content as Part[]).map((p) =>
          p?.type === 'text' && typeof p.text === 'string'
            ? { ...p, text: stripMarkers(p.text) }
            : p,
        ),
      };
    }
    return m;
  });
  const stream = body.stream ?? true;
  return {
    model,
    messages,
    stream,
    // Usage on the final chunk, for community metering. Gemini's
    // compatibility layer reports usage without being asked, so it skips
    // the flag rather than risk an unknown-parameter rejection.
    ...(stream && provider !== 'gemini' ? { stream_options: { include_usage: true } } : {}),
  };
}

/** Try each configured fallback in order; null means none worked and the
 *  caller should surface the original Anthropic failure. */
async function communityOutageFallback(
  body: Record<string, unknown>,
  communityEmail: string,
  CORS_HEADERS: Record<string, string>,
): Promise<Response | null> {
  for (const fb of outageFallbackChain()) {
    let upstream: Response;
    try {
      upstream = await fetch(getChatCompletionsUrl(fb.provider), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fb.apiKey}`,
        },
        body: JSON.stringify(fallbackChatBody(body, fb.model, fb.provider)),
      });
    } catch {
      continue; // provider unreachable — try the next one
    }
    if (!upstream.ok || !upstream.body) {
      await upstream.text().catch(() => {});
      continue;
    }
    return fallbackResponse(upstream, fb, communityEmail, CORS_HEADERS, body.stream !== false);
  }
  return null;
}

async function fallbackResponse(
  upstream: Response,
  fb: OutageFallback,
  communityEmail: string,
  CORS_HEADERS: Record<string, string>,
  streaming: boolean,
): Promise<Response> {
  if (!streaming) {
    // Already OpenAI format — meter and pass through
    const data = await upstream.json();
    recordCommunityUsage(
      communityEmail,
      Number(data.usage?.prompt_tokens ?? 0),
      Number(data.usage?.completion_tokens ?? 0),
      0,
      0,
      fb.model,
    );
    return new Response(JSON.stringify(data), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Streaming: the upstream is already OpenAI-format SSE, so bytes pass
  // through untouched. A notice rides the reasoning channel first (it's a
  // progress signal in the client, never part of the reply), and a scan of
  // the passing chunks picks up usage for metering.
  const reader = upstream.body!.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const modelName = FALLBACK_MODEL_NAMES[fb.model] ?? fb.model;
  const notice = `\n[Claude is unreachable right now — this build is running on ${modelName} instead]\n`;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ choices: [{ index: 0, delta: { reasoning_content: notice } }] })}\n\n`,
        ),
      );
      let scan = '';
      let promptTokens = 0;
      let completionTokens = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          scan += decoder.decode(value, { stream: true });
          const lines = scan.split('\n');
          scan = lines.pop() ?? '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.usage) {
                promptTokens = Number(parsed.usage.prompt_tokens ?? promptTokens);
                completionTokens = Number(parsed.usage.completion_tokens ?? completionTokens);
              }
            } catch {
              // not JSON ([DONE], keep-alives) — passed through above anyway
            }
          }
        }
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        if (promptTokens > 0 || completionTokens > 0) {
          recordCommunityUsage(communityEmail, promptTokens, completionTokens, 0, 0, fb.model);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

type CommunityGate = { email: string } | { error: string; status: number };

async function checkCommunityAccess(
  token: string,
  model: string,
  opts: { requiredKeyEnv?: string; skipModelCheck?: boolean } = {},
): Promise<CommunityGate> {
  const requiredKeyEnv = opts.requiredKeyEnv ?? 'ANTHROPIC_COMMUNITY_KEY';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey || !Deno.env.get(requiredKeyEnv)) {
    return { error: 'Community access is not configured on this server', status: 503 };
  }

  // Who is asking? Verify the Supabase access token.
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return { error: 'Sign in to use community access', status: 401 };
  const user = await userRes.json();
  const email = String(user.email ?? '').toLowerCase();
  if (!email) return { error: 'Sign in to use community access', status: 401 };

  if (!opts.skipModelCheck && !COMMUNITY_MODELS.includes(String(model))) {
    return {
      error: `Community access covers ${COMMUNITY_MODELS.join(' and ')} — switch to one of those models, or add your own API key in Settings to use ${model}.`,
      status: 403,
    };
  }

  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

  const memberRes = await fetch(
    `${supabaseUrl}/rest/v1/community_members?email=eq.${encodeURIComponent(email)}&select=daily_token_budget`,
    { headers: svc },
  );
  const members = memberRes.ok ? await memberRes.json() : [];
  if (!Array.isArray(members) || members.length === 0) {
    return {
      error: "This email isn't part of the community building pilot yet — reach out to the Relational Tech Project to join, or add your own API key in Settings.",
      status: 403,
    };
  }
  // Generous by design: early adopters deserve great experiences. The DB row
  // can still lower (or raise) any individual member's budget.
  const budget = Number(members[0].daily_token_budget ?? 5000000);

  // The gate counts ALL token traffic — input, output, and cache writes/reads
  // (Aug 19 2026; previously input+output only). Cache tokens were ~78% of
  // the heaviest observed day's traffic, so a gate that ignored them capped
  // dollars only in theory (~$187/day at Opus rates vs ~$42 all-inclusive).
  // Cache reads bill at just 0.1x but count fully here — the cap is a blunt
  // token meter, and the community-monitor's per-model estimate stays the
  // honest dollar picture.
  const today = new Date().toISOString().slice(0, 10);
  const usageRes = await fetch(
    `${supabaseUrl}/rest/v1/community_usage?email=eq.${encodeURIComponent(email)}&day=eq.${today}&select=input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens`,
    { headers: svc },
  );
  const usage = usageRes.ok ? await usageRes.json() : [];
  const used = Array.isArray(usage) && usage.length > 0
    ? Number(usage[0].input_tokens) +
      Number(usage[0].output_tokens) +
      Number(usage[0].cache_creation_tokens ?? 0) +
      Number(usage[0].cache_read_tokens ?? 0)
    : 0;
  if (used >= budget) {
    return {
      error: "You've reached today's community building budget — it resets tomorrow. Thanks for building!",
      status: 429,
    };
  }

  return { email };
}

function recordCommunityUsage(
  email: string,
  inputTokens: number,
  outputTokens: number,
  cacheWriteTokens = 0,
  cacheReadTokens = 0,
  model = '',
): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return;
  // Fire and forget — metering must not block or fail the response.
  // The model is the one that actually served (which can differ from the
  // request on a retirement or outage fallback) — community-monitor prices
  // each model at its own rates, so Fable sessions project at Fable prices.
  fetch(`${supabaseUrl}/rest/v1/rpc/increment_community_usage`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_email: email,
      p_input: inputTokens,
      p_output: outputTokens,
      p_cache_write: cacheWriteTokens,
      p_cache_read: cacheReadTokens,
      p_model: model || null,
    }),
  }).catch(() => {});
}

// ── Gemini image generation (flyer art, icons, imagery for apps) ─────
//
// Not a chat: one prompt in, one image out as a data URL. BYOK Gemini keys
// pass straight through; community members draw on the GEMINI_COMMUNITY_KEY
// secret under the same allowlist and daily budget as chat. Image output
// meters as output tokens (Gemini bills ~1290 tokens per generated image).

const IMAGE_MODEL = Deno.env.get('COMMUNITY_IMAGE_MODEL') ?? 'gemini-3.1-flash-image';

async function proxyGeminiImage(
  body: Record<string, unknown>,
  authHeader: string,
  CORS_HEADERS: Record<string, string>,
  communityToken: string | null,
): Promise<Response> {
  const jsonHeaders = { ...CORS_HEADERS, 'Content-Type': 'application/json' };

  let apiKey = authHeader.replace(/^Bearer\s+/i, '');
  let communityEmail: string | null = null;
  if (!apiKey && communityToken) {
    const gate = await checkCommunityAccess(communityToken, IMAGE_MODEL, {
      requiredKeyEnv: 'GEMINI_COMMUNITY_KEY',
      skipModelCheck: true,
    });
    if ('error' in gate) {
      return new Response(JSON.stringify({ error: gate.error }), {
        status: gate.status,
        headers: jsonHeaders,
      });
    }
    communityEmail = gate.email;
    apiKey = Deno.env.get('GEMINI_COMMUNITY_KEY') ?? '';
  }
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), {
      status: 401,
      headers: jsonHeaders,
    });
  }

  const prompt = String(body.prompt ?? '').trim();
  if (!prompt) {
    return new Response(JSON.stringify({ error: 'Missing prompt' }), {
      status: 400,
      headers: jsonHeaders,
    });
  }

  const upstream = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${IMAGE_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    },
  );
  if (!upstream.ok) {
    const text = await upstream.text();
    let friendly = `Image generation failed (${upstream.status})`;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.error?.message) friendly = String(parsed.error.message);
    } catch { /* keep the fallback */ }
    return new Response(JSON.stringify({ error: friendly }), {
      status: upstream.status,
      headers: jsonHeaders,
    });
  }

  const data = await upstream.json();
  type GeminiPart = { text?: string; inlineData?: { mimeType?: string; data?: string } };
  const parts: GeminiPart[] = data?.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p?.inlineData?.data);
  if (!img?.inlineData?.data) {
    return new Response(
      JSON.stringify({ error: 'The model returned no image — try rephrasing the prompt' }),
      { status: 502, headers: jsonHeaders },
    );
  }

  if (communityEmail) {
    const usage = data?.usageMetadata ?? {};
    recordCommunityUsage(
      communityEmail,
      Number(usage.promptTokenCount ?? 0),
      Number(usage.candidatesTokenCount ?? 1290),
      0,
      0,
      IMAGE_MODEL,
    );
  }

  const note = parts
    .map((p) => (typeof p?.text === 'string' ? p.text : ''))
    .filter(Boolean)
    .join('\n') || null;
  return new Response(
    JSON.stringify({
      image: `data:${img.inlineData.mimeType ?? 'image/png'};base64,${img.inlineData.data}`,
      note,
    }),
    { headers: jsonHeaders },
  );
}

// ── Anthropic (translate OpenAI format → Anthropic Messages API) ─────

// Models on the adaptive-thinking API surface (Opus 4.7+, Sonnet 5, Fable).
// On Sonnet 5 adaptive thinking runs even when the field is omitted — set it
// explicitly with display: "summarized" so the reasoning streams back as a
// progress signal instead of a silent stall.
const ADAPTIVE_THINKING_RE = /opus-(4-[78]|5)|sonnet-5|fable/;

// Models whose classifier declines should re-run server-side on Anthropic's
// recommended fallback (beta: server-side-fallback-2026-07-01).
const REFUSAL_FALLBACK_RE = /opus-5|fable/;

// Anthropic server-side web tools — attached when the client sends
// `web_tools: true` (chat turns only; the Builder's internal calls never set
// it). Lets the model read pages the builder links and search for current
// info without any scraping service. The _20260209 variants require the
// adaptive-thinking model set; max_uses bounds per-turn spend since web
// search bills per search.
const WEB_TOOLS = [
  { type: 'web_search_20260209', name: 'web_search', max_uses: 5 },
  { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 6 },
];

// Output ceiling when the client doesn't say: real multi-file builds need far
// more than the old 8192, and adaptive thinking at xhigh effort spends from
// the same budget — Opus/Sonnet/Fable stream up to 128k. Haiku 4.5 caps at
// 64k total output.
function defaultMaxTokens(model: string): number {
  return /haiku/.test(model) ? 32000 : 128000;
}

async function proxyAnthropic(
  body: Record<string, unknown>,
  authHeader: string,
  CORS_HEADERS: Record<string, string>,
  communityToken: string | null = null,
): Promise<Response> {
  let apiKey = authHeader.replace(/^Bearer\s+/i, '');
  let communityEmail: string | null = null;

  if (!apiKey && communityToken) {
    const gate = await checkCommunityAccess(communityToken, String(body.model ?? ''));
    if ('error' in gate) {
      return new Response(JSON.stringify({ error: gate.error }), {
        status: gate.status,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }
    communityEmail = gate.email;
    apiKey = Deno.env.get('ANTHROPIC_COMMUNITY_KEY') ?? '';
  }

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // The confirmed-outage lever: when OUTAGE_PROVIDER is set, community chat
  // (still gated and budgeted above) skips Anthropic entirely — an operator
  // set it because Claude is down, so don't make every build wait out a
  // doomed call first. If no fallback key is usable, fall through and try
  // Claude anyway.
  if (communityEmail && Deno.env.get('OUTAGE_PROVIDER')) {
    const fallback = await communityOutageFallback(body, communityEmail, CORS_HEADERS);
    if (fallback) return fallback;
  }

  // Translate OpenAI messages format to Anthropic format.
  // Content may be a string or OpenAI-style parts (text / image_url) —
  // image data URLs become Anthropic base64 image blocks.
  type OpenAIPart =
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url?: { url?: string } };
  type OpenAIMessage = { role: string; content: string | OpenAIPart[] };

  function toAnthropicContent(content: string | OpenAIPart[]): unknown {
    if (typeof content === 'string') return content;
    return content
      .map((part) => {
        if (part.type === 'text') return { type: 'text', text: part.text };
        if (part.type === 'image_url') {
          const url = part.image_url?.url ?? '';
          const dataMatch = url.match(/^data:(image\/[\w+.-]+);base64,(.+)$/s);
          if (dataMatch) {
            return {
              type: 'image',
              source: { type: 'base64', media_type: dataMatch[1], data: dataMatch[2] },
            };
          }
          if (url) return { type: 'image', source: { type: 'url', url } };
        }
        return null;
      })
      .filter(Boolean);
  }

  function contentText(content: string | OpenAIPart[]): string {
    if (typeof content === 'string') return content;
    return content
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('\n');
  }

  const messages = (body.messages as OpenAIMessage[]) ?? [];
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversationMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: toAnthropicContent(m.content) }));

  const model = String(body.model ?? '');
  const anthropicBody: Record<string, unknown> = {
    model: body.model,
    max_tokens: (body.max_tokens as number) ?? defaultMaxTokens(model),
    stream: body.stream ?? true,
    messages: conversationMsgs,
  };
  if (ADAPTIVE_THINKING_RE.test(model)) {
    anthropicBody.thinking = { type: 'adaptive', display: 'summarized' };
    // xhigh is the documented sweet spot for coding/agentic work on these
    // models — it buys real design and architecture thinking on first builds.
    // Effort errors on Haiku, so it stays gated on the same model set.
    anthropicBody.output_config = { effort: 'xhigh' };
    if (body.web_tools === true) {
      anthropicBody.tools = WEB_TOOLS;
    }
  }
  // Opus 5 and Fable 5 run safety classifiers that can decline a request
  // (stop_reason "refusal") — rare false positives happen on benign builds.
  // The server-side fallback re-runs a declined request on Anthropic's
  // recommended substitute (Opus 4.8 for cyber-category declines) inside the
  // same call, so a community builder sees a working build instead of a
  // silent dead stream. Anthropic's stated default for these models.
  if (REFUSAL_FALLBACK_RE.test(model)) {
    anthropicBody.fallbacks = 'default';
  }
  // The Builder marks stability boundaries in its system prompt; each
  // boundary becomes a prompt-cache breakpoint (stable instructions and
  // the project-files snapshot base cache at ~0.1× on repeat sends, which
  // is most of a build conversation's input). Max 4 breakpoints per
  // request; the client uses at most 3 (two system + the history one).
  //
  // 1-hour TTL, not the 5-minute default. A builder reads the reply, looks
  // at the preview, thinks, and types — the gap between turns is routinely
  // longer than five minutes, so every turn was expiring and re-writing the
  // whole prompt at 1.25× and never reading it back. One real editing day
  // ran 15 requests for 1.8M tokens at a $6.06/MTok blended rate, which is
  // above the plain input rate and just under the cache-WRITE rate: the
  // signature of a cache that is written every turn and read never. A 1h
  // write costs 2× instead of 1.25×, so this is a loss on a one-shot
  // conversation and a large win from the third turn on.
  const CACHE_BREAK = '<<<RB_CACHE_BREAK>>>';
  const cachedBlock = (p: string) => ({
    type: 'text',
    text: p,
    cache_control: { type: 'ephemeral', ttl: '1h' },
  });
  // Fully-cacheable protocol (clients since 2026-08-19): a TRAILING marker
  // says every system segment — including the last — is stable, because the
  // volatile per-turn context moved to the end of the user message (see
  // TURN_BREAK below). Older clients (no trailing marker) still carry the
  // volatile tail as the last system segment: all-but-last cached, and no
  // history breakpoint — their system changes every turn, so caching the
  // history would write at 2× and never read.
  let fullyCacheableSystem = false;
  if (systemMsg) {
    const rawParts = contentText(systemMsg.content)
      .split(CACHE_BREAK)
      .map((p) => p.trim());
    fullyCacheableSystem = rawParts.length > 1 && rawParts[rawParts.length - 1] === '';
    const parts = rawParts.filter(Boolean);
    anthropicBody.system =
      parts.length === 0
        ? ''
        : fullyCacheableSystem
          ? parts.map(cachedBlock)
          : parts.length > 1
            ? parts.map((p, i) => (i < parts.length - 1 ? cachedBlock(p) : { type: 'text', text: p }))
            : parts[0];
  }

  // The volatile per-turn context (changed files, retrieval results) arrives
  // after TURN_BREAK at the end of the final user message. Split it out: the
  // text BEFORE the marker is the persistent message — the exact bytes that
  // reappear in history next turn — so the history cache breakpoint lands on
  // its last block, and the context after the marker rides as a final
  // uncached block. Next turn reads the whole conversation back at ~0.1×.
  const TURN_BREAK = '<<<RB_TURN_BREAK>>>';
  const lastMsg = conversationMsgs[conversationMsgs.length - 1];
  if (lastMsg && lastMsg.role === 'user') {
    type Block = { type: string; text?: string; cache_control?: unknown };
    let blocks: Block[] =
      typeof lastMsg.content === 'string'
        ? [{ type: 'text', text: lastMsg.content }]
        : [...(lastMsg.content as Block[])];
    let turnContext: string | null = null;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      if (b.type === 'text' && typeof b.text === 'string' && b.text.includes(TURN_BREAK)) {
        const at = b.text.indexOf(TURN_BREAK);
        // Strip exactly the one '\n' the client added before the marker —
        // never more. The same message reappears verbatim in history next
        // turn, and any byte difference here would miss the cache forever.
        let pre = b.text.slice(0, at);
        if (pre.endsWith('\n')) pre = pre.slice(0, -1);
        turnContext = b.text.slice(at + TURN_BREAK.length).trim();
        if (pre) blocks[i] = { ...b, text: pre };
        else blocks.splice(i, 1);
        break;
      }
    }
    if (fullyCacheableSystem || turnContext !== null) {
      if (fullyCacheableSystem && blocks.length > 0) {
        blocks = [
          ...blocks.slice(0, -1),
          { ...blocks[blocks.length - 1], cache_control: { type: 'ephemeral', ttl: '1h' } },
        ];
      }
      if (turnContext) blocks.push({ type: 'text', text: turnContext });
      lastMsg.content = blocks;
    }
  }

  const callAnthropic = (payload: Record<string, unknown>) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(payload.fallbacks
          ? { 'anthropic-beta': 'server-side-fallback-2026-07-01' }
          : {}),
      },
      body: JSON.stringify(payload),
    });

  let upstream: Response | null = null;
  try {
    upstream = await callAnthropic(anthropicBody);
  } catch (err) {
    // Network-level failure reaching Anthropic. BYOK: surface it — the
    // person owns the key and picked the provider. Community: treat it as
    // an outage and let the failover below take a shot.
    if (!communityEmail) throw err;
  }

  // A 404 for a mapped model means it was retired upstream — retry once with
  // the fallback. Nothing has streamed yet, so the retry is invisible; the
  // fallback (Opus-class) sits on the same adaptive-thinking surface, so the
  // already-built request body stays valid.
  if (upstream && !upstream.ok && upstream.status === 404 && MODEL_FALLBACKS[model]) {
    await upstream.text(); // drain the error body before refetching
    anthropicBody.model = MODEL_FALLBACKS[model];
    // The refusal-fallback param rides only on models in the refusal set
    if (!REFUSAL_FALLBACK_RE.test(MODEL_FALLBACKS[model])) {
      delete anthropicBody.fallbacks;
    }
    upstream = await callAnthropic(anthropicBody);
  }

  // Outage failover — community chat only. One quick same-provider retry
  // first: a lone 529 on a busy evening shouldn't switch providers, but a
  // dead API shouldn't strand a workshop either (July 29). Nothing has
  // streamed yet on any of these paths, so the switch is invisible except
  // for the notice the fallback stream carries.
  if (communityEmail && (!upstream || upstream.status >= 500)) {
    if (upstream) await upstream.text().catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 1500));
    try {
      upstream = await callAnthropic(anthropicBody);
    } catch {
      upstream = null;
    }
    if (!upstream || upstream.status >= 500) {
      const fallback = await communityOutageFallback(body, communityEmail, CORS_HEADERS);
      if (fallback) {
        if (upstream) await upstream.text().catch(() => {});
        return fallback;
      }
    }
  }

  if (!upstream) {
    return new Response(
      JSON.stringify({
        error: 'Claude is unreachable right now and no fallback provider answered — try again in a few minutes.',
      }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!body.stream) {
    // Non-streaming: translate Anthropic response to OpenAI format.
    // Thinking blocks can precede the text block — find the text explicitly.
    const data = await upstream.json();
    const content =
      data.content?.find((b: { type?: string }) => b.type === 'text')?.text ?? '';
    if (communityEmail) {
      recordCommunityUsage(
        communityEmail,
        Number(data.usage?.input_tokens ?? 0),
        Number(data.usage?.output_tokens ?? 0),
        Number(data.usage?.cache_creation_input_tokens ?? 0),
        Number(data.usage?.cache_read_input_tokens ?? 0),
        String(data.model ?? anthropicBody.model ?? ''),
      );
    }
    const openaiResponse = {
      id: data.id,
      object: 'chat.completion',
      model: data.model,
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: data.stop_reason ?? 'stop' }],
      usage: data.usage,
    };
    return new Response(JSON.stringify(openaiResponse), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Streaming: translate Anthropic SSE events to OpenAI SSE format
  const reader = upstream.body?.getReader();
  if (!reader) throw new Error('No response body from Anthropic');

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      let buffer = '';
      let inputTokens = 0;
      let outputTokens = 0;
      let cacheWriteTokens = 0;
      let cacheReadTokens = 0;
      // The model that actually serves (message_start reports it) — after a
      // retirement fallback this differs from the client's request, and the
      // metering row should price at the serving model's rates.
      let servedModel = String(anthropicBody.model ?? '');
      // Streamed server_tool_use blocks (web search / fetch): accumulate the
      // tool input as it arrives so a human progress line ("Searching the
      // web: …") can ride the reasoning channel when the call fires.
      const toolBlocks = new Map<number, { name: string; json: string }>();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data: ')) continue;
            const data = trimmed.slice(6);

            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'message_start' && parsed.message?.usage) {
                inputTokens = Number(parsed.message.usage.input_tokens ?? 0);
                cacheWriteTokens = Number(parsed.message.usage.cache_creation_input_tokens ?? 0);
                cacheReadTokens = Number(parsed.message.usage.cache_read_input_tokens ?? 0);
                if (parsed.message.model) servedModel = String(parsed.message.model);
              } else if (parsed.type === 'message_delta') {
                if (parsed.usage) {
                  outputTokens = Number(parsed.usage.output_tokens ?? outputTokens);
                }
                // Tell the client WHY generation stopped — "length" means the
                // reply was cut off at max_tokens and may end mid-file
                if (parsed.delta?.stop_reason) {
                  const finish =
                    parsed.delta.stop_reason === 'max_tokens' ? 'length' : 'stop';
                  const chunk = {
                    choices: [{ index: 0, delta: {}, finish_reason: finish }],
                  };
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
                }
              } else if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Emit as OpenAI-format SSE
                const chunk = {
                  choices: [{ index: 0, delta: { content: parsed.delta.text } }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              } else if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'thinking_delta' &&
                parsed.delta?.thinking
              ) {
                // Summarized reasoning → progress signal for the client UI
                // (reasoning_content is the de-facto OpenAI-format field)
                const chunk = {
                  choices: [{ index: 0, delta: { reasoning_content: parsed.delta.thinking } }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              } else if (
                parsed.type === 'content_block_start' &&
                parsed.content_block?.type === 'server_tool_use'
              ) {
                toolBlocks.set(Number(parsed.index), {
                  name: String(parsed.content_block.name ?? ''),
                  json: '',
                });
              } else if (
                parsed.type === 'content_block_delta' &&
                parsed.delta?.type === 'input_json_delta' &&
                toolBlocks.has(Number(parsed.index))
              ) {
                toolBlocks.get(Number(parsed.index))!.json += String(parsed.delta.partial_json ?? '');
              } else if (
                parsed.type === 'content_block_stop' &&
                toolBlocks.has(Number(parsed.index))
              ) {
                const block = toolBlocks.get(Number(parsed.index))!;
                toolBlocks.delete(Number(parsed.index));
                let note = block.name === 'web_fetch' ? '\n[Reading a web page]\n' : '\n[Searching the web]\n';
                try {
                  const input = JSON.parse(block.json || '{}') as { query?: string; url?: string };
                  if (block.name === 'web_search' && input.query) note = `\n[Searching the web: "${input.query}"]\n`;
                  if (block.name === 'web_fetch' && input.url) note = `\n[Reading ${input.url}]\n`;
                } catch { /* keep the generic note */ }
                const chunk = {
                  choices: [{ index: 0, delta: { reasoning_content: note } }],
                };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        if (communityEmail && (inputTokens > 0 || outputTokens > 0)) {
          recordCommunityUsage(
            communityEmail,
            inputTokens,
            outputTokens,
            cacheWriteTokens,
            cacheReadTokens,
            servedModel,
          );
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

// ── RTP Community Model (Tier 1 — no key required) ───────────────────

async function proxyRTP(
  body: Record<string, unknown>,
  CORS_HEADERS: Record<string, string>,
): Promise<Response> {
  const rtpUrl = Deno.env.get('RTP_MODEL_URL') ?? 'https://api.relationaltech.org';
  return proxyOpenAI(body, '', `${rtpUrl}/v1/chat/completions`, CORS_HEADERS);
}

// ── Generic OpenAI-compatible pass-through ───────────────────────────

async function proxyOpenAI(
  body: Record<string, unknown>,
  authHeader: string,
  endpointUrl: string,
  CORS_HEADERS: Record<string, string>,
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const upstream = await fetch(endpointUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  // Stream the response back with CORS headers
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': upstream.headers.get('Content-Type') ?? 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────────

function getChatCompletionsUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1/chat/completions';
    case 'together':
      return 'https://api.together.xyz/v1/chat/completions';
    case 'gemini':
      // Google's OpenAI-compatibility layer includes the version in its path
      return 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
    default:
      return 'https://api.openai.com/v1/chat/completions';
  }
}
