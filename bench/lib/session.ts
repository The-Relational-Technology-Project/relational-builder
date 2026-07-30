import { extractOperations } from '@/project/code-extractor';
import type { ChatMessage, LLMProvider } from '@/providers/types';
import { contentToText } from '@/providers/types';

/**
 * One generation "session": the initial reply plus the same automatic
 * continuation loop production runs — both kinds: a reply cut off mid-file
 * (output cap or dead stream) and a deliberate chunk boundary (a clean reply
 * ending in `NEXT-FILES: …`, which the system prompt teaches for large
 * builds). Callers build the opening messages (system first) — a plain build
 * ask is [system, user(task)]; a plan-approved build is [system, user(task),
 * assistant(plan), user(go)].
 *
 * The constants below are copied verbatim from
 * src/components/Chat/ChatPanel.tsx (a React component the harness can't
 * import) — keep them in sync with production.
 */

/** An unterminated fence means the reply was cut off mid-file */
function endsInsideCodeFence(content: string): boolean {
  return content.split('\n').filter(l => l.startsWith('```')).length % 2 === 1;
}

const MAX_CONTINUATIONS = 3;

/** A deliberately chunked build reply ends with this marker line */
const CHUNK_MARKER = /^NEXT-FILES:\s*(\S.*)$/m;

/** Same shape as production's continuePrompt(planned): grounded in the files
 *  already extracted from prior segments, since "which files are done" can't
 *  ride on the model's memory of its own reply. */
function continuePrompt(planned: boolean, segmentTexts: string[]): string {
  const base = planned
    ? 'Continue the build with the remaining files you listed. Do not repeat files that are already complete. Skip any preamble: one short line saying you\'re continuing, then the files.'
    : 'Your previous reply was interrupted mid-stream, likely mid-file. Continue the build: first re-output the file that was cut off — complete, from its first line — then every file you had planned but not yet written. Do not repeat files that were already complete. Skip any explanation of the interruption: one short line saying you\'re continuing, then the files.';
  const applied = segmentTexts.flatMap(t => extractOperations(t).writes.map(w => w.path));
  if (applied.length === 0) return base;
  return `${base}\n\nThese files are already complete in the project (do not re-output them): ${applied.join(', ')}. Every other file your plan calls for${planned ? '' : ' — including the one that was cut off —'} is NOT in the project yet and must be written now.`;
}

export interface SessionSegment {
  finishReason: string | null;
  latencyMs: number;
  chars: number;
}

export interface SessionResult {
  /** One markdown reply per segment — production extracts each message
   *  separately, so the pipeline consumes them in order, not concatenated */
  segmentTexts: string[];
  segments: SessionSegment[];
  continuations: number;
  truncatedFinal: boolean;
  ttftMs: number | null;
  latencyMs: number;
  /** Total request chars actually sent across all rounds (system + history
   *  resent per continuation) — the input side of the cost estimate */
  sentChars: number;
}

export async function runSession(
  provider: LLMProvider,
  modelId: string,
  initialMessages: ChatMessage[],
  timeoutMs: number,
): Promise<SessionResult> {
  const messages: ChatMessage[] = [...initialMessages];

  const segmentTexts: string[] = [];
  const segments: SessionSegment[] = [];
  let ttftMs: number | null = null;
  let truncatedFinal = false;
  let sentChars = 0;
  const sessionStart = Date.now();

  for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
    const segStart = Date.now();
    let segText = '';
    let finishReason: string | null = null;
    sentChars += messages.reduce((n, m) => n + contentToText(m.content).length, 0);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    // Abort alone isn't enough: a stream whose socket died silently (e.g. a
    // container suspend reset it) can leave the body read pending forever —
    // abort doesn't always propagate through proxy dispatchers. The hard
    // deadline rejects the race and fails the segment; the leaked request is
    // abandoned, which beats a run wedged until someone kills it.
    let hardTimer: ReturnType<typeof setTimeout>;
    const hardDeadline = new Promise<never>((_, reject) => {
      hardTimer = setTimeout(
        () => reject(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s (hard deadline — stream never settled)`)),
        timeoutMs + 60_000,
      );
    });
    try {
      const streamed = new Promise<void>((resolve, reject) => {
        provider
          .chat(
            messages,
            modelId,
            {
              onToken: t => {
                if (ttftMs === null) ttftMs = Date.now() - sessionStart;
                segText += t;
              },
              onFinishReason: r => {
                finishReason = r;
              },
              onComplete: () => resolve(),
              // Providers report mid-stream failures here instead of rejecting
              onError: err => reject(err),
            },
            ac.signal,
          )
          .catch(reject); // pre-stream failures (HTTP errors) reject the call itself
      });
      await Promise.race([streamed, hardDeadline]);
    } catch (err) {
      if (ac.signal.aborted) {
        throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s (partial reply: ${segText.length} chars)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
      clearTimeout(hardTimer!);
    }

    segments.push({ finishReason, latencyMs: Date.now() - segStart, chars: segText.length });
    segmentTexts.push(segText);

    const cutOff = finishReason === 'length' || endsInsideCodeFence(segText);
    // A clean reply that declares remaining files is a planned chunk
    // boundary — continue the chain on purpose, like production does
    const chunked = !cutOff && CHUNK_MARKER.test(segText);
    if (!cutOff && !chunked) break;
    if (round === MAX_CONTINUATIONS) {
      // Chain capped with work still declared/cut off — the build is
      // incomplete either way
      truncatedFinal = true;
      break;
    }
    messages.push({ role: 'assistant', content: segText });
    messages.push({ role: 'user', content: continuePrompt(chunked, segmentTexts) });
  }

  // A completion that streamed no content at all is a failed generation, not
  // a valid empty build — some providers occasionally close a stream with zero
  // tokens and no error. Throw so the caller's one-shot retry re-rolls it,
  // rather than scoring an empty reply as "0 files, bundle ✗".
  if (segmentTexts.reduce((n, t) => n + t.length, 0) === 0) {
    throw new Error('empty completion — provider streamed no content');
  }

  return {
    segmentTexts,
    segments,
    continuations: segments.length - 1,
    truncatedFinal,
    ttftMs,
    latencyMs: Date.now() - sessionStart,
    sentChars,
  };
}
