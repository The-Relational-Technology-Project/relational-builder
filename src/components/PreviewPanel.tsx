import { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { renderToStaticMarkup } from 'react-dom/server';
import remarkGfm from 'remark-gfm';
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
  type SandpackFiles,
} from '@codesandbox/sandpack-react';
import type { FileEntry } from '@/project/virtual-fs';
import { useProjectStore } from '@/store/project-store';
import { usePanelStore } from '@/store/panel-store';
import { artifactName } from '@/project/display-name';
import { useEnvStore } from '@/store/env-store';
import { useChatStore } from '@/store/chat-store';
import { usePreviewHealthStore } from '@/store/preview-health-store';
import { buildEnvJs, buildEnvTs } from '@/project/env-module';
import { INSPECT_SOURCE } from '@/preview/inspect-source';
import {
  captureFromIframe,
  registerPreviewScreenshotter,
  SCREENSHOT_SOURCE,
} from '@/preview/screenshot';
import { resolveReactEntry } from '@/preview/react-entry';
import { detectPreviewKind } from '@/preview/detect';
import { extractHashRoutes } from '@/preview/routes';
import { buildStandaloneHtml } from '@/preview/standalone';
import { FrameworkPreview } from './preview/FrameworkPreview';
import { PointAtIt } from './preview/PointAtIt';
import { FixBanner } from './preview/FixBanner';
import {
  PreviewToolbar,
  DeviceFrame,
  type PreviewDevice,
  type PreviewHandle,
} from './preview/PreviewToolbar';
import { Boxes, Sparkles } from 'lucide-react';

/**
 * Live preview of the generated project. Three engines by project shape:
 *
 * - Framework apps (`@/` aliases, vite config, /src/main.*) run on the
 *   in-browser esbuild bundler — full support for multi-file React,
 *   npm packages, Tailwind design tokens, and routing.
 * - Simple tools (single-file HTML/JS, plain React) keep the instant
 *   Sandpack path.
 * - Server-bound projects (Next.js SSR etc.) get an explanation instead
 *   of a cryptic error.
 */
