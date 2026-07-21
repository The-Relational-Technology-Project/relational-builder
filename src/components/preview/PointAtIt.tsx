import { useEffect, useRef, type ReactNode } from 'react';
import { useChatStore } from '@/store/chat-store';

/**
 * "Point at it" wiring around any preview iframe: while armed, a click on
 * any element in the running app prefills the chat input with a description
 * of that element — no selectors, no code-speak, just point.
 *
 * The wrapper is pure plumbing — the visible toggle lives in the preview
 * toolbar (builder chrome), never floating over the previewed app. It finds
 * the iframe among its children and speaks the rb-inspect/rb-selected
 * postMessage protocol that the injected inspector script implements.
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
      onSelectingChange(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setDraftMessage, onSelectingChange]);

  return (
    <div ref={wrapperRef} className="relative" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {children}
    </div>
  );
}
