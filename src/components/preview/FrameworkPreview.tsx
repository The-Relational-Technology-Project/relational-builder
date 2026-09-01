import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { FileEntry } from '@/project/virtual-fs';
import type { EnvVar } from '@/store/env-store';
import { useChatStore } from '@/store/chat-store';
import { usePreviewHealthStore } from '@/store/preview-health-store';
import { buildEnvJs, buildEnvTs } from '@/project/env-module';
import { bundleProject, findFrameworkEntry } from '@/preview/bundler/bundle';
import { ASSET_APPLIER, buildShellHtml, EMPTY_RENDER_SENTRY, ERROR_RELAY, NAV_BRIDGE } from '@/preview/bundler/shell';
import { isPhotoAssetPath } from '@/project/assets';
import { KIT_FILES } from '@/kit';
import { INSPECT_SOURCE } from '@/preview/inspect-source';
import {
  captureFromIframe,
  registerPreviewScreenshotter,
  SCREENSHOT_SOURCE,
} from '@/preview/screenshot';
import { PointAtIt } from './PointAtIt';
import { FixBanner } from './FixBanner';
import type { PreviewHandle } from './PreviewToolbar';

/**
 * Preview for framework-shaped projects: real multi-file React apps with
 * `@/` aliases, npm packages, and Tailwind design tokens, compiled in the
 * browser by the esbuild bundler and rendered in a plain iframe.
 *
 * The document shown here is byte-identical to what Publish deploys (minus
 * the preview-only inspector and error relay), so the preview is an honest
 * rehearsal of the published site.
 */