export function PreviewPanel() {
  const version = useProjectStore(s => s.version);
  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const allEnvVars = useEnvStore(s => s.vars);
  const publicEnvVars = useMemo(() => allEnvVars.filter(v => !v.isSecret), [allEnvVars]);

  // Re-read files when the VFS version bumps — and ONLY then. getAllFiles()
  // allocates a fresh array per call, so calling it bare gave `files` a new
  // identity every render and silently defeated every useMemo keyed on it
  // (kind detection, route extraction, doc/material scans — all re-ran per
  // render).
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version is the VFS change signal
  const files = useMemo(() => getAllFiles(), [version, getAllFiles]);
  const kind = useMemo(() => detectPreviewKind(files), [files]);

  // Toolbar state: device width, engine controls, page tracking
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [handle, setHandle] = useState<PreviewHandle | null>(null);
  const [currentRoute, setCurrentRoute] = useState('/');
  const [reloadKey, setReloadKey] = useState(0);
  const [pointing, setPointing] = useState(false);
  const routes = useMemo(
    () => (kind === 'framework' ? extractHashRoutes(files) : []),
    [kind, files],
  );

  // The app reports its hash routes back (nav bridge) — keeps the page
  // dropdown honest when the person navigates inside the preview
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'rb-hash' && typeof e.data.hash === 'string') {
        setCurrentRoute(e.data.hash.replace(/^#/, '') || '/');
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // One project, several kinds of output: the app, standalone materials
  // (flyers, sign-up sheets — any .html beside the app's own entry), and
  // program docs (.md). Tabs appear only when there's more than the app.
  const docs = useMemo(() => files.filter(f => /\.md$/i.test(f.path)), [files]);
  const materials = useMemo(
    () => files.filter(f => /\.html?$/i.test(f.path) && f.path.replace(/^\//, '') !== 'index.html'),
    [files],
  );
  const [output, setOutput] = useState<string>('app');
  // A build can be all paper — materials and a plan with no app entry. Then
  // there is nothing for an App tab to run: don't offer one, land on the
  // first real output instead of a blank sandbox.
  const hasApp = useMemo(
    () => files.some(f => /\.([jt]sx?)$/i.test(f.path) || f.path.replace(/^\//, '') === 'index.html'),
    [files],
  );
  const outputTabs = useMemo(() => {
    if (kind !== 'framework' && kind !== 'sandpack') return [];
    const tabs = hasApp ? [{ id: 'app', label: 'App' }] : [];
    for (const m of materials) tabs.push({ id: `file:${m.path}`, label: artifactName(m.path, m.content) });
    if (docs.length > 0) tabs.push({ id: 'docs', label: 'Docs' });
    return tabs;
  }, [kind, materials, docs, hasApp]);
  useEffect(() => {
    if (!outputTabs.some(t => t.id === output)) setOutput(outputTabs[0]?.id ?? 'app');
  }, [outputTabs, output]);

  // A click on a chat file card asks to see that artifact here. One-shot:
  // consumed and cleared, so a remount (tab away and back) never replays it.
  const previewRequest = usePanelStore(s => s.previewRequest);
  const [docFocus, setDocFocus] = useState<{ path: string; nonce: number } | null>(null);
  useEffect(() => {
    if (!previewRequest) return;
    const p = previewRequest.path.startsWith('/') ? previewRequest.path : `/${previewRequest.path}`;
    if (/\.md$/i.test(p) && docs.some(d => d.path === p)) {
      setOutput('docs');
      setDocFocus({ path: p, nonce: previewRequest.nonce });
    } else if (materials.some(m => m.path === p)) {
      setOutput(`file:${p}`);
    } else {
      // Part of the running app (a page, a component, styles) — the app
      // itself is the closest thing to "seeing" it
      setOutput('app');
    }
    usePanelStore.getState().clearPreviewRequest();
  }, [previewRequest, docs, materials]);

  // Controls for the Sandpack engine, owned here (remount = refresh; a
  // static app opens in a tab as one self-contained document)
  const sandpackHandle = useMemo<PreviewHandle>(() => ({
    refresh: () => setReloadKey(k => k + 1),
    openExternal: files.some(f => f.path.replace(/^\//, '') === 'index.html')
      ? () => {
          const html = buildStandaloneHtml(files);
          if (html) window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
        }
      : null,
    navigate: null,
  }), [files]);

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm text-center px-4">
        <div>
          <p className="font-medium">Preview</p>
          <p className="text-xs mt-1">
            Start a conversation to generate code and see a live preview here.
          </p>
        </div>
      </div>
    );
  }

  if (kind === 'server') {
    return <ServerAppNotice fileCount={files.length} />;
  }

  if (kind === 'document') {
    return <DocumentPreview files={files} focusDoc={docFocus} />;
  }

  const tabsRow = outputTabs.length > 1 || (outputTabs.length === 1 && outputTabs[0].id !== 'app') ? (
    <div className="flex gap-1 border-b px-2 py-1.5 overflow-x-auto shrink-0">
      {outputTabs.map(t => (
        <button
          key={t.id}
          onClick={() => setOutput(t.id)}
          className={`rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors ${
            t.id === output
              ? 'bg-foreground text-background border-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  ) : null;

  if (tabsRow && output === 'docs') {
    return (
      <div className="h-full flex flex-col">
        {tabsRow}
        <div className="flex-1 min-h-0">
          <DocumentPreview files={files} focusDoc={docFocus} />
        </div>
      </div>
    );
  }

  const materialFile = tabsRow && output.startsWith('file:')
    ? files.find(f => f.path === output.slice('file:'.length))
    : undefined;
  if (tabsRow && materialFile) {
    return (
      <div className="h-full flex flex-col">
        {tabsRow}
        <MaterialPreview file={materialFile} />
      </div>
    );
  }

  return (
    <div className="h-full" style={{ display: 'flex', flexDirection: 'column' }}>
      {tabsRow}
      <PreviewToolbar
        device={device}
        onDevice={setDevice}
        routes={routes}
        currentRoute={currentRoute}
        handle={kind === 'framework' ? handle : sandpackHandle}
        pointing={pointing}
        onPointing={setPointing}
      />
      <DeviceFrame device={device}>
        {kind === 'framework' ? (
          <FrameworkPreview
            files={files}
            version={version}
            publicEnvVars={publicEnvVars}
            onHandle={setHandle}
            pointing={pointing}
            onPointingChange={setPointing}
          />
        ) : (
          <SandpackPath
            key={`reload-${reloadKey}`}
            files={files}
            version={version}
            publicEnvVars={publicEnvVars}
            pointing={pointing}
            onPointingChange={setPointing}
          />
        )}
      </DeviceFrame>
    </div>
  );
}

/** The original instant path for simple tools, unchanged in behavior. */
function SandpackPath({
  files,
  version,
  publicEnvVars,
  pointing,
  onPointingChange,
}: {
  files: ReturnType<ReturnType<typeof useProjectStore.getState>['getAllFiles']>;
  version: number;
  publicEnvVars: { key: string; value: string }[];
  pointing: boolean;
  onPointingChange: (on: boolean) => void;
}) {
  const { sandpackFiles, template, entry, externalResources } = useMemo(() => {
    const spFiles: SandpackFiles = {};
    let hasJsx = false;
    let hasTsx = false;
    let hasHtml = false;

    for (const file of files) {
      // Sandpack wants paths starting with /
      const path = file.path.startsWith('/') ? file.path : '/' + file.path;
      spFiles[path] = { code: file.content };

      if (path.endsWith('.jsx')) hasJsx = true;
      if (path.endsWith('.tsx')) hasTsx = true;
      if (path === '/index.html') hasHtml = true;
    }

    // Auto-detect template
    let tmpl: 'static' | 'react' | 'react-ts' | 'vanilla' = 'static';
    if (hasTsx) {
      tmpl = 'react-ts';
    } else if (hasJsx) {
      tmpl = 'react';
    } else if (hasHtml) {
      tmpl = 'static';
    } else {
      tmpl = 'vanilla';
    }

    // Inject the public env module ALWAYS, even when empty. Generated apps
    // commonly `import { env } from "./env"` (or "./env.js"); if the module is
    // missing the whole bundle fails to resolve and the preview falls back to a
    // blank/"Hello world" shell. An empty `env` object keeps the app rendering
    // — a missing key reads as `undefined` (handled in code) instead of a hard
    // build failure. /env.js works everywhere; /src/env.ts serves typed
    // imports in React templates.
    spFiles['/env.js'] = { code: buildEnvJs(publicEnvVars) };
    spFiles['/src/env.ts'] = { code: buildEnvTs(publicEnvVars) };

    // "Point at it" inspector — preview-only, never written to the project.
    // Static pages get the script as a file + tag; bundled templates load
    // it via externalResources below.
    if (hasHtml) {
      spFiles['/rb-inspect.js'] = { code: INSPECT_SOURCE };
      spFiles['/rb-screenshot.js'] = { code: SCREENSHOT_SOURCE };
      const html = spFiles['/index.html'];
      const code = typeof html === 'string' ? html : html.code;
      const tag = '<script src="./rb-inspect.js"></script>\n<script src="./rb-screenshot.js"></script>';
      spFiles['/index.html'] = {
        code: /<\/body>/i.test(code) ? code.replace(/<\/body>/i, `${tag}\n</body>`) : code + `\n${tag}`,
      };
    }

    // Sandpack's react/react-ts templates are create-react-app shaped: their
    // entry is a ROOT /index.tsx that imports a ROOT /App.tsx, and the template
    // ships a default /App.tsx that renders "Hello world". A generated app that
    // doesn't overwrite that exact entry never gets bundled — Sandpack renders
    // its own default files instead. resolveReactEntry finds (or synthesizes)
    // the real entry so the generated app actually runs.
    const entry =
      tmpl === 'react' || tmpl === 'react-ts'
        ? resolveReactEntry(spFiles, tmpl)
        : undefined;

    // Generated apps commonly load styling/tooling from a CDN in their
    // index.html — the Tailwind Play CDN, Google Fonts, Alpine, etc. For React
    // templates Sandpack serves its OWN HTML shell and drops those tags, so the
    // app renders unstyled (every Tailwind utility becomes a no-op). Forward
    // them to the preview as external resources — Sandpack's supported path for
    // exactly this (e.g. the Tailwind Play CDN). Static templates keep their own
    // index.html as the shell, so they already load these directly.
    const externalFromHtml: string[] = [];
    if (tmpl === 'react' || tmpl === 'react-ts') {
      const htmlFile = files.find(f => /(^|\/)index\.html$/.test(f.path));
      const html = htmlFile?.content ?? '';
      for (const m of html.matchAll(/<script[^>]*\bsrc=["'](https?:\/\/[^"']+)["'][^>]*>/gi)) {
        externalFromHtml.push(m[1]);
      }
      for (const m of html.matchAll(/<link\b[^>]*>/gi)) {
        const tag = m[0];
        const href = tag.match(/\bhref=["'](https?:\/\/[^"']+)["']/i)?.[1];
        // Only forward actual stylesheets/fonts — skip preconnect, icons, etc.
        if (href && (/\brel=["']stylesheet["']/i.test(tag) || /fonts\.googleapis|\.css(\?|$)/i.test(href))) {
          externalFromHtml.push(href);
        }
      }
    }

    return { sandpackFiles: spFiles, template: tmpl, entry, externalResources: externalFromHtml };
  }, [files, publicEnvVars]);

  // The build report's optional snapshot: find this engine's iframe and ask
  // it to capture itself (the Sandpack document is cross-origin, so the
  // conversation happens over postMessage)
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    registerPreviewScreenshotter(() => {
      const win = rootRef.current?.querySelector('iframe')?.contentWindow;
      return win ? captureFromIframe(win) : Promise.resolve(null);
    });
    return () => registerPreviewScreenshotter(null);
  }, []);

  return (
    <div ref={rootRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <SandpackProvider
        // Remount on file-system changes: SandpackProvider holds stale error
        // state when the files prop changes underneath it (e.g. on restore)
        key={`sandpack-${version}`}
        template={template}
        files={sandpackFiles}
        customSetup={entry ? { entry } : undefined}
        options={{
          autoReload: true,
          autorun: true,
          externalResources: template === 'static'
            ? []
            : [
                `${window.location.origin}/inspect.js`,
                `${window.location.origin}/screenshot.js`,
                ...externalResources,
              ],
        }}
        theme="dark"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <PointAtIt selecting={pointing} onSelectingChange={onPointingChange}>
          <SandpackPreview
            showNavigator={false}
            showRefreshButton={false}
            showOpenInCodeSandbox={false}
            style={{ flex: 1 }}
          />
        </PointAtIt>
        <SandpackErrorBridge />
      </SandpackProvider>
    </div>
  );
}

/** Adapts Sandpack's error state to the shared error→AI-fix banner. */
function SandpackErrorBridge() {
  const { sandpack } = useSandpack();
  const error = sandpack.error;
  const errorText = error ? [error.title, error.message].filter(Boolean).join('\n') : null;
  // Report to the shared preview-health signal (the chat's first-build
  // "cooking" state waits on it). Sandpack has no clean "bundling" phase to
  // relay, so this engine only distinguishes standing/broken.
  const setHealth = usePreviewHealthStore(s => s.setHealth);
  useEffect(() => {
    setHealth(errorText ? 'error' : 'ok');
    return () => setHealth('idle');
  }, [errorText, setHealth]);
  return <FixBanner error={errorText} />;
}

/**
 * Shown when a project needs a server at runtime (Next.js SSR and friends) —
 * something no in-browser preview can run. The files are all here and export
 * fine; this replaces a cryptic bundler error with a clear explanation and a
 * path forward.
 */

/** The quiet toolbar-button look shared by the material and doc previews. */
const previewActionClass =
  'rounded border px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors';

/**
 * Print an HTML document through a hidden iframe — the browser's print
 * dialog is also the "Save as PDF" path, no library needed.
 */
function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  frame.onload = () => {
    const w = frame.contentWindow;
    if (!w) {
      frame.remove();
      return;
    }
    w.addEventListener('afterprint', () => frame.remove());
    // Fallback cleanup — afterprint is unreliable in some browsers
    setTimeout(() => frame.remove(), 120_000);
    w.focus();
    w.print();
  };
  frame.srcdoc = html;
  document.body.appendChild(frame);
}

const PDF_HINT = 'Opens the print dialog — choose "Save as PDF" as the destination for a share-ready file';

/**
 * A standalone material — a flyer, sign-up sheet, or info card that lives
 * beside the app as its own printable HTML page. Rendered without scripts
 * (materials are documents, not programs), with print as the primary act.
 * All the print/PDF affordances live HERE in the builder chrome — the
 * material itself stays clean, exactly what comes out of the printer.
 */
function MaterialPreview({ file }: { file: FileEntry }) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center justify-end gap-1.5 border-b px-2 py-1 shrink-0">
        <button
          onClick={() => frameRef.current?.contentWindow?.print()}
          className={previewActionClass}
        >
          Print
        </button>
        <button
          onClick={() => frameRef.current?.contentWindow?.print()}
          title={PDF_HINT}
          className={previewActionClass}
        >
          Save as PDF
        </button>
        <button
          onClick={() => {
            window.open(
              URL.createObjectURL(new Blob([file.content], { type: 'text/html' })),
              '_blank',
            );
          }}
          className={previewActionClass}
        >
          Open in tab
        </button>
      </div>
      <iframe
        ref={frameRef}
        srcDoc={file.content}
        sandbox="allow-same-origin allow-modals"
        title={file.path}
        className="flex-1 w-full bg-white"
      />
    </div>
  );
}

/** Print styles for a rendered doc — readable serif page, print-shop friendly. */
const DOC_PRINT_CSS = `
  @page { margin: 0.75in; }
  body { font: 12pt/1.6 Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem; }
  h1, h2, h3, h4 { line-height: 1.25; break-after: avoid; }
  h1 { font-size: 22pt; } h2 { font-size: 16pt; margin-top: 1.6em; } h3 { font-size: 13pt; }
  blockquote { border-left: 3px solid #999; margin: 1em 0; padding-left: 1em; color: #444; font-style: italic; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5pt; break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; vertical-align: top; }
  code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.9em; background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f2f2f2; padding: 10px 12px; border-radius: 4px; overflow-x: auto; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  li { margin: 0.2em 0; }
  hr { border: 0; border-top: 1px solid #bbb; margin: 1.6em 0; }
  a { color: inherit; }
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Print / Save as PDF / Copy text for the active doc — the doc itself stays
 *  a clean markdown page; the actions live in the builder chrome. */
function DocActions({ doc }: { doc: FileEntry }) {
  const [copied, setCopied] = useState(false);

  function print() {
    const body = renderToStaticMarkup(
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>,
    );
    const title = artifactName(doc.path, doc.content);
    printHtml(
      `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>` +
      `<style>${DOC_PRINT_CSS}</style></head><body>${body}</body></html>`,
    );
  }

  function copy() {
    navigator.clipboard.writeText(doc.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div className="flex items-center justify-end gap-1.5 border-b px-2 py-1 shrink-0">
      <button onClick={print} className={previewActionClass}>
        Print
      </button>
      <button onClick={print} title={PDF_HINT} className={previewActionClass}>
        Save as PDF
      </button>
      <button onClick={copy} className={previewActionClass}>
        {copied ? 'Copied' : 'Copy text'}
      </button>
    </div>
  );
}

/**
 * Program builds — plans, program docs, materials — read like pages, they
 * don't run. Markdown files render directly; multiple docs get tabs.
 */
function DocumentPreview({
  files,
  focusDoc,
}: {
  files: FileEntry[];
  /** A chat card's ask to land on one doc; fresh object per ask, so a
   *  repeat click re-fires even after the person browsed elsewhere */
  focusDoc?: { path: string; nonce: number } | null;
}) {
  const docs = useMemo(
    () => files.filter(f => /\.md$/i.test(f.path)),
    [files],
  );
  const [active, setActive] = useState<string | null>(null);
  // A new focus ask adjusts state during render (React's documented pattern
  // for reacting to a prop change) — each ask is a fresh object, so this
  // fires once per click and never fights the person's own pill choices
  const [seenFocus, setSeenFocus] = useState(focusDoc);
  if (focusDoc !== seenFocus) {
    setSeenFocus(focusDoc);
    if (focusDoc) setActive(focusDoc.path);
  }
  const activePath = active && docs.some(d => d.path === active) ? active : docs[0]?.path;
  const doc = docs.find(d => d.path === activePath);

  return (
    <div className="h-full flex flex-col">
      {docs.length > 1 && (
        <div className="flex gap-1 border-b px-2 py-1.5 overflow-x-auto shrink-0">
          {docs.map(d => (
            <button
              key={d.path}
              onClick={() => setActive(d.path)}
              className={`rounded-full border px-2.5 py-0.5 text-xs whitespace-nowrap transition-colors ${
                d.path === activePath
                  ? 'bg-foreground text-background border-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {artifactName(d.path, d.content)}
            </button>
          ))}
        </div>
      )}
      {doc && <DocActions doc={doc} />}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 prose prose-sm dark:prose-invert">
          {doc ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
          ) : (
            <p className="text-muted-foreground text-sm">No document selected.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ServerAppNotice({ fileCount }: { fileCount: number }) {
  const setDraftMessage = useChatStore(s => s.setDraftMessage);

  function askToAdapt() {
    setDraftMessage(
      'This project needs a server at runtime (Next.js SSR or similar), which the in-browser preview can\'t run. ' +
      'Please adapt it into a client-only version that previews here: keep the look and the core features, ' +
      'but use Vite-style React (HashRouter for pages, serverless functions for any server needs). ' +
      'Start by telling me your plan, then build it.',
    );
  }

  return (
    <div className="flex items-center justify-center h-full px-6">
      <div className="max-w-sm text-center space-y-3">
        <Boxes className="size-8 mx-auto text-muted-foreground/70" />
        <p className="text-sm font-medium">This app needs a server to run</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          This project ({fileCount} files) uses a server framework — more than
          an in-browser preview can run. Everything's here: browse it in{' '}
          <strong>Files</strong>, or ask the AI to adapt it into a
          client-side version that previews and publishes anywhere.
        </p>
        <button
          onClick={askToAdapt}
          className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
        >
          <Sparkles className="size-3.5 text-primary" />
          Ask the AI to make a preview-friendly version
        </button>
      </div>
    </div>
  );
}
