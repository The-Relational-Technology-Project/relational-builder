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
    alias: 'claude-opus-5-5',
    providerId: 'claude',
    modelId: 'claude-opus-5-5',
    // Cheaper than Opus 5 at list ($4/$20 vs $5/$25). Thinking can't be
    // disabled on 5.5 and its effort default is medium, not high — the Claude
    // provider sends effort explicitly (xhigh for builds), so the bench
    // measures the same request shape production would send.
    pricing: { inputPerMTok: 4, outputPerMTok: 20, asOf: '2026-09' },
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
  {
    alias: 'claude-fable-5-1',
    providerId: 'claude',
    modelId: 'claude-fable-5-1',
    // Same list price as Fable 5; cache reads are cheaper ($0.25/MTok) but
    // the bench's chars/4 estimate doesn't model caching anyway.
    pricing: { inputPerMTok: 10, outputPerMTok: 50, asOf: '2026-09' },
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
    // The reference for the human-scale bench (production's build model),
    // through OpenRouter so one key covers the comparison. List price Oct 31.
    alias: 'opus-5-5',
    providerId: 'openrouter',
    modelId: 'anthropic/claude-opus-5.5',
    pricing: { inputPerMTok: 4, outputPerMTok: 20, asOf: '2026-10' },
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
    // The edit-slot candidate. List prices here, not the $2/$10 intro rate
    // running to 2026-08-31 — an estimate that quietly assumes a promotion
    // would flatter the comparison the month it expires.
    alias: 'sonnet-5',
    providerId: 'openrouter',
    modelId: 'anthropic/claude-sonnet-5',
    pricing: { inputPerMTok: 3, outputPerMTok: 15, asOf: '2026-07' },
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

  // --- OpenRouter: open-weight coding models a community could realistically
  //     host (human-scale branch, workstream 2). Chosen Oct 30, 2026 for
  //     hostability on one box, not leaderboard rank: a 30B MoE with 3B
  //     active (fits 32 GB at 4-bit), a 26B MoE with 4B active, and the
  //     120B open reference that needs an 80 GB card. Pricing = OpenRouter
  //     list prices on Oct 30, 2026. Disabled so the default matrix is
  //     unchanged; name via --models. ---
  {
    alias: 'qwen3-coder-30b',
    providerId: 'openrouter',
    modelId: 'qwen/qwen3-coder-30b-a3b-instruct',
    pricing: { inputPerMTok: 0.07, outputPerMTok: 0.28, asOf: '2026-10' },
    enabled: false,
  },
  {
    alias: 'gemma-4-26b',
    providerId: 'openrouter',
    modelId: 'google/gemma-4-26b-a4b-it',
    pricing: { inputPerMTok: 0.09, outputPerMTok: 0.3, asOf: '2026-10' },
    enabled: false,
  },
  {
    alias: 'gpt-oss-120b',
    providerId: 'openrouter',
    modelId: 'openai/gpt-oss-120b',
    pricing: { inputPerMTok: 0.15, outputPerMTok: 0.6, asOf: '2026-10' },
    enabled: false,
  },
  // Two more open coders at list price (Josh, Oct 30). Both bigger than a
  // single community box today; they bound what "open" can do.
  {
    alias: 'qwen3-coder-next',
    providerId: 'openrouter',
    modelId: 'qwen/qwen3-coder-next',
    pricing: { inputPerMTok: 0.12, outputPerMTok: 0.8, asOf: '2026-10' },
    enabled: false,
  },
  {
    alias: 'glm-4.5-air',
    providerId: 'openrouter',
    modelId: 'z-ai/glm-4.5-air',
    pricing: { inputPerMTok: 0.13, outputPerMTok: 0.85, asOf: '2026-10' },
    enabled: false,
  },

  // --- Moonshot direct (env: MOONSHOT_API_KEY) --- the OpenRouter kimi-k3
  //     mirror above runs on whichever host OpenRouter routes to; this one
  //     hits Moonshot's own API, so latency and quality are the model's own.
  //     Pricing unset until confirmed on platform.moonshot.ai — cost column
  //     shows "price unknown" rather than a guess.
  {
    alias: 'kimi-k3-direct',
    providerId: 'moonshot',
    modelId: 'kimi-k3',
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
  moonshot: 'MOONSHOT_API_KEY',
};
