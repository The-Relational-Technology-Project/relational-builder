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

const COMMUNITY_MODELS = (Deno.env.get('COMMUNITY_MODELS') ?? 'claude-sonnet-5,claude-haiku-4-5')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// If a headline model is retired upstream (e.g. Claude Fable 5's API access
// sunsetting), requests retry once on the mapped fallback so community
// building never breaks on a model sunset. Format: 'model:fallback,...'.
const MODEL_FALLBACKS: Record<string, string> = Object.fromEntries(
  (Deno.env.get('MODEL_FALLBACKS') ?? 'claude-fable-5:claude-opus-4-8')
    .split(',')
    .map((pair) => pair.split(':').map((s) => s.trim()))
    .filter((p) => p.length === 2 && p[0] && p[1]),
);

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

  const today = new Date().toISOString().slice(0, 10);
  const usageRes = await fetch(
    `${supabaseUrl}/rest/v1/community_usage?email=eq.${encodeURIComponent(email)}&day=eq.${today}&select=input_tokens,output_tokens`,
    { headers: svc },
  );
  const usage = usageRes.ok ? await usageRes.json() : [];
  const used = Array.isArray(usage) && usage.length > 0
    ? Number(usage[0].input_tokens) + Number(usage[0].output_tokens)
    : 0;
  if (used >= budget) {
    return {
      error: "You've reached today's community building budget — it resets tomorrow. Thanks for building!",
      status: 429,
    };
  }

  return { email };
}

function recordCommunityUsage(email: string, inputTokens: number, outputTokens: number): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return;
  // Fire and forget — metering must not block or fail the response
  fetch(`${supabaseUrl}/rest/v1/rpc/increment_community_usage`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_email: email, p_input: inputTokens, p_output: outputTokens }),
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
const ADAPTIVE_THINKING_RE = /opus-4-[78]|sonnet-5|fable/;

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
  if (systemMsg) {
    // The Builder marks stability boundaries in its system prompt; each
    // boundary becomes a prompt-cache breakpoint (stable instructions and
    // the project-files snapshot cache at ~0.1× on repeat sends, which is
    // most of a build conversation's input). Max 4 breakpoints per request;
    // the client sends at most 2.
    const CACHE_BREAK = '<<<RB_CACHE_BREAK>>>';
    const systemText = contentText(systemMsg.content);
    const parts = systemText
      .split(CACHE_BREAK)
      .map((p) => p.trim())
      .filter(Boolean);
    anthropicBody.system = parts.length > 1
      ? parts.map((p, i) =>
          i < parts.length - 1
            ? { type: 'text', text: p, cache_control: { type: 'ephemeral' } }
            : { type: 'text', text: p },
        )
      : parts[0] ?? '';
  }

  const callAnthropic = (payload: Record<string, unknown>) =>
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(payload),
    });

  let upstream = await callAnthropic(anthropicBody);

  // A 404 for a mapped model means it was retired upstream — retry once with
  // the fallback. Nothing has streamed yet, so the retry is invisible; the
  // fallback (Opus-class) sits on the same adaptive-thinking surface, so the
  // already-built request body stays valid.
  if (!upstream.ok && upstream.status === 404 && MODEL_FALLBACKS[model]) {
    await upstream.text(); // drain the error body before refetching
    anthropicBody.model = MODEL_FALLBACKS[model];
    upstream = await callAnthropic(anthropicBody);
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
          recordCommunityUsage(communityEmail, inputTokens, outputTokens);
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
