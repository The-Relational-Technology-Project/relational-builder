import type { BenchModel } from './types';

/**
 * The benchmark model matrix. Adding a new candidate (a fresh Claude, GPT, or
 * Gemini release, an open model on Together) is one entry here — nothing else
 * changes. `enabled: false` entries are announced-but-not-yet-testable models;
 * they run only when named explicitly via --models.
 *
 * Pricing is per million tokens, from each provider's public price page, and
 * only feeds the *estimated* cost column (token counts are chars/4 estimates).
 */
export const BENCH_MODELS: BenchModel[] = [
  // --- Anthropic (env: ANTHROPIC_API_KEY) ---
  {
    alias: 'claude-opus-5',
    providerId: 'claude',
    modelId: 'claude-opus-5',
    pricing: { inputPerMTok: 5, outputPerMTok: 25, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'claude-opus-4-8',
    providerId: 'claude',
    modelId: 'claude-opus-4-8',
    // Was mistakenly listed at 15/75 (Opus 4.1 pricing); 4.8 is 5/25.
    pricing: { inputPerMTok: 5, outputPerMTok: 25, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'claude-sonnet-5',
    providerId: 'claude',
    modelId: 'claude-sonnet-5',
    pricing: { inputPerMTok: 3, outputPerMTok: 15, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'claude-haiku-4-5',
    providerId: 'claude',
    modelId: 'claude-haiku-4-5',
    pricing: { inputPerMTok: 1, outputPerMTok: 5, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'claude-fable-5',
    providerId: 'claude',
    modelId: 'claude-fable-5',
    pricing: { inputPerMTok: 10, outputPerMTok: 50, asOf: '2026-07' },
    enabled: true,
  },

  // --- OpenAI (env: OPENAI_API_KEY) ---
  {
    alias: 'gpt-5.5',
    providerId: 'openai',
    modelId: 'gpt-5.5',
    pricing: { inputPerMTok: 2.5, outputPerMTok: 10, asOf: '2026-07' },
    enabled: true,
  },
  // --- Google (env: GEMINI_API_KEY) ---
  {
    alias: 'gemini-3.5-flash',
    providerId: 'gemini',
    modelId: 'gemini-3.5-flash',
    pricing: { inputPerMTok: 0.3, outputPerMTok: 2.5, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'gemini-3.5-pro',
    providerId: 'gemini',
    modelId: 'gemini-3.5-pro',
    enabled: false,
  },

  // --- Together: open models, candidates for the free RTP-hosted tier
  //     (env: TOGETHER_API_KEY) ---
  {
    alias: 'qwen3-coder',
    providerId: 'together',
    modelId: 'Qwen/Qwen3-Coder-Next-FP8',
    pricing: { inputPerMTok: 0.9, outputPerMTok: 1.2, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'deepseek-v3.1',
    providerId: 'together',
    modelId: 'deepseek-ai/DeepSeek-V3.1',
    pricing: { inputPerMTok: 0.6, outputPerMTok: 1.7, asOf: '2026-07' },
    enabled: true,
  },
  {
    alias: 'llama-3.3-70b',
    providerId: 'together',
    modelId: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    pricing: { inputPerMTok: 0.88, outputPerMTok: 0.88, asOf: '2026-07' },
    enabled: true,
  },

  // --- OpenRouter mirrors (env: OPENROUTER_API_KEY) --- one key, many
  //     vendors, identical OpenAI-format requests across all of them.
  //     Disabled so the default matrix stays direct-API; name explicitly
  //     via --models to run. Pricing = OpenRouter list prices.
  {
    alias: 'fable-5',
    providerId: 'openrouter',
    modelId: 'anthropic/claude-fable-5',
    pricing: { inputPerMTok: 10, outputPerMTok: 50, asOf: '2026-07' },
    enabled: false,
  },
  {
    alias: 'opus-5',
    providerId: 'openrouter',
    modelId: 'anthropic/claude-opus-5',
    pricing: { inputPerMTok: 5, outputPerMTok: 25, asOf: '2026-07' },
    enabled: false,
  },
  {
    alias: 'opus-4.8',
    providerId: 'openrouter',
    modelId: 'anthropic/claude-opus-4.8',
    pricing: { inputPerMTok: 5, outputPerMTok: 25, asOf: '2026-07' },
    enabled: false,
  },
  {
    alias: 'gemini-3.1-pro',
    providerId: 'openrouter',
    modelId: 'google/gemini-3.1-pro-preview',
    pricing: { inputPerMTok: 2, outputPerMTok: 12, asOf: '2026-07' },
    enabled: false,
  },
  {
    alias: 'gpt-5.6-sol',
    providerId: 'openrouter',
    modelId: 'openai/gpt-5.6-sol',
    pricing: { inputPerMTok: 5, outputPerMTok: 30, asOf: '2026-07' },
    enabled: false,
  },
  {
    alias: 'kimi-k3',
    providerId: 'openrouter',
    modelId: 'moonshotai/kimi-k3',
    pricing: { inputPerMTok: 3, outputPerMTok: 15, asOf: '2026-07' },
    enabled: false,
  },
];

export function resolveModels(csv: string | undefined): BenchModel[] {
  if (!csv) return BENCH_MODELS.filter(m => m.enabled);
  const wanted = csv.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = wanted.filter(w => !BENCH_MODELS.some(m => m.alias === w));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown model alias(es): ${unknown.join(', ')}. Known: ${BENCH_MODELS.map(m => m.alias).join(', ')}`,
    );
  }
  // Explicit naming overrides `enabled` — how future models get a first spin.
  return wanted.map(w => BENCH_MODELS.find(m => m.alias === w)!);
}

export const ENV_KEYS: Record<BenchModel['providerId'], string> = {
  claude: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  together: 'TOGETHER_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
};
