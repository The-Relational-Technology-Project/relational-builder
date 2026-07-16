import type { BenchModel } from '../types';

export const HARNESS_VERSION = '1.0.0';

/** Rough enough for a cost *estimate* column — exact usage needs provider changes. */
export const charsToTokens = (chars: number): number => Math.ceil(chars / 4);

/** Typical first-build reply size, for pre-run estimates only. */
export const EST_OUTPUT_TOKENS = 12_000;

export function estimateCostUsd(
  model: BenchModel,
  inputTokens: number,
  outputTokens: number,
): number | null {
  if (!model.pricing) return null;
  return (
    (inputTokens / 1e6) * model.pricing.inputPerMTok +
    (outputTokens / 1e6) * model.pricing.outputPerMTok
  );
}
