import { useEffect, useRef, useState, type ReactNode } from 'react';

interface PanelConfig {
  content: ReactNode;
  /** Initial width as percentage (0-100) */
  defaultSize: number;
  /** Minimum width in pixels */
  minSize?: number;
}

interface ResizableLayoutProps {
  panels: PanelConfig[];
  /** Persist dragged sizes under this localStorage key; omit for ephemeral */
  storageKey?: string;
}

/** Validated read of persisted sizes: one finite positive number per panel,
 *  summing to ~100 — anything else falls back to the defaults. */
function loadSizes(storageKey: string | undefined, panelCount: number): number[] | null {
  if (!storageKey) return null;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!Array.isArray(parsed) || parsed.length !== panelCount) return null;
    if (!parsed.every(n => typeof n === 'number' && Number.isFinite(n) && n > 0)) return null;
    const sum = (parsed as number[]).reduce((a, b) => a + b, 0);
    return sum >= 99 && sum <= 101 ? (parsed as number[]) : null;
  } catch {
    return null;
  }
}

interface DragState {
  index: number;
  startX: number;
  containerWidth: number;
  startSizes: number[];
  minPcts: number[];
  frame: number | null;
  /** Sizes as of the last committed frame — what pointerup persists */
  latest: number[] | null;
}

/**
 * A horizontal layout with draggable dividers between panels.
 * Panel sizes are stored as percentages of the container width.
 *
 * The drag runs on Pointer Events with capture on the divider itself.
 * Capture is the load-bearing part: these panels host preview iframes, and
 * a document-level mouse listener stops receiving events the moment the
 * cursor crosses into an iframe — which froze the old drag mid-motion and
 * left it latched until the next click.
 */
export function ResizableLayout({ panels, storageKey }: ResizableLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState<number[]>(
    () => loadSizes(storageKey, panels.length) ?? panels.map(p => p.defaultSize),
  );
  const [dragging, setDragging] = useState(false);

  // Live drag state in refs: the move handler reads these, never React state
  const drag = useRef<DragState | null>(null);
  const sizesRef = useRef(sizes);
  useEffect(() => {
    sizesRef.current = sizes;
  }, [sizes]);

  function onPointerDown(index: number, e: React.PointerEvent<HTMLDivElement>) {
    const container = containerRef.current;
    if (!container) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const containerWidth = container.getBoundingClientRect().width;
    drag.current = {
      index,
      startX: e.clientX,
      containerWidth,
      startSizes: [...sizesRef.current],
      minPcts: panels.map(p => ((p.minSize ?? 150) / containerWidth) * 100),
      frame: null,
      latest: null,
    };
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.frame !== null) return;
    const clientX = e.clientX;
    // One resize per frame: these panels hold the preview iframe and the
    // chat list, and an unthrottled pointermove forced a full relayout of
    // both per pointer event
    d.frame = requestAnimationFrame(() => {
      d.frame = null;
      const deltaPct = ((clientX - d.startX) / d.containerWidth) * 100;
      const pair = d.startSizes[d.index] + d.startSizes[d.index + 1];
      const minLeft = d.minPcts[d.index];
      const maxLeft = pair - d.minPcts[d.index + 1];
      // Container too narrow for both minimums — hold position
      if (maxLeft < minLeft) return;
      const left = Math.min(Math.max(d.startSizes[d.index] + deltaPct, minLeft), maxLeft);
      const next = [...d.startSizes];
      next[d.index] = left;
      next[d.index + 1] = pair - left;
      d.latest = next;
      setSizes(next);
    });
  }

  // pointerup and lostpointercapture both land here: whichever way a drag
  // ends (release, window blur, capture lost), cleanup is guaranteed
  function endDrag() {
    const d = drag.current;
    if (!d) return;
    if (d.frame !== null) cancelAnimationFrame(d.frame);
    drag.current = null;
    setDragging(false);
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(d.latest ?? sizesRef.current));
      } catch {
        // Full or blocked storage never breaks the drag itself
      }
    }
  }

  function resetSizes() {
    setSizes(panels.map(p => p.defaultSize));
    if (storageKey) {
      try {
        localStorage.removeItem(storageKey);
      } catch {
        // ignore
      }
    }
  }

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {panels.map((panel, i) => (
        <div key={i} className="flex h-full" style={{ width: `${sizes[i]}%` }}>
          <div className="flex-1 min-w-0 overflow-hidden">{panel.content}</div>
          {i < panels.length - 1 && (
            <div
              className="w-1 shrink-0 cursor-col-resize transition-colors group relative touch-none"
              title="Drag to resize · double-click to reset"
              onPointerDown={e => onPointerDown(i, e)}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onLostPointerCapture={endDrag}
              onDoubleClick={resetSizes}
            >
              {/* Visible divider line */}
              <div className="absolute inset-y-0 left-0 w-px bg-border group-hover:bg-ring transition-colors" />
              {/* Wider hit target */}
              <div className="absolute inset-y-0 -left-1 w-3" />
            </div>
          )}
        </div>
      ))}
      {/* Inert while capture holds the pointer — pins the resize cursor and
          keeps iframe hover states quiet for the duration of the drag */}
      {dragging && <div className="fixed inset-0 z-50 cursor-col-resize select-none" aria-hidden />}
    </div>
  );
}
