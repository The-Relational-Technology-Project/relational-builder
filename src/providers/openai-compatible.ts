import type { LLMProvider, ChatMessage, StreamCallbacks, ModelInfo } from './types';

/**
 * OpenAI-compatible provider.
 * Works with: RTP-hosted vLLM, OpenAI API, OpenRouter, any OpenAI-compatible endpoint.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly id: string;
  readonly name: string;
  private baseUrl: string;
  private apiKey: string;
  private defaultModels: ModelInfo[];

  constructor(config: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    defaultModels?: ModelInfo[];
  }) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey ?? '';
    this.defaultModels = config.defaultModels ?? [];
  }

  isConfigured(): boolean {
    return !!this.baseUrl;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  async getModels(): Promise<ModelInfo[]> {
    if (!this.isConfigured()) return this.defaultModels;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}/v1/models`, { headers });
      if (!res.ok) return this.defaultModels;

      const data = await res.json();
      return (data.data ?? []).map((m: { id: string }) => ({
        id: m.id,
        name: m.id,
        provider: this.id,
      }));
    } catch {
      return this.defaultModels;
    }
  }

  async chat(
    messages: ChatMessage[],
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model, messages, stream: true }),
      signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`${this.name} API error (${res.status}): ${text}`);
    }

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
            // skip malformed JSON chunks
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

/** Pre-configured: RTP-hosted open-source model (Tier 1 -- free, no API key) */
export function createRTPProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'rtp-hosted',
    name: 'RTP Community Model',
    baseUrl: import.meta.env.VITE_RTP_MODEL_URL ?? 'https://api.relationaltech.org',
    defaultModels: [
      { id: 'qwen2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', provider: 'rtp-hosted' },
    ],
  });
}

/** Pre-configured: OpenAI (Tier 2 -- BYOK) */
export function createOpenAIProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com',
    defaultModels: [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
    ],
  });
}

/** Pre-configured: OpenRouter (Tier 2 -- BYOK, access to many models) */
export function createOpenRouterProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'openrouter',
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api',
    defaultModels: [
      { id: 'anthropic/claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'openrouter' },
      { id: 'google/gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'openrouter' },
    ],
  });
}
