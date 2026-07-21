import { Monitor, Tablet, Smartphone, RotateCw, ExternalLink, ChevronDown, MousePointerClick } from 'lucide-react';

/**
 * The strip above the live preview: device widths, page navigation,
 * "Point at it", refresh, and open-in-browser — for both preview engines.
 * Everything here is builder chrome in a fixed place; nothing floats over
 * the previewed app itself.
 */

export type PreviewDevice = 'desktop' | 'tablet' | 'mobile';

/** What a preview engine offers the toolbar. Registered via onHandle. */
export interface PreviewHandle {
  refresh: () => void;
  /** Open the running app in a new browser tab; null when not available */
  openExternal: (() => void) | null;
  /** Navigate the app to a hash route; null when the app has no router */
  navigate: ((path: string) => void) | null;
}

const DEVICES: Array<{ id: PreviewDevice; icon: typeof Monitor; label: string }> = [
  { id: 'desktop', icon: Monitor, label: 'Desktop width' },
  { id: 'tablet', icon: Tablet, label: 'Tablet width (768px)' },
  { id: 'mobile', icon: Smartphone, label: 'Phone width (390px)' },
];

export function PreviewToolbar({
  device,
  onDevice,
  routes,
  currentRoute,
  handle,
  pointing,
  onPointing,
}: {
  device: PreviewDevice;
  onDevice: (d: PreviewDevice) => void;
  routes: string[];
  currentRoute: string;
  handle: PreviewHandle | null;
  pointing: boolean;
  onPointing: (on: boolean) => void;
}) {
  return (
    <div className="shrink-0 flex items-center gap-2 border-b bg-background px-2 py-1.5">
      {/* Device widths */}
      <div className="flex items-center rounded-md border p-0.5">
        {DEVICES.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            title={label}
            aria-pressed={device === id}
            onClick={() => onDevice(id)}
            className={`rounded p-1.5 transition-colors ${
              device === id
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="size-3.5" />
          </button>
        ))}
      </div>

      {/* Page dropdown — framework apps with hash routes */}
      {routes.length > 1 && handle?.navigate && (
        <div className="relative flex-1 max-w-56">
          <select
            title="Go to a page"
            value={currentRoute}
            onChange={e => handle.navigate?.(e.target.value)}
            className="w-full appearance-none rounded-md border bg-background pl-2.5 pr-7 py-1 text-xs font-medium text-foreground"
          >
            {routes.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
        </div>
      )}

      <div className="flex-1" />

      <button
        onClick={() => onPointing(!pointing)}
        aria-pressed={pointing}
        title={pointing
          ? 'Click an element in the preview to describe a change — or click here to cancel'
          : 'Point at what you want to change'}
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
          pointing
            ? 'bg-primary text-primary-foreground border-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MousePointerClick className="size-3.5" />
        <span className="hidden sm:inline">{pointing ? 'Click the thing to change…' : 'Point at it'}</span>
      </button>

      <button
        title="Refresh the preview"
        onClick={() => handle?.refresh()}
        className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
      >
        <RotateCw className="size-3.5" />
      </button>
      {handle?.openExternal && (
        <button
          title="Open the app in a new browser tab"
          onClick={() => handle.openExternal?.()}
          className="rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="size-3.5" />
        </button>
      )}
    </div>
  );
}

/** Constrains the preview to a device width; desktop fills the panel. */
export function DeviceFrame({
  device,
  children,
}: {
  device: PreviewDevice;
  children: React.ReactNode;
}) {
  if (device === 'desktop') {
    return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>{children}</div>;
  }
  const width = device === 'tablet' ? 768 : 390;
  return (
    <div className="bg-muted/40" style={{ flex: 1, display: 'flex', justifyContent: 'center', minHeight: 0, overflow: 'hidden' }}>
      <div
        className="border-x shadow-sm bg-background"
        style={{ width, maxWidth: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
      >
        {children}
      </div>
    </div>
  );
}
