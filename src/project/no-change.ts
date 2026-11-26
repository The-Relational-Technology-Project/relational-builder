/**
 * The reply that says "done" while the project stays exactly as it was.
 *
 * A builder on Gemma spent several turns in this loop: the model said it had
 * made the change, she said she couldn't see it, it said so again. The
 * Builder knew the whole time: it applies every reply itself, so it can tell
 * a reply that changed files from one that only talked about changing them.
 * This module turns that knowledge into two things: a plain note on the
 * reply (which the model also reads back next turn), and, where the cause is
 * mechanical, one automatic second try through the continuation channel.
 *
 * Three ways a reply changes nothing:
 * - `unapplied`: it wrote code, and none of it could be applied (edits that
 *   didn't match the current file, an edit to a file that isn't there)
 * - `identical`: it wrote files that are byte-for-byte what was already there
 * - `described`: it wrote no code at all, only a "What changed" summary
 * A fourth, `mentioned`, is softer: no code, and prose that reads like a
 * claim ("I've added…"). That one gets the note and no retry, because a
 * reply can fairly mention an earlier change while answering a question.
 */

export interface ApplyOutcome {
  /** File writes plus edit blocks the reply carried */
  attempted: number;
  /** Files whose contents are different after applying */
  changed: number;
  warnings: string[];
}

export type NoChangeKind = 'unapplied' | 'identical' | 'described' | 'mentioned';

export interface NoChange {
  kind: NoChangeKind;
  /** Appended to the reply in chat, for the person (and the model next turn) */
  note: string;
  /** Sent through the continuation channel for one automatic second try */
  retryPrompt: string | null;
}

/** The reply's prose, with fenced code removed */
function prose(reply: string): string {
  return reply.replace(/```[\s\S]*?(```|$)/g, '');
}

const SUMMARY = /(^|\n)\s*(#{1,4}\s*|\*\*)?what(?:'s| has)? changed\b/i;
const CLAIM =
  /\bI(?:'ve| have)?\s+(?:now\s+|just\s+|also\s+)?(?:added|updated|changed|fixed|restored|removed|replaced|rebuilt|moved|rewritten|rewrote|reverted|put back|brought back|made the change)\b|\b(?:is|are|has been|have been) (?:now )?(?:added|updated|fixed|restored|removed|in place)\b/i;

const SAME =
  'Nothing in the project changed with this reply, so the preview looks the same as before.';

/**
 * Did this reply leave the project untouched while implying otherwise?
 * `canRetry` is whether the Builder may ask once more on its own (never after
 * a reply that was itself an automatic pass, so this cannot loop).
 */
export function assessNoChange(reply: string, outcome: ApplyOutcome, canRetry: boolean): NoChange | null {
  if (outcome.changed > 0) return null;
  const again = canRetry ? ' Asking for it again automatically.' : '';
  const stuck = canRetry
    ? ''
    : ' It has now missed twice. Try saying it a different way, or switch to another model in the model menu.';

  if (outcome.attempted > 0 && outcome.warnings.length > 0) {
    return {
      kind: 'unapplied',
      note: `${SAME} The change it wrote did not fit the current files.${again}${stuck}`,
      retryPrompt: canRetry
        ? [
            'The Builder could not apply your last reply, so nothing in the project changed and the person is still looking at the old version.',
            `What went wrong: ${outcome.warnings.join(' ')}`,
            'Start with one plain sentence telling the person the first try did not land. Then output every file you meant to change as a COMPLETE file (no edit blocks), copying everything you are not changing exactly from the current contents in your context. If a file you need shows as "(contents omitted)" or "(truncated)", ask for it with a NEED-FILES line instead of guessing.',
          ].join('\n\n')
        : null,
    };
  }

  if (outcome.attempted > 0) {
    return {
      kind: 'identical',
      note: `${SAME} What it wrote is identical to what was already there.${again}${stuck}`,
      retryPrompt: canRetry
        ? [
            'The files in your last reply are identical to what the project already had, so nothing changed and the person sees no difference.',
            'Look at the current files in your context and decide which is true, then say it plainly in one sentence. Either the change was already in place: say so, say exactly where in the app the person should look for it, and name anything that could be hiding it (another page or tab, a condition, empty data), without re-outputting any file. Or the change was left out: write it now as a complete file.',
          ].join('\n\n')
        : null,
    };
  }

  const text = prose(reply);
  if (SUMMARY.test(text)) {
    return {
      kind: 'described',
      note: `${SAME} It described a change but did not write one.${again}${stuck}`,
      retryPrompt: canRetry
        ? [
            'Your last reply described a change but contained no code blocks, so nothing in the project changed and the person sees no difference.',
            'Start with one plain sentence telling the person that reply changed nothing. Then make the change for real: output the file(s) with their `filename="..."` code blocks. If you cannot make the change (you cannot see what you need, or the Builder has no way to do it), say that instead and say what the person can do.',
          ].join('\n\n')
        : null,
    };
  }
  if (CLAIM.test(text)) {
    return { kind: 'mentioned', note: 'This reply did not change any files in the project.', retryPrompt: null };
  }
  return null;
}