export function FrameworkPreview({
  files,
  version,
  publicEnvVars,
  onHandle,
  pointing,
  onPointingChange,
}: {
  files: FileEntry[];
  version: number;
  publicEnvVars: EnvVar[];
  /** Registers the toolbar's refresh/open/navigate controls for this engine */
  onHandle?: (handle: PreviewHandle | null) => void;
  pointing: boolean;
  onPointingChange: (on: boolean) => void;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  // The quiet failure: app loads clean but paints nothing (see
  // EMPTY_RENDER_SENTRY). A notice, not an error — nothing crashed.
  const [emptyRender, setEmptyRender] = useState(false);
  const [bundling, setBundling] = useState(true);
  const runId = useRef(0);
  // While a reply is streaming, files land in bursts — a version bump per
  // file. The preview still follows along, but at a calmer cadence: each
  // rebundle is a full esbuild pass over the project plus the kit, and the
  // 250ms debounce alone ran ~20 of them for a 20-file build.
  const isGenerating = useChatStore(s => s.isGenerating);

  // The chat's first-build "cooking" state waits on this signal before
  // revealing the finished build — keep it honest through the whole pass
  const setHealth = usePreviewHealthStore(s => s.setHealth);
  useEffect(() => () => setHealth('idle'), [setHealth]);

  useEffect(() => {
    const id = ++runId.current;
    setBundling(true);
    setHealth('building');

    // Small debounce: streaming builds write several files back-to-back
    const timer = setTimeout(async () => {
      // Kit merges UNDERNEATH the project: `@/components/ui/*` imports
      // resolve from the kit for free, and a project file at the same
      // path overrides it. Unused kit files cost nothing.
      const vfs: Record<string, string> = { ...KIT_FILES };
      for (const f of files) {
        vfs[f.path.startsWith('/') ? f.path : '/' + f.path] = f.content;
      }
      // Env module, same contract as the Sandpack path: always present so
      // `import { env } from '@/env'` (or './env') never breaks the build.
      vfs['/env.js'] = buildEnvJs(publicEnvVars);
      vfs['/src/env.ts'] = buildEnvTs(publicEnvVars);

      const entry = findFrameworkEntry(vfs);
      if (!entry) {
        if (runId.current !== id) return;
        setBundling(false);
        setHealth('error');
        setBuildError(
          'No entry module found — expected an index.html pointing at a module script, or /src/main.tsx.',
        );
        return;
      }

      // dev: development React in the preview — real error messages and
      // component stacks for the error→AI-fix loop. Publish stays production.
      const result = await bundleProject({
        files: vfs,
        entry,
        dev: true,
        env: Object.fromEntries(publicEnvVars.map(v => [v.key, v.value])),
      });
      if (runId.current !== id) return; // a newer bundle superseded this one

      setBundling(false);
      if (!result.ok) {
        setHealth('error');
        setBuildError(result.errors.join('\n'));
        return;
      }
      setHealth('ok');

      // Photo assets can't load by relative URL from a blob: document —
      // inline their modules so `<img data-asset>` works in framework apps.
      const assetScripts = files
        .filter(f => isPhotoAssetPath(f.path))
        .map(f => `<script>\n${f.content.replace(/<\/script(?=[\s/>])/gi, '<\\/script')}\n</script>`);

      setBuildError(null);
      setRuntimeError(null);
      setEmptyRender(false);
      setHtml(
        buildShellHtml({
          bundle: result,
          indexHtml: vfs['/index.html'],
          bodyExtra: [
            ...assetScripts,
            ASSET_APPLIER,
            `<script>\n${INSPECT_SOURCE}\n</script>`,
            `<script>\n${SCREENSHOT_SOURCE}\n</script>`,
            ERROR_RELAY,
            EMPTY_RENDER_SENTRY,
            NAV_BRIDGE,
          ],
        }),
      );
    }, isGenerating ? 1250 : 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the VFS change signal
  }, [version, publicEnvVars, isGenerating, setHealth]);

  // Runtime errors surface through the shell's relay script; the empty-render
  // sentry reports the blank-but-no-error case the relay can't see
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'rb-runtime-error' && typeof e.data.message === 'string') {
        setRuntimeError(e.data.message);
        setHealth('error');
      }
      if (e.data?.type === 'rb-empty-render') setEmptyRender(true);
      if (e.data?.type === 'rb-empty-render-clear') setEmptyRender(false);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [setHealth]);

  // Blob URL (not srcdoc) so hash routing and history work inside the app.
  // Old URLs are revoked on a delay: immediate revocation races the iframe's
  // fetch (visibly so under StrictMode's double-mount) and 404s the document.
  // Refresh re-runs this effect (via refreshKey) instead of minting its own
  // URL, so every document the iframe loads gets revoked eventually — the
  // toolbar button used to leak a full bundle-sized document per click.
  const [src, setSrc] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    if (html === null) return;
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    setSrc(url);
    return () => {
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    };
  }, [html, refreshKey]);

  // Offer the toolbar its controls for this engine
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // The build report's optional snapshot asks the iframe to capture itself
  useEffect(() => {
    if (html === null) return;
    registerPreviewScreenshotter(() => {
      const win = iframeRef.current?.contentWindow;
      return win ? captureFromIframe(win) : Promise.resolve(null);
    });
    return () => registerPreviewScreenshotter(null);
  }, [html]);

  useEffect(() => {
    if (!onHandle || html === null) return;
    onHandle({
      refresh: () => setRefreshKey(k => k + 1),
      openExternal: () => {
        // A fresh URL per open: revoking the iframe's own URL later must not
        // kill the tab, and vice versa
        window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
      },
      navigate: path => {
        iframeRef.current?.contentWindow?.postMessage(
          { type: 'rb-navigate', hash: '#' + path },
          '*',
        );
      },
    });
    return () => onHandle(null);
  }, [html, onHandle]);

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <PointAtIt selecting={pointing} onSelectingChange={onPointingChange}>
        {src ? (
          <iframe
            ref={iframeRef}
            src={src}
            title="App preview"
            sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
            style={{ flex: 1, border: 0, background: '#fff' }}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm gap-2">
            <Loader2 className="size-4 animate-spin" />
            {buildError ? null : 'Building your app…'}
          </div>
        )}
        {bundling && src && (
          <div className="absolute top-2 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-background/90 border px-2.5 py-1 text-xs text-muted-foreground shadow-sm">
            <Loader2 className="size-3 animate-spin" /> rebuilding
          </div>
        )}
      </PointAtIt>
      {emptyRender && !buildError && !runtimeError && (
        <div className="shrink-0 border-t bg-amber-50 px-3 py-2 text-xs text-amber-900">
          The app loaded without errors, but the page came up empty. That
          usually means it's waiting on data it can't reach, or its router
          found no page to show. If this doesn't look right, tell the AI what
          you expected to see here.
        </div>
      )}
      <FixBanner error={buildError ?? runtimeError} />
    </div>
  );
}
