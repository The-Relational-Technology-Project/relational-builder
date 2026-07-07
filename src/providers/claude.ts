import type { LLMProvider, ChatMessage, StreamCallbacks, ModelInfo, ContentPart } from './types';
import { contentToText } from './types';
import { communityAccessActive, getCommunitySessionToken } from '@/store/community-store';

/** Translate OpenAI-style content parts to Anthropic content blocks (dev-direct path) */
function toAnthropicContent(content: string | ContentPart[]): unknown {
  if (typeof content === 'string') return content;
  return content
    .map(part => {
      if (part.type === 'text') return { type: 'text', text: part.text };
      const url = part.image_url?.url ?? '';
      const dataMatch = url.match(/^data:(image\/[\w+.-]+);base64,(.+)$/s);
      if (dataMatch) {
        return { type: 'image', source: { type: 'base64', media_type: dataMatch[1], data: dataMatch[2] } };
      }
      return url ? { type: 'image', source: { type: 'url', url } } : null;
    })
    .filter(Boolean);
}

/**
 * Anthropic Claude provider (Tier 2 -- BYOK).
 *
 * Routes through the LLM proxy (Supabase Edge Function) which translates
 * OpenAI-format requests to the Anthropic Messages API server-side.
 * This eliminates CORS issues and the dangerous direct browser access header.
 *
 * Falls back to direct Anthropic API calls if no proxy URL is configured
 * (for local development).
 */

const PROXY_URL = import.meta.env.VITE_LLM_PROXY_URL ?? '';

// Claude 5 family + current 4.x. Aliases only — no date suffixes.
// Opus first: it's the default for free community builds — early adopters
// get the best model; smart throttling to Sonnet can come later.
export const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'claude' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'claude' },
];

// Real multi-file builds need far more than the old 8192 — adaptive thinking
// spends from the same budget. Haiku 4.5 caps at 64k output tokens total.
function maxTokensFor(model: string): number {
  return /haiku/.test(model) ? 32000 : 64000;
}

// Models on the adaptive-thinking API surface (explicit config beats Sonnet
// 5's silent default; summarized display streams reasoning back as progress)
const ADAPTIVE_THINKING_RE = /opus-4-[78]|sonnet-5|fable/;

