/**
 * How many automatic fix passes the preview runs after a build.
 *
 * Production runs one: right after a build breaks the preview, one fix
 * fires on its own, and anything left is the person's button. The bench
 * measured a second pass on Nov 4 (gemma, two prompts, three trials each):
 * with one pass 4 of 6 builds came out clean, with two 5 of 6, the second
 * pass used once. Small models often fix what they are shown and surface
 * the next error underneath, which a second look solves. So behind the
 * flag the preview allows two, with one guard against loops: the second
 * pass fires only for a DIFFERENT error than the first one fixed. The same
 * error surviving is the person's call, as it is today.
 */

export const AUTO_FIX_PASSES = { default: 1, humanScale: 2 } as const;

export function autoFixPassLimit(humanScale: boolean): number {
  return humanScale ? AUTO_FIX_PASSES.humanScale : AUTO_FIX_PASSES.default;
}

/** After a reply finishes clean: should another automatic pass be armed? */
export function armAfterReply(input: {
  /** The reply was an error fix (not a build or a continuation) */
  wasFix: boolean;
  wasContinuation: boolean;
  /** That fix was one the preview sent on its own */
  lastFixWasAuto: boolean;
  passesUsed: number;
  humanScale: boolean;
}): { armed: boolean; passesUsed: number } {
  // A normal build or a finished continuation chain starts over
  if (!input.wasFix || input.wasContinuation) return { armed: true, passesUsed: 0 };
  // A person's own fix never re-arms the automatic pass
  if (!input.lastFixWasAuto) return { armed: false, passesUsed: input.passesUsed };
  return { armed: input.passesUsed < autoFixPassLimit(input.humanScale), passesUsed: input.passesUsed };
}

/** May the armed automatic pass fire for this error? Not twice at the same one. */
export function mayAutoFix(input: { passesUsed: number; errorSignature: string; lastFixSignature: string | null }): boolean {
  if (input.passesUsed === 0) return true;
  return input.errorSignature !== input.lastFixSignature;
}
