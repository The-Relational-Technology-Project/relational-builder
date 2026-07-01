import type { LLMProvider, ChatMessage, StreamCallbacks, ModelInfo } from './types';
import { communityAccessActive, getCommunitySessionToken } from '@/store/community-store';

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
export const CLAUDE_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', provider: 'claude' },
  { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'claude' },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'claude' },
];

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

    const res = await fetch(PROXY_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        stream: true,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Claude API error (${res.status}): ${text}`);
    }

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
      .map(m => ({ role: m.role, content: m.content }));

    const body: Record<string, unknown> = {
      model,
      max_tokens: 8192,
      stream: true,
      messages: conversationMsgs,
    };
    if (systemMsg) {
      body.system = systemMsg.content;
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
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              fullText += token;
              callbacks.onToken(token);
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
