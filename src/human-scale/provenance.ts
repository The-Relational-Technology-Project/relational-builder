/**
 * Footprint and provenance (workstream 3): one row per model call, builder
 * side or runtime side, and a labeled energy ESTIMATE for it.
 * See docs/human-scale/README.md ("Provenance record").
 *
 * The energy number is an estimate until we measure. It is derived, not
 * looked up: compute per token ~ 2 x active parameters (FLOPs), divided by
 * an assumed delivered efficiency for inference hardware, with the
 * assumptions written into `method` on every row so a reader can disagree
 * with them. Models whose active parameter count is not public get no
 * number and say why; we do not guess at a frontier model's size.
 */

export type ProvenanceSide = 'builder' | 'runtime';
export type ProvenanceHost = 'local' | 'hosted' | 'community';

export interface ProvenanceRow {
  /** ISO timestamp */
  at: string;
  side: ProvenanceSide;
  provider: string;
  model: string;
  /** Active parameters, when public (MoE: active, not total) */
  params?: number;
  host: ProvenanceHost;
  tokensIn: number;
  tokensOut: number;
  /** Watt-hours, an ESTIMATE; null when params are unknown */
  energyWhEstimate: number | null;
  /** How the estimate was made, in words, always present */
  method: string;
}

/**
 * Active parameter counts we are willing to state, from the model cards.
 * Keys are matched as substrings of the provider model id, longest first.
 */
export const KNOWN_ACTIVE_PARAMS: Array<[idSubstring: string, activeParams: number]> = [
  ['gemma-4-26b-a4b', 4e9],
  ['gemma-3-12b', 12e9],
  ['gemma-3-4b', 4e9],
  ['gemma-3-27b', 27e9],
  ['gemma3:4b', 4e9],
  ['gemma3:12b', 12e9],
  ['qwen3-coder-30b-a3b', 3e9],
  ['qwen3-30b-a3b', 3e9],
  ['qwen2.5:7b', 7e9],
  ['qwen2.5:3b', 3e9],
  ['qwen3:8b', 8e9],
  ['qwen3-32b', 32e9],
  ['gpt-oss-120b', 5.1e9],
  ['gpt-oss-20b', 3.6e9],
  ['llama-3.1-8b', 8e9],
  ['llama-3.3-70b', 70e9],
];

/** Parameters for a model id, or null when we do not know (frontier models) */
export function activeParamsFor(modelId: string): number | null {
  const id = modelId.toLowerCase();
  const hits = KNOWN_ACTIVE_PARAMS.filter(([k]) => id.includes(k)).sort((a, b) => b[0].length - a[0].length);
  return hits.length ? hits[0][1] : null;
}

/** Assumed delivered efficiency, in FLOPs per joule, by where it ran.
 *  Hosted: a datacenter accelerator at a low effective utilization for
 *  autoregressive decoding (an H100-class card peaks near 2e15 FLOP/s at
 *  700 W, about 3e12 FLOP/J; we assume 5 percent of that is delivered,
 *  1.4e11). Local: a laptop or small-box GPU or CPU, assumed 3e10. These
 *  are order-of-magnitude assumptions and are stated in `method`. */
export const ASSUMED_FLOP_PER_JOULE: Record<ProvenanceHost, number> = {
  hosted: 1.4e11,
  community: 1.4e11,
  local: 3e10,
};

export const ENERGY_METHOD_VERSION = 'rb-flops-v1';

/**
 * Energy estimate in watt-hours for one call: 2 x params x tokens / efficiency
 * (prompt tokens included; prefill is cheaper per token than decode, which
 * this ignores, so the number leans high for long prompts). Returns the
 * estimate and the sentence that explains it; null estimate when params are
 * unknown, with the reason in the sentence.
 */
export function estimateEnergyWh(input: {
  model: string;
  host: ProvenanceHost;
  tokensIn: number;
  tokensOut: number;
  params?: number | null;
}): { energyWhEstimate: number | null; method: string; params: number | null } {
  const params = input.params ?? activeParamsFor(input.model);
  const tokens = Math.max(0, input.tokensIn) + Math.max(0, input.tokensOut);
  if (!params) {
    return {
      energyWhEstimate: null,
      params: null,
      method: `${ENERGY_METHOD_VERSION}: no estimate; the active parameter count of ${input.model} is not public, and we do not guess.`,
    };
  }
  const flopPerJ = ASSUMED_FLOP_PER_JOULE[input.host];
  const joules = (2 * params * tokens) / flopPerJ;
  const wh = joules / 3600;
  return {
    energyWhEstimate: Math.round(wh * 1e4) / 1e4,
    params,
    method:
      `${ENERGY_METHOD_VERSION}: ESTIMATE. 2 FLOPs x ${formatParams(params)} active parameters x ${tokens} tokens, ` +
      `at an assumed ${flopPerJ.toExponential(1)} FLOP per joule for ${input.host} inference (order of magnitude; ` +
      `prefill counted like decode, so long prompts read high). Not measured.`,
  };
}

function formatParams(p: number): string {
  return p >= 1e9 ? `${Math.round((p / 1e9) * 10) / 10}B` : `${Math.round(p / 1e6)}M`;
}

/** Build a complete row from what a call reports. */
export function provenanceRow(input: {
  side: ProvenanceSide;
  provider: string;
  model: string;
  host: ProvenanceHost;
  tokensIn: number;
  tokensOut: number;
  params?: number | null;
  at?: string;
}): ProvenanceRow {
  const e = estimateEnergyWh(input);
  return {
    at: input.at ?? new Date().toISOString(),
    side: input.side,
    provider: input.provider,
    model: input.model,
    ...(e.params ? { params: e.params } : {}),
    host: input.host,
    tokensIn: input.tokensIn,
    tokensOut: input.tokensOut,
    energyWhEstimate: e.energyWhEstimate,
    method: e.method,
  };
}

/** One line for a footer: "Ran on gemma-4-26b (community), ~0.02 Wh est." */
export function describeRow(row: ProvenanceRow): string {
  const where = row.host === 'local' ? 'on this device or in the room' : row.host === 'community' ? 'on Community AI' : 'on a hosted model';
  const energy = row.energyWhEstimate === null ? 'energy not estimated (model size not public)' : `about ${row.energyWhEstimate} Wh, an estimate`;
  return `Ran ${where} (${row.model}), ${row.tokensIn + row.tokensOut} tokens, ${energy}.`;
}
