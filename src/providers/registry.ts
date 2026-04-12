import type { LLMProvider, ModelInfo } from './types';
import { createRTPProvider, createTogetherProvider, createOpenAIProvider, createOpenRouterProvider, OpenAICompatibleProvider } from './openai-compatible';
import { ClaudeProvider } from './claude';

export interface ProviderEntry {
  provider: LLMProvider;
  tier: 1 | 2 | 3;
  requiresApiKey: boolean;
}

class ProviderRegistry {
  private providers = new Map<string, ProviderEntry>();

  constructor() {
    // Claude first — default provider during early development
    this.register(new ClaudeProvider(), 2, true);

    // Tier 1: RTP-hosted (free, no API key) — will become default once endpoint is live
    this.register(createRTPProvider(), 1, false);

    // Tier 2: Other BYOK providers
    this.register(createTogetherProvider(), 2, true);
    this.register(createOpenAIProvider(), 2, true);
    this.register(createOpenRouterProvider(), 2, true);
  }

  private register(provider: LLMProvider, tier: 1 | 2 | 3, requiresApiKey: boolean) {
    this.providers.set(provider.id, { provider, tier, requiresApiKey });
  }

  getProvider(id: string): LLMProvider | undefined {
    return this.providers.get(id)?.provider;
  }

  getEntry(id: string): ProviderEntry | undefined {
    return this.providers.get(id);
  }

  getAllEntries(): ProviderEntry[] {
    return Array.from(this.providers.values());
  }

  getProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /** Set API key for a provider */
  setApiKey(providerId: string, key: string) {
    const entry = this.providers.get(providerId);
    if (!entry) return;

    const p = entry.provider;
    if (p instanceof OpenAICompatibleProvider) {
      p.setApiKey(key);
    } else if (p instanceof ClaudeProvider) {
      p.setApiKey(key);
    }
  }

  /** Get all available models across configured providers (async — hits APIs) */
  async getAllModels(): Promise<ModelInfo[]> {
    const results: ModelInfo[] = [];
    for (const { provider } of this.providers.values()) {
      if (provider.isConfigured()) {
        const models = await provider.getModels();
        results.push(...models);
      }
    }
    return results;
  }

  /** Get default models for a specific provider (sync — no API calls) */
  getDefaultModels(providerId: string): ModelInfo[] {
    const entry = this.providers.get(providerId);
    if (!entry) return [];
    const p = entry.provider;
    if (p instanceof OpenAICompatibleProvider) {
      return p.getDefaultModelsList();
    }
    if (p instanceof ClaudeProvider) {
      return [
        { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'claude' },
        { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'claude' },
        { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', provider: 'claude' },
      ];
    }
    return [];
  }
}

export const registry = new ProviderRegistry();
