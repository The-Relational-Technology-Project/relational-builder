// Evaluate the registry first — same order the app loads. Importing claude.ts
// directly would enter the claude → community-store → provider-store →
// registry cycle from the wrong side and hit a half-evaluated module.
import '@/providers/registry';
import { ClaudeProvider } from '@/providers/claude';
import {
  createGeminiProvider,
  createMoonshotProvider,
  createOpenAIProvider,
  createOpenRouterProvider,
  createTogetherProvider,
} from '@/providers/openai-compatible';
import type { LLMProvider } from '@/providers/types';
import { ENV_KEYS } from '../models';
import type { BenchModel } from '../types';

/**
 * Providers are constructed directly — not via the app's registry singleton —
 * so keys come from env vars only and no store state leaks into a run.
 * bootstrap.mjs blanks VITE_LLM_PROXY_URL, so ClaudeProvider takes its
 * direct-API path (same request shape production's proxy sends upstream:
 * adaptive thinking, xhigh effort, cache segmentation).
 */
export function providerFor(model: BenchModel): LLMProvider {
  const key = process.env[ENV_KEYS[model.providerId]] ?? '';
  if (!key) {
    throw new Error(`${ENV_KEYS[model.providerId]} is not set (needed for ${model.alias})`);
  }
  switch (model.providerId) {
    case 'claude':
      return new ClaudeProvider(key);
    case 'openai': {
      const p = createOpenAIProvider();
      p.setApiKey(key);
      return p;
    }
    case 'gemini': {
      const p = createGeminiProvider();
      p.setApiKey(key);
      return p;
    }
    case 'together': {
      const p = createTogetherProvider();
      p.setApiKey(key);
      return p;
    }
    case 'moonshot': {
      const p = createMoonshotProvider();
      p.setApiKey(key);
      return p;
    }
    case 'openrouter': {
      const p = createOpenRouterProvider();
      p.setApiKey(key);
      // OpenRouter pre-authorizes the request's max_tokens (default: the
      // model's full output ceiling) against remaining credit — a low
      // balance 402s before a single token streams. BENCH_MAX_TOKENS caps
      // the request; builds on the frozen tasks run well under 30k output.
      const cap = parseInt(process.env.BENCH_MAX_TOKENS ?? '', 10);
      if (Number.isFinite(cap) && cap > 0) p.setMaxTokens(cap);
      return p;
    }
  }
}
