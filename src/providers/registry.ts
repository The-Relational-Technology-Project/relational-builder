import type { LLMProvider, ModelInfo } from './types';
import {
  createRTPProvider,
  createTogetherProvider,
  createOpenAIProvider,
  createOpenRouterProvider,
  createGeminiProvider,
  createDeepSeekProvider,
  createZaiProvider,
  createMoonshotProvider,
  createMistralProvider,
  OpenAICompatibleProvider,
} from './openai-compatible';
import { ClaudeProvider, CLAUDE_MODELS } from './claude';

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

    // Tier 1: RTP-hosted (free, no API key) — only offered once the vLLM
    // endpoint is live (VITE_RTP_MODEL_URL set)
    const rtpProvider = createRTPProvider();
    if (rtpProvider) this.register(rtpProvider, 1, false);

    // Tier 2: Other BYOK providers. Open-weight-first ordering: the strong
    // MIT/Apache-licensed labs sit right beside the proprietary ones, and
    // OpenRouter closes the list as the universal catch-all.
    this.register(createDeepSeekProvider(), 2, true);
    this.register(createZaiProvider(), 2, true);
    this.register(createOpenAIProvider(), 2, true);
    this.register(createGeminiProvider(), 2, true);
    this.register(createMoonshotProvider(), 2, true);
    this.register(createMistralProvider(), 2, true);
    this.register(createTogetherProvider(), 2, true);
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
    // In parallel, and one slow or failing provider doesn't hide the others'
    // models — this used to await each provider in sequence
    const configured = Array.from(this.providers.values()).filter(({ provider }) =>
      provider.isConfigured(),
    );
    const settled = await Promise.allSettled(configured.map(({ provider }) => provider.getModels()));
    return settled.flatMap(r => (r.status === 'fulfilled' ? r.value : []));
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
      return CLAUDE_MODELS;
    }
    return [];
  }
}

export const registry = new ProviderRegistry();
