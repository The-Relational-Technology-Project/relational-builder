import { extractOperations } from '@/project/code-extractor';

/**
 * When a build's continuation chain has stopped making progress. Bench,
 * Nov 13: Mistral Small 3.2 wrote 175 files over four replies and 20
 * minutes on one remix, about 50 of them unique: each continuation
 * rewrote the kit components it had already written. Each reply stayed
 * under its own time cap, so nothing stopped it.
 *
 * Shared by the bench (bench/lib/session.ts) and, behind the human-scale
 * flag, the Builder's continuation decision (ChatPanel).
 */
export const RUNAWAY_MAX_WRITES = 60;
export const RUNAWAY_MAX_MS = 15 * 60 * 1000;

export function runawayReason(segmentTexts: string[], elapsedMs: number): string | null {
  if (segmentTexts.length >= 2) {
    const earlier = new Set(
      segmentTexts.slice(0, -1).flatMap(t => extractOperations(t).writes.map(w => w.path.replace(/^\//, ''))),
    );
    const latest = extractOperations(segmentTexts[segmentTexts.length - 1]).writes.map(w => w.path.replace(/^\//, ''));
    if (latest.length > 0 && latest.every(p => earlier.has(p))) {
      return 'the last continuation only rewrote files it had already written';
    }
  }
  const writes = segmentTexts.reduce((n, t) => n + extractOperations(t).writes.length, 0);
  if (writes > RUNAWAY_MAX_WRITES) return `more than ${RUNAWAY_MAX_WRITES} file writes in one build`;
  if (elapsedMs > RUNAWAY_MAX_MS) return `the build passed ${Math.round(RUNAWAY_MAX_MS / 60000)} minutes`;
  return null;
}
