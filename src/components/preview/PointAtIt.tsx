import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useChatStore } from '@/store/chat-store';
import { locateExactText, applyDirectTextEdit } from '@/project/direct-text-edit';
import { Button } from '@/components/ui/button';

/**
 * "Point at it" wiring around any preview iframe: while armed, a click on
 * any element in the running app prefills the chat input with a description
 * of that element — no selectors, no code-speak, just point.
 *
 * Copy elements get a faster door first: when the pointed-at wording maps
 * to exactly one place in the source, the text is edited without a model
 * call — retyped right in the page for plain text elements (the inspector
 * script makes it contenteditable and posts the result back), or in a small
 * overlay editor for copy with structure inside. Either way the change
 * lands as a plain source replacement: instant, free, checkpointed like any
 * AI change. Ambiguous text (data-rendered, repeated, assembled) falls back
 * to the AI prefill, which handles everything.
 *
 * The wrapper is pure plumbing — the visible toggle lives in the preview
 * toolbar (builder chrome), never floating over the previewed app. It finds
 * the iframe among its children and speaks the rb-inspect/rb-selected/
 * rb-edit-text/rb-edit-save postMessage protocol that the injected
 * inspector script implements.
 */
export function PointAtIt({
  selecting,
  onSelectingChange,
  children,
}: {
  selecting: boolean;
  onSelectingChange: (on: boolean) => void;
  children: ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const setDraftMessage = useChatStore(s => s.setDraftMessage);
  // A pointed-at piece of copy that source-matches exactly once but has
  // structure inside — editable in an overlay, no model call
  const [directEdit, setDirectEdit] = useState<{ original: string; value: string } | null>(null);

  // Tell the preview iframe to enter/leave select mode. The injected
  // script's state dies with every rebuild (fresh document), so re-arm on
  // iframe load too — mid-selection rebuilds stay in sync.
  useEffect(() => {
    const iframe = wrapperRef.current?.querySelector('iframe');
    if (!iframe) return;
    const post = () =>
      iframe.contentWindow?.postMessage({ type: 'rb-inspect', on: selecting }, '*');
    post();
    iframe.addEventListener('load', post);
    return () => iframe.removeEventListener('load', post);
  }, [selecting]);

  // Receive the clicked element and hand it to the chat
  useEffect(() => {
    function aiPrefillForCopy(original: string, replacement?: string) {
      setDraftMessage([
        'Copy change — this text in the preview:',
        `"${original}"`,
        '',
        `Replace it with: ${replacement ?? ''}`,
      ].join('\n'));
    }

    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d) return;
      // The builder retyped copy right in the page — land it in source.
      // When the source moved under us (a build landed mid-edit), the AI
      // path still works, with the retyped wording carried along.
      if (d.type === 'rb-edit-save' && typeof d.original === 'string' && typeof d.edited === 'string') {
        if (!applyDirectTextEdit(d.original, d.edited)) {
          aiPrefillForCopy(d.original, d.edited);
        }
        return;
      }
      if (d.type !== 'rb-selected' || !d.el) return;
      const el = d.el as {
        tag: string; text: string; fullText?: string; isCopy?: boolean;
        plain?: boolean; path: string; html: string;
      };
      // Unambiguous copy edits skip the AI entirely
      if (el.isCopy && el.fullText && locateExactText(el.fullText)) {
        onSelectingChange(false);
        if (el.plain) {
          // Plain text: edit it right where it sits in the page
          const iframe = wrapperRef.current?.querySelector('iframe');
          iframe?.contentWindow?.postMessage({ type: 'rb-edit-text' }, '*');
        } else {
          // Copy with structure inside — the overlay editor handles it
          setDirectEdit({ original: el.fullText, value: el.fullText });
        }
        return;
      }
      // Text elements get a rewrite-friendly prefill: the current wording is
      // quoted so the AI changes exactly that copy, verbatim, nothing else.
      // Other elements keep the generic describe-the-change prefill.
      const bits = el.isCopy && el.fullText
        ? [
            'Copy change — this text in the preview:',
            `"${el.fullText}"`,
            ...(el.path && el.path !== el.tag ? [`(in \`${el.path}\`)`] : []),
            '',
            'Replace it with: ',
          ]
        : [
            `About this element in the preview: \`${el.tag}\`${el.text ? ` ("${el.text}")` : ''}`,
            ...(el.path && el.path !== el.tag ? [`Found at: \`${el.path}\``] : []),
            '',
            'Change it so that ',
          ];
      setDraftMessage(bits.join('\n'));
      onSelectingChange(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setDraftMessage, onSelectingChange]);

  // Hand the copy to the AI after all — same prefill the fallback path uses
  function askAiInstead() {
    if (!directEdit) return;
    setDraftMessage([
      'Copy change — this text in the preview:',
      `"${directEdit.original}"`,
      '',
      'Replace it with: ',
    ].join('\n'));
    setDirectEdit(null);
  }

  function saveDirectEdit() {
    if (!directEdit) return;
    const applied = applyDirectTextEdit(directEdit.original, directEdit.value);
    if (!applied) {
      // The file moved under us (a build landed) — the AI path still works
      askAiInstead();
      return;
    }
    setDirectEdit(null);
  }

  return (
    <div ref={wrapperRef} className="relative" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {children}
      {directEdit && (
        <div
          className="absolute inset-0 z-20 bg-black/20 flex items-start justify-center pt-10"
          onClick={() => setDirectEdit(null)}
        >
          <div
            className="bg-background border rounded-xl shadow-lg p-3 w-[min(28rem,92%)] space-y-2"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-xs font-medium">Edit this text</p>
            <textarea
              value={directEdit.value}
              onChange={e => setDirectEdit(d => (d ? { ...d, value: e.target.value } : d))}
              rows={Math.min(6, Math.max(2, Math.ceil(directEdit.original.length / 60)))}
              autoFocus
              className="w-full text-sm border rounded-md p-2 bg-background resize-y"
            />
            <p className="text-[11px] text-muted-foreground">
              Changes just this wording — instant, no AI. Undo lives where it always does.
            </p>
            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={askAiInstead}>
                Ask AI instead
              </Button>
              <div className="flex items-center gap-1.5">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDirectEdit(null)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={saveDirectEdit}
                  disabled={directEdit.value.trim() === directEdit.original.trim() || !directEdit.value.trim()}
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
