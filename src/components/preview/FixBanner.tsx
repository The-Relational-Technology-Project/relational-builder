import { useEffect } from 'react';
import { Wrench, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';
import { recordBuildEvent } from '@/report/build-log';

function fixPrompt(errorText: string): string {
  return [
    'The live preview is showing this error:',
    '',
    '```',
    errorText.slice(0, 2000),
    '```',
    '',
    'Please fix it. Re-output the complete corrected file(s) with filename annotations, changing as little else as possible.',
  ].join('\n');
}

/**
 * The error→AI loop, engine-agnostic. Right after an AI build breaks the
 * preview, ONE fix pass fires automatically (armed per normal build or
 * completed continuation chain; error-fix attempts never re-arm it, so it
 * cannot loop). If the error survives that pass — or came from anything
 * other than a fresh build — the manual button takes over.
 */
export function FixBanner({ error }: { error: string | null }) {
  const queueFix = useChatStore(s => s.queueFix);
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
    queueFix(fixPrompt(error), 'Fixing a preview error');
  }, [error, autoFixArmed, isGenerating, queueFix]);

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
            queueFix(fixPrompt(error), 'Fixing a preview error');
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
