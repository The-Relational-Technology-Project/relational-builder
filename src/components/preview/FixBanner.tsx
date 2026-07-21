import { useEffect } from 'react';
import { Wrench, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { recordBuildEvent } from '@/report/build-log';

/**
 * Production React ships error CODES, not messages. The live preview now uses
 * dev React (real messages), but stale bundles, published pages opened in a
 * tab, and the Sandpack path can still surface minified codes — decode the
 * common ones so the fix prompt carries a diagnosis, not a number.
 */
const REACT_ERROR_DECODE: Record<string, string> = {
  '130': 'Element type is invalid — a component rendered as an object/undefined, usually a wrong import (default vs named) or a missing export.',
  '185': 'Maximum update depth exceeded — something triggers a state update on every render, looping forever. Common causes: calling a state setter during render; a useEffect that sets state it also depends on; a zustand selector that returns a NEW array/object each call (e.g. useStore(s => s.items.filter(...))) — select stored values directly and derive afterwards.',
  '300': 'Rendered fewer hooks than expected — usually an early return placed before some hook calls.',
  '310': 'Rendered more hooks than during the previous render — a hook is being called conditionally.',
  '321': 'Invalid hook call — a hook ran outside a function component, or two copies of React are loaded.',
};

function decodeMinifiedReactError(errorText: string): string | null {
  const m = errorText.match(/Minified React error #(\d+)/);
  if (!m) return null;
  const decoded = REACT_ERROR_DECODE[m[1]];
  return decoded ? `React error #${m[1]} means: ${decoded}` : null;
}

/**
 * A stable identity for an error across re-bundles: blob URLs (new every
 * bundle) and other URLs are stripped so "the same crash again" fingerprints
 * the same, letting the fix prompt escalate instead of repeating itself.
 */
function errorSignature(errorText: string): string {
  return errorText
    .replace(/blob:[^\s)]+/g, 'blob:')
    .replace(/https?:\/\/[^\s)]+/g, 'url:')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function fixPrompt(errorText: string, attempt: number): string {
  const decoded = decodeMinifiedReactError(errorText);
  const parts = [
    'The live preview is showing this error:',
    '',
    '```',
    errorText.slice(0, 2000),
    '```',
  ];
  if (decoded) parts.push('', decoded);
  if (attempt >= 2) {
    parts.push(
      '',
      `This is attempt ${attempt} at fixing this SAME error — the previous fix did not resolve it. Stop and re-diagnose from scratch: question the earlier theory of the cause, re-read the files changed most recently, and look for a different root cause (a state update during render, an unstable selector or hook dependency, an effect loop). State the actual cause in one line before fixing it.`,
    );
  }
  parts.push(
    '',
    'Please fix it. Re-output the complete corrected file(s) with filename annotations, changing as little else as possible.',
  );
  return parts.join('\n');
}

/** Queue a fix send, counting attempts at the same error so repeats escalate. */
function queueFixForError(error: string): void {
  const state = useChatStore.getState();
  const sig = errorSignature(error);
  const attempt = state.lastFixSignature === sig ? state.fixAttempts + 1 : 1;
  useChatStore.setState({ lastFixSignature: sig, fixAttempts: attempt });
  state.queueFix(fixPrompt(error, attempt), 'Fixing a preview error');
}

/**
 * The error→AI loop, engine-agnostic. Right after an AI build breaks the
 * preview, ONE fix pass fires automatically (armed per normal build or
 * completed continuation chain; error-fix attempts never re-arm it, so it
 * cannot loop). If the error survives that pass — or came from anything
 * other than a fresh build — the manual button takes over, and repeated
 * attempts at the same error escalate the prompt instead of repeating it.
 */
export function FixBanner({ error }: { error: string | null }) {
  const isGenerating = useChatStore(s => s.isGenerating);
  const autoFixArmed = useChatStore(s => s.autoFixArmed);

  // Each distinct error joins the build log (it never leaves the device
  // unless the builder shares a build report)
  useEffect(() => {
    if (error) recordBuildEvent('preview_error', error);
  }, [error]);

  // The single automatic pass
  useEffect(() => {
    if (!error || !autoFixArmed || isGenerating) return;
    useChatStore.setState({ autoFixArmed: false });
    recordBuildEvent('auto_error_fix');
    queueFixForError(error);
  }, [error, autoFixArmed, isGenerating]);

  if (!error) return null;

  const autoFixing = isGenerating;

  return (
    <div className="shrink-0 border-t bg-destructive/10 px-3 py-2 flex items-center gap-2">
      <p className="text-xs text-destructive flex-1 line-clamp-2" title={error}>
        {autoFixing
          ? 'The preview hit an error — fixing it automatically…'
          : `The preview hit an error: ${error.slice(0, 140)}`}
      </p>
      {autoFixing ? (
        <span className="inline-flex items-center gap-1 text-xs text-destructive shrink-0">
          <Loader2 className="size-3 animate-spin" />
        </span>
      ) : (
        <button
          onClick={() => {
            recordBuildEvent('manual_error_fix');
            queueFixForError(error);
          }}
          className="inline-flex items-center gap-1 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1 text-xs font-medium hover:opacity-90 shrink-0"
        >
          <Wrench className="size-3" />
          Ask AI to fix it
        </button>
      )}
    </div>
  );
}
