import { useRef, useCallback, useState, type ReactNode } from 'react';

interface PanelConfig {
  content: ReactNode;
  /** Initial width as percentage (0-100) */
  defaultSize: number;
  /** Minimum width in pixels */
  minSize?: number;
}

interface ResizableLayoutProps {
  panels: PanelConfig[];
}

/**
 * A horizontal layout with draggable dividers between panels.
 * Panel sizes are stored as percentages of the container width.
 */
export function ResizableLayout({ panels }: ResizableLayoutProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [sizes, setSizes] = useState(() => panels.map(p => p.defaultSize));

  const handleDrag = useCallback(
    (index: number, e: React.MouseEvent) => {
      e.preventDefault();
      const container = containerRef.current;
      if (!container) return;

      const startX = e.clientX;
      const containerWidth = container.getBoundingClientRect().width;
      const startSizes = [...sizes];

      const minPcts = panels.map(
        p => ((p.minSize ?? 150) / containerWidth) * 100,
      );

      // One resize per frame: these panels hold the preview iframe and the
      // chat list, and an unthrottled mousemove forced a full relayout of
      // both per mouse event
      let frame: number | null = null;
      function onMouseMove(ev: MouseEvent) {
        if (frame !== null) return;
        frame = requestAnimationFrame(() => {
          frame = null;
          const dx = ev.clientX - startX;
          const deltaPct = (dx / containerWidth) * 100;

          const newSizes = [...startSizes];
          const leftNew = startSizes[index] + deltaPct;
          const rightNew = startSizes[index + 1] - deltaPct;

          if (leftNew >= minPcts[index] && rightNew >= minPcts[index + 1]) {
            newSizes[index] = leftNew;
            newSizes[index + 1] = rightNew;
            setSizes(newSizes);
          }
        });
      }

      function onMouseUp() {
        if (frame !== null) cancelAnimationFrame(frame);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [sizes, panels],
  );

  return (
    <div ref={containerRef} className="flex h-full w-full">
      {panels.map((panel, i) => (
        <div key={i} className="flex h-full" style={{ width: `${sizes[i]}%` }}>
          <div className="flex-1 min-w-0 overflow-hidden">{panel.content}</div>
          {i < panels.length - 1 && (
            <div
              className="w-1 shrink-0 cursor-col-resize transition-colors group relative"
              onMouseDown={e => handleDrag(i, e)}
            >
              {/* Visible divider line */}
              <div className="absolute inset-y-0 left-0 w-px bg-border group-hover:bg-ring transition-colors" />
              {/* Wider hit target */}
              <div className="absolute inset-y-0 -left-1 w-3" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
