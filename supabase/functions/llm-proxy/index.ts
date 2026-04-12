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
 *   - "rtp"       → RTP-hosted vLLM (pass-through, no key needed)
 *
 * For BYOK: client sends their API key in the Authorization header.
 * For Tier 1 (RTP): no key required — the function uses RTP_MODEL_URL.
 *
 * Deploy:
 *   supabase functions deploy llm-proxy --no-verify-jwt
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-llm-provider',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  try {
    const provider = req.headers.get('x-llm-provider') ?? 'anthropic';
    const authHeader = req.headers.get('Authorization') ?? '';
    const body = await req.json();

    if (provider === 'anthropic') {
      return await proxyAnthropic(body, authHeader);
    } else if (provider === 'rtp') {
      return await proxyRTP(body);
    } else {
      // Generic OpenAI-compatible pass-through (openai, openrouter, etc.)
      const baseUrl = getBaseUrl(provider);
      return await proxyOpenAI(body, authHeader, baseUrl);
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

async function proxyRTP(body: Record<string, unknown>): Promise<Response> {
  const rtpUrl = Deno.env.get('RTP_MODEL_URL') ?? 'https://api.relationaltech.org';
  return proxyOpenAI(body, '', rtpUrl);
}

// ── Generic OpenAI-compatible pass-through ───────────────────────────

async function proxyOpenAI(
  body: Record<string, unknown>,
  authHeader: string,
  baseUrl: string,
): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authHeader) headers['Authorization'] = authHeader;

  const upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
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

function getBaseUrl(provider: string): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com';
    case 'openrouter':
      return 'https://openrouter.ai/api';
    default:
      return 'https://api.openai.com';
  }
}
