import type { ChatMessage, LLMProvider } from '@/providers/types';

/**
 * One generation "session": the initial reply plus the same automatic
 * continuation loop production runs when a reply is cut off mid-file.
 *
 * The three constants below are copied verbatim from
 * src/components/Chat/ChatPanel.tsx (a React component the harness can't
 * import) — keep them in sync with production.
 */

/** An unterminated fence means the reply was cut off mid-file */
function endsInsideCodeFence(content: string): boolean {
  return content.split('\n').filter(l => l.startsWith('```')).length % 2 === 1;
}

const MAX_CONTINUATIONS = 3;

const CONTINUE_PROMPT =
  'Your previous reply was interrupted mid-stream, likely mid-file. Continue the build: first re-output the file that was cut off — complete, from its first line — then every file you had planned but not yet written. Do not repeat files that were already complete. Skip any explanation of the interruption: one short line saying you\'re continuing, then the files.';

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
}

export async function runSession(
  provider: LLMProvider,
  modelId: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
): Promise<SessionResult> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];

  const segmentTexts: string[] = [];
  const segments: SessionSegment[] = [];
  let ttftMs: number | null = null;
  let truncatedFinal = false;
  const sessionStart = Date.now();

  for (let round = 0; round <= MAX_CONTINUATIONS; round++) {
    const segStart = Date.now();
    let segText = '';
    let finishReason: string | null = null;

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      await new Promise<void>((resolve, reject) => {
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
    } catch (err) {
      if (ac.signal.aborted) {
        throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s (partial reply: ${segText.length} chars)`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    segments.push({ finishReason, latencyMs: Date.now() - segStart, chars: segText.length });
    segmentTexts.push(segText);

    const cutOff = finishReason === 'length' || endsInsideCodeFence(segText);
    if (!cutOff) break;
    if (round === MAX_CONTINUATIONS) {
      truncatedFinal = true;
      break;
    }
    messages.push({ role: 'assistant', content: segText });
    messages.push({ role: 'user', content: CONTINUE_PROMPT });
  }

  return {
    segmentTexts,
    segments,
    continuations: segments.length - 1,
    truncatedFinal,
    ttftMs,
    latencyMs: Date.now() - sessionStart,
  };
}
