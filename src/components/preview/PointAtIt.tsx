import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MousePointerClick } from 'lucide-react';
import { useChatStore } from '@/store/chat-store';

/**
 * "Point at it" around any preview iframe: toggle select mode, click any
 * element in the running app, and the chat input is prefilled with a
 * description of that element — no selectors, no code-speak, just point.
 *
 * Works with both preview engines: the wrapper finds the iframe among its
 * children and speaks the rb-inspect/rb-selected postMessage protocol that
 * the injected inspector script implements.
 */
export function PointAtIt({ children }: { children: ReactNode }) {
  const [selecting, setSelecting] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const setDraftMessage = useChatStore(s => s.setDraftMessage);

  // Tell the preview iframe to enter/leave select mode
  useEffect(() => {
    const iframe = wrapperRef.current?.querySelector('iframe');
    iframe?.contentWindow?.postMessage({ type: 'rb-inspect', on: selecting }, '*');
  }, [selecting]);

  // Receive the clicked element and hand it to the chat
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || d.type !== 'rb-selected' || !d.el) return;
      const el = d.el as {
        tag: string; text: string; fullText?: string; isCopy?: boolean;
        path: string; html: string;
      };
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
      setSelecting(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setDraftMessage]);

  return (
    <div ref={wrapperRef} className="relative" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {children}
      <button
        onClick={() => setSelecting(s => !s)}
        title={selecting
          ? 'Click an element in the preview to describe a change — or click here to cancel'
          : 'Point at what you want to change'}
        className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-md transition-colors ${
          selecting
            ? 'bg-primary text-primary-foreground'
            : 'bg-background/90 border text-muted-foreground hover:text-foreground'
        }`}
      >
        <MousePointerClick className="size-3.5" />
        {selecting ? 'Click the thing to change…' : 'Point at it'}
      </button>
    </div>
  );
}
