import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
  type SandpackFiles,
} from '@codesandbox/sandpack-react';
import type { FileEntry } from '@/project/virtual-fs';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { useChatStore } from '@/store/chat-store';
import { buildEnvJs, buildEnvTs } from '@/project/env-module';
import { INSPECT_SOURCE } from '@/preview/inspect-source';
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

  // Re-read files when VFS changes
  void version;
  const files = getAllFiles();
  const kind = useMemo(() => detectPreviewKind(files), [files]);

  // Toolbar state: device width, engine controls, page tracking
  const [device, setDevice] = useState<PreviewDevice>('desktop');
  const [handle, setHandle] = useState<PreviewHandle | null>(null);
  const [currentRoute, setCurrentRoute] = useState('/');
  const [reloadKey, setReloadKey] = useState(0);
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
    return <DocumentPreview files={files} />;
  }

  return (
    <div className="h-full" style={{ display: 'flex', flexDirection: 'column' }}>
      <PreviewToolbar
        device={device}
        onDevice={setDevice}
        routes={routes}
        currentRoute={currentRoute}
        handle={kind === 'framework' ? handle : sandpackHandle}
      />
      <DeviceFrame device={device}>
        {kind === 'framework' ? (
          <FrameworkPreview
            files={files}
            version={version}
            publicEnvVars={publicEnvVars}
            onHandle={setHandle}
          />
        ) : (
          <SandpackPath
            key={`reload-${reloadKey}`}
            files={files}
            version={version}
            publicEnvVars={publicEnvVars}
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
}: {
  files: ReturnType<ReturnType<typeof useProjectStore.getState>['getAllFiles']>;
  version: number;
  publicEnvVars: { key: string; value: string }[];
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
      const html = spFiles['/index.html'];
      const code = typeof html === 'string' ? html : html.code;
      const tag = '<script src="./rb-inspect.js"></script>';
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

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
            : [`${window.location.origin}/inspect.js`, ...externalResources],
        }}
        theme="dark"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <PointAtIt>
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
  return <FixBanner error={errorText} />;
}

/**
 * Shown when a project needs a server at runtime (Next.js SSR and friends) —
 * something no in-browser preview can run. The files are all here and export
 * fine; this replaces a cryptic bundler error with a clear explanation and a
 * path forward.
 */

/**
 * Program builds — plans, program docs, materials — read like pages, they
 * don't run. Markdown files render directly; multiple docs get tabs.
 */
function DocumentPreview({ files }: { files: FileEntry[] }) {
  const docs = useMemo(
    () => files.filter(f => /\.md$/i.test(f.path)),
    [files],
  );
  const [active, setActive] = useState<string | null>(null);
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
              {d.path.replace(/^\//, '')}
            </button>
          ))}
        </div>
      )}
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
