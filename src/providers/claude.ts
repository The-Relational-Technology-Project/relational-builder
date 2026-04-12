import type { LLMProvider, ChatMessage, StreamCallbacks, ModelInfo } from './types';

/**
 * Anthropic Claude provider (Tier 2 -- BYOK).
 * Uses the Anthropic Messages API directly.
 */
export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';
  readonly name = 'Claude (Anthropic)';
  private apiKey: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? '';
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  setApiKey(key: string) {
    this.apiKey = key;
  }

  async getModels(): Promise<ModelInfo[]> {
    return [
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'claude' },
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude' },
      { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', provider: 'claude' },
    ];
  }

  async chat(
    messages: ChatMessage[],
    model: string,
    callbacks: StreamCallbacks,
    signal?: AbortSignal,
  ): Promise<void> {
    // Separate system message from conversation
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

    // Note: direct browser→Anthropic requests require CORS.
    // In production this should go through a lightweight proxy.
    // For BYOK users, we use the anthropic API via their CORS proxy or a local proxy.
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