// Transient upstream failures worth retrying before the stream starts:
// 429 rate limit, 5xx hiccups, 529 Anthropic overloaded. NOT the community
// daily budget's 429 — that one won't clear in ten seconds.
const RETRY_STATUSES = new Set([429, 500, 502, 503, 504, 529]);
const RETRY_DELAYS_MS = [2000, 5000, 10000];

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); },
      { once: true },
    );
  });
}

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';
  readonly name = 'Claude (Anthropic)';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? '';
  }

  isConfigured(): boolean {
    // BYOK, or community access (RTP-subsidized key held server-side)
    return !!this.apiKey || communityAccessActive();
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async getModels(): Promise<ModelInfo[]> {
    return CLAUDE_MODELS;
  }

  async chat(
    messages: ChatMessage[],
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    if (PROXY_URL) {
      return this.chatViaProxy(messages, model, callbacks, signal);
    }
    if (!this.apiKey) {
      throw new Error(
        'Community access needs the LLM proxy (VITE_LLM_PROXY_URL). Add your own API key in Settings, or ask RTP to check the proxy config.',
      );
    }
    return this.chatDirect(messages, model, callbacks, signal);
  }

  /**
   * Route through the LLM proxy (production path).
   * Sends OpenAI-format request; proxy translates to Anthropic API.
   * Response comes back as OpenAI-format SSE.
   */
  private async chatViaProxy(
    messages: ChatMessage[],
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-llm-provider': 'anthropic',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    } else {
      // Community access: the proxy verifies this session token against the
      // pilot allowlist and uses RTP's key server-side
      const token = await getCommunitySessionToken();
      if (!token) {
        throw new Error('Sign in (top right) to use community access, or add your own API key in Settings.');
      }
      headers['x-community-token'] = token;
    }

    const body = JSON.stringify({
      model,
      max_tokens: maxTokensFor(model),
      stream: true,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    });

    // Transient failures (rate limits, overload, network blips) retry with
    // backoff before the stream starts — a busy evening with many builders on
    // the shared key should feel like a pause, not an error. Nothing has
    // streamed yet on these paths, so a retry never duplicates output.
    const maxAttempts = RETRY_DELAYS_MS.length + 1;
    let res: Response | null = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      let r: Response;
      try {
        r = await fetch(PROXY_URL, { method: 'POST', headers, body, signal });
      } catch (err) {
        if (signal?.aborted || attempt === maxAttempts) throw err;
        callbacks.onRetry?.(attempt, maxAttempts);
        await abortableSleep(RETRY_DELAYS_MS[attempt - 1], signal);
        continue;
      }

      if (r.ok) {
        res = r;
        break;
      }

      const text = await r.text().catch(() => r.statusText);
      // The proxy speaks human ({"error": "You've reached today's…"}), and
      // Anthropic pass-through errors nest theirs ({"error": {"message"…}}) —
      // surface those words directly instead of wrapping them in status codes
      let friendly: string | null = null;
      try {
        const parsed = JSON.parse(text) as { error?: unknown };
        if (typeof parsed.error === 'string') friendly = parsed.error;
        else if (
          parsed.error && typeof parsed.error === 'object' &&
          typeof (parsed.error as { message?: unknown }).message === 'string'
        ) friendly = (parsed.error as { message: string }).message;
      } catch { /* not JSON — fall through to the raw form */ }

      // The community daily budget answers 429 too, but retrying it is
      // hopeless — it resets tomorrow, so let its message through now
      const retryable =
        RETRY_STATUSES.has(r.status) && !(friendly ?? '').includes('budget');
      if (!retryable || attempt === maxAttempts) {
        throw new Error(friendly ?? `Claude API error (${r.status}): ${text}`);
      }
      callbacks.onRetry?.(attempt, maxAttempts);
      await abortableSleep(RETRY_DELAYS_MS[attempt - 1], signal);
    }
    if (!res) throw new Error('No response from the LLM proxy');

    // Parse OpenAI-format SSE (proxy already translated from Anthropic)
    await this.readOpenAIStream(res, callbacks, signal);
  }

  /**
   * Direct Anthropic API call (development fallback).
   * Uses the dangerous direct browser access header — only for local dev.
   */
  private async chatDirect(
    messages: ChatMessage[],
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const systemMsg = messages.find(m => m.role === 'system');
    const conversationMsgs = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: toAnthropicContent(m.content) }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: maxTokensFor(model),
      stream: true,
      messages: conversationMsgs,
    };
    if (ADAPTIVE_THINKING_RE.test(model)) {
      body.thinking = { type: 'adaptive', display: 'summarized' };
    }
    if (systemMsg) {
      // Same cache segmentation the proxy applies (see llm-proxy): the
      // CACHE_BREAK markers become cache_control breakpoints
      const parts = contentToText(systemMsg.content)
        .split('<<<RB_CACHE_BREAK>>>')
        .map(p => p.trim())
        .filter(Boolean);
      body.system = parts.length > 1
        ? parts.map((p, i) =>
            i < parts.length - 1
              ? { type: 'text', text: p, cache_control: { type: 'ephemeral' } }
              : { type: 'text', text: p },
          )
        : parts[0] ?? '';
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Claude API error (${res.status}): ${text}`);
    }

    await this.readAnthropicStream(res, callbacks, signal);
  }

  /** Parse OpenAI-format SSE stream */
  private async readOpenAIStream(
    res: Response,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
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
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const choice = parsed.choices?.[0];
            const token = choice?.delta?.content;
            if (token) {
              fullText += token;
              callbacks.onToken(token);
            }
            const reasoning = choice?.delta?.reasoning_content;
            if (reasoning) {
              callbacks.onReasoning?.(reasoning);
            }
            if (choice?.finish_reason) {
              callbacks.onFinishReason?.(choice.finish_reason);
            }
          } catch {
            // skip malformed chunks
          }
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) {
      if (signal?.aborted) return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }

  /** Parse Anthropic-native SSE stream (for direct fallback) */
  private async readAnthropicStream(
    res: Response,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let fullText = '';
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
              fullText += parsed.delta.text;
              callbacks.onToken(parsed.delta.text);
            } else if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'thinking_delta' &&
              parsed.delta?.thinking
            ) {
              callbacks.onReasoning?.(parsed.delta.thinking);
            } else if (parsed.type === 'message_delta' && parsed.delta?.stop_reason) {
              callbacks.onFinishReason?.(
                parsed.delta.stop_reason === 'max_tokens' ? 'length' : 'stop',
              );
            }
          } catch {
            // skip non-JSON lines
          }
        }
      }
      callbacks.onComplete(fullText);
    } catch (err) {
      if (signal?.aborted) return;
      callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
