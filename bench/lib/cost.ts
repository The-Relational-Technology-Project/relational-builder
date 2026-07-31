import type { BenchModel } from '../types';

// 1.1.0: session loop honors NEXT-FILES chunk boundaries (production parity —
// ChatPanel auto-continues planned chunks; the bench previously only
// continued on truncation, so chunking models scored bundle ✗ unfairly).
// 1.1.1: overload/429 rejections retry with backoff instead of failing the
// trial after one immediate re-roll (capacity weather, not model signal).
// 1.2.0: extractor recognizes fence openers glued to the end of a prose line
// (Kimi K3 writes these; they previously inverted fence parity and silently
// dropped every file in the segment). Extraction semantics changed —
// don't compare bundle/checks columns against pre-1.2.0 runs.
export const HARNESS_VERSION = '1.2.0';

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
