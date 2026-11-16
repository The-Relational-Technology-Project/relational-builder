import { useEffect, useRef, useState } from 'react';

/**
 * A printable material (flyer, bin sign, info sheet) shown as the page it is,
 * not as 300 lines of HTML. Program contributions carry each material as an
 * ```html block (see composeProgramBody); in a gallery card that read as a
 * wall of code, which is the last thing a neighbor deciding whether to
 * remix a flyer wants to see.
 *
 * The iframe is sandboxed with allow-same-origin and WITHOUT allow-scripts:
 * nothing in the material runs, and same-origin only lets us measure the
 * rendered page so it can be scaled to fit.
 */
export function PrintableMaterialPreview({ html }: { html: string }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [width, setWidth] = useState(0);
  const landscape = /@page[^{]*\{[^}]*landscape/i.test(html);
  // US letter at 96dpi; the material's own CSS decides the rest
  const pageW = landscape ? 1056 : 816;
  const [docH, setDocH] = useState(landscape ? 816 : 1056);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function measure() {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.documentElement) return;
    const h = Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0);
    if (h > 0) setDocH(Math.min(h, 4000));
  }

  function handleLoad() {
    measure();
    // Web fonts can reflow the page after load
    frameRef.current?.contentDocument?.fonts?.ready.then(measure).catch(() => {});
  }

  const scale = width > 0 ? width / pageW : 0;

  return (
    <div className="not-prose space-y-1.5 my-3">
      <div
        ref={wrapRef}
        className="rounded-lg border overflow-hidden bg-white shadow-sm"
        // Card-sized, not a full sheet: enough to read the headline and
        // judge the look
        style={{ height: scale ? docH * scale : 320, maxWidth: landscape ? 520 : 380 }}
      >
        <iframe
          ref={frameRef}
          title="Printable material"
          srcDoc={html}
          sandbox="allow-same-origin"
          onLoad={handleLoad}
          style={{
            width: pageW,
            height: docH,
            border: 0,
            transform: `scale(${scale || 0.4})`,
            transformOrigin: '0 0',
          }}
        />
      </div>
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer select-none hover:text-foreground">View the HTML</summary>
        <pre className="mt-1.5 max-h-80 overflow-auto rounded-md bg-muted p-2.5 text-[11px] leading-snug">
          <code>{html}</code>
        </pre>
      </details>
    </div>
  );
}
