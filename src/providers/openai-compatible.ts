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
  // Path segment between baseUrl and /chat/completions. Most providers use
  // '/v1'; Google's OpenAI-compatibility layer already includes the version
  // in its base URL, so it passes ''.
  private apiPath: string;
  // BYOK providers aren't configured until a key exists — prevents pointless
  // 401-spamming model fetches on load
  private requiresKey: boolean;
  // Optional output cap. When unset, requests omit max_tokens and the
  // endpoint applies its own default — some (OpenRouter) pre-authorize that
  // default against remaining credit, so a cap also keeps low-balance
  // accounts usable.
  private maxTokens?: number;

  constructor(config: {
    id: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    defaultModels?: ModelInfo[];
    apiPath?: string;
    requiresKey?: boolean;
    maxTokens?: number;
  }) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey ?? '';
    this.defaultModels = config.defaultModels ?? [];
    this.apiPath = config.apiPath ?? '/v1';
    this.requiresKey = config.requiresKey ?? true;
    this.maxTokens = config.maxTokens;
  }

  setMaxTokens(n: number | undefined) {
    this.maxTokens = n;
  }

  isConfigured(): boolean {
    return !!this.baseUrl && (!this.requiresKey || !!this.apiKey);
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/$/, '');
  }

  /** Return hardcoded default models (sync, no API calls) */
  getDefaultModelsList(): ModelInfo[] {
    return this.defaultModels;
  }

  async getModels(): Promise<ModelInfo[]> {
    if (!this.isConfigured()) return this.defaultModels;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

      const res = await fetch(`${this.baseUrl}${this.apiPath}/models`, { headers });
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

    // The prompt carries Anthropic cache-boundary markers (context-builder's
    // CACHE_BREAK in the system prompt, TURN_BREAK at the end of the final
    // user message) — meaningless here, so strip them everywhere
    const stripMarkers = (t: string) =>
      t.replaceAll('<<<RB_CACHE_BREAK>>>', '\n').replaceAll('<<<RB_TURN_BREAK>>>', '\n');
    const cleaned = messages.map(m => {
      if (typeof m.content === 'string') return { ...m, content: stripMarkers(m.content) };
      return {
        ...m,
        content: m.content.map(p =>
          p.type === 'text' ? { ...p, text: stripMarkers(p.text) } : p,
        ),
      };
    });

    const res = await fetch(`${this.baseUrl}${this.apiPath}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: cleaned,
        stream: true,
        ...(this.maxTokens ? { max_tokens: this.maxTokens } : {}),
      }),
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
            const choice = parsed.choices?.[0];
            const token = choice?.delta?.content;
            if (token) {
              fullText += token;
              callbacks.onToken(token);
            }
            // Reasoning-capable providers (DeepSeek et al.) stream thinking here
            const reasoning = choice?.delta?.reasoning_content;
            if (reasoning) {
              callbacks.onReasoning?.(reasoning);
            }
            if (choice?.finish_reason) {
              callbacks.onFinishReason?.(choice.finish_reason);
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

/**
 * Pre-configured: RTP-hosted open-source model (Tier 1 -- free, no API key).
 * Returns null until VITE_RTP_MODEL_URL is set — the vLLM endpoint isn't
 * live yet, and offering a dead "Free" provider is a trap (people pick it
 * over community access and get "Failed to fetch").
 */
export function createRTPProvider(): OpenAICompatibleProvider | null {
  const baseUrl = import.meta.env.VITE_RTP_MODEL_URL;
  if (!baseUrl) return null;
  return new OpenAICompatibleProvider({
    id: 'rtp-hosted',
    name: 'RTP Community Model',
    baseUrl,
    requiresKey: false,
    defaultModels: [
      { id: 'qwen2.5-coder-32b', name: 'Qwen 2.5 Coder 32B', provider: 'rtp-hosted' },
    ],
  });
}

/** Pre-configured: Together AI (Tier 2 -- BYOK, serverless open-source models) */
export function createTogetherProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'together',
    name: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    defaultModels: [
      { id: 'Qwen/Qwen3-Coder-Next-FP8', name: 'Qwen3 Coder Next', provider: 'together' },
      { id: 'deepseek-ai/DeepSeek-V3.1', name: 'DeepSeek V3.1', provider: 'together' },
      { id: 'Qwen/Qwen3.5-397B-A17B', name: 'Qwen 3.5 397B', provider: 'together' },
      { id: 'MiniMaxAI/MiniMax-M2.7', name: 'MiniMax M2.7', provider: 'together' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct-Turbo', name: 'Llama 3.3 70B', provider: 'together' },
      { id: 'google/gemma-4-31B-it', name: 'Gemma 4 31B', provider: 'together' },
    ],
  });
}

/** Pre-configured: Moonshot AI direct (Kimi models, international platform) */
export function createMoonshotProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'moonshot',
    name: 'Moonshot AI',
    baseUrl: 'https://api.moonshot.ai',
    defaultModels: [
      { id: 'kimi-k3', name: 'Kimi K3', provider: 'moonshot' },
    ],
  });
}

/** Pre-configured: DeepSeek direct (open-weight MIT models, lowest frontier prices) */
export function createDeepSeekProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    defaultModels: [
      // Stable aliases that track the current release (V4 line)
      { id: 'deepseek-chat', name: 'DeepSeek Chat', provider: 'deepseek' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner', provider: 'deepseek' },
    ],
  });
}

/** Pre-configured: Z.ai (GLM open-weight models via the OpenAI-compatible endpoint) */
export function createZaiProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'zai',
    name: 'Z.ai (GLM)',
    baseUrl: 'https://api.z.ai/api/paas',
    apiPath: '/v4',
    defaultModels: [
      { id: 'glm-5.2', name: 'GLM-5.2', provider: 'zai' },
      { id: 'glm-4.7', name: 'GLM-4.7', provider: 'zai' },
      { id: 'glm-4.7-flash', name: 'GLM-4.7 Flash', provider: 'zai' },
    ],
  });
}

/** Pre-configured: Mistral (Devstral open-weight coding line, European provider) */
export function createMistralProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'mistral',
    name: 'Mistral',
    baseUrl: 'https://api.mistral.ai',
    defaultModels: [
      { id: 'devstral-medium-latest', name: 'Devstral 2', provider: 'mistral' },
      { id: 'devstral-small-latest', name: 'Devstral Small 2', provider: 'mistral' },
      { id: 'mistral-large-latest', name: 'Mistral Large', provider: 'mistral' },
    ],
  });
}

/** Pre-configured: Google Gemini (Tier 2 -- BYOK, via Google's OpenAI-compatibility layer) */
export function createGeminiProvider(): OpenAICompatibleProvider {
  return new OpenAICompatibleProvider({
    id: 'gemini',
    name: 'Google Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiPath: '',
    defaultModels: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'gemini' },
      { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro (Preview)', provider: 'gemini' },
      { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash-Lite', provider: 'gemini' },
      { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'gemini' },
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
      { id: 'gpt-5.5', name: 'GPT-5.5', provider: 'openai' },
      { id: 'gpt-5.2', name: 'GPT-5.2', provider: 'openai' },
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
      { id: 'anthropic/claude-sonnet-5', name: 'Claude Sonnet 5', provider: 'openrouter' },
      { id: 'google/gemini-3.5-flash', name: 'Gemini 3.5 Flash', provider: 'openrouter' },
    ],
  });
}
