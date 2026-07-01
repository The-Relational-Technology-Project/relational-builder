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
// list of origins (e.g. "https://builder.relationaltechproject.org,http://localhost:5173").
// Unset = allow all (development default).
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const allowOrigin =
    ALLOWED_ORIGINS.length === 0
      ? '*'
      : ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-llm-provider',
    Vary: 'Origin',
  };
}

// Best-effort per-IP rate limit (per warm isolate). A determined abuser can
// still rotate IPs or hit cold starts — this guards against accidental loops
// and casual abuse, which is the realistic threat for a BYOK proxy.
const RATE_LIMIT = Number(Deno.env.get('RATE_LIMIT_PER_MIN') ?? '30');
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(req: Request): boolean {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT;
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
      return await proxyAnthropic(body, authHeader, CORS_HEADERS);
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

// ── Anthropic (translate OpenAI format → Anthropic Messages API) ─────

async function proxyAnthropic(
  body: Record<string, unknown>,
  authHeader: string,
  CORS_HEADERS: Record<string, string>,
): Promise<Response> {
  const apiKey = authHeader.replace(/^Bearer\s+/i, '');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing API key' }), {
      status: 401,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // Translate OpenAI messages format to Anthropic format
  const messages = (body.messages as Array<{ role: string; content: string }>) ?? [];
  const systemMsg = messages.find((m) => m.role === 'system');
  const conversationMsgs = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));

  const anthropicBody: Record<string, unknown> = {
    model: body.model,
    max_tokens: (body.max_tokens as number) ?? 8192,
    stream: body.stream ?? true,
    messages: conversationMsgs,
  };
  if (systemMsg) {
    anthropicBody.system = systemMsg.content;
  }

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(anthropicBody),
  });

  if (!upstream.ok) {
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!body.stream) {
    // Non-streaming: translate Anthropic response to OpenAI format
    const data = await upstream.json();
    const content = data.content?.[0]?.text ?? '';
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
              if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                // Emit as OpenAI-format SSE
                const chunk = {
                  choices: [{ index: 0, delta: { content: parsed.delta.text } }],
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
