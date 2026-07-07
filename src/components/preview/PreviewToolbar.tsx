import { Monitor, Tablet, Smartphone, RotateCw, ExternalLink, ChevronDown } from 'lucide-react';

/**
 * The strip above the live preview: device widths, page navigation,
 * refresh, and open-in-browser — for both preview engines.
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
}: {
  device: PreviewDevice;
  onDevice: (d: PreviewDevice) => void;
  routes: string[];
  currentRoute: string;
  handle: PreviewHandle | null;
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
