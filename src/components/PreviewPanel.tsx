import { useEffect, useMemo, useRef, useState } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
  type SandpackFiles,
} from '@codesandbox/sandpack-react';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { useChatStore } from '@/store/chat-store';
import { buildEnvJs, buildEnvTs } from '@/project/env-module';
import { INSPECT_SOURCE } from '@/preview/inspect-source';
import { Wrench, MousePointerClick, Loader2 } from 'lucide-react';

/**
 * Live preview of the generated project using Sandpack.
 * Auto-detects whether to use static HTML or React template
 * based on the files in the virtual file system.
 */
export function PreviewPanel() {
  const version = useProjectStore(s => s.version);
  const getAllFiles = useProjectStore(s => s.getAllFiles);
  const allEnvVars = useEnvStore(s => s.vars);
  const publicEnvVars = useMemo(() => allEnvVars.filter(v => !v.isSecret), [allEnvVars]);

  // Re-read files when VFS changes
  void version;
  const files = getAllFiles();

  const { sandpackFiles, template } = useMemo(() => {
    if (files.length === 0) {
      return { sandpackFiles: null, template: 'static' as const };
    }

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

    // Inject public env vars: /env.js works everywhere (global + ES module);
    // /src/env.ts serves typed imports in React templates
    if (publicEnvVars.length > 0) {
      spFiles['/env.js'] = { code: buildEnvJs(publicEnvVars) };
      spFiles['/src/env.ts'] = { code: buildEnvTs(publicEnvVars) };
    }

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

    return { sandpackFiles: spFiles, template: tmpl };
  }, [files, publicEnvVars]);

  if (!sandpackFiles) {
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

  return (
    <div className="h-full" style={{ display: 'flex', flexDirection: 'column' }}>
      <SandpackProvider
        // Remount on file-system changes: SandpackProvider holds stale error
        // state when the files prop changes underneath it (e.g. on restore)
        key={`sandpack-${version}`}
        template={template}
        files={sandpackFiles}
        options={{
          autoReload: true,
          autorun: true,
          externalResources: template === 'static' ? [] : [`${window.location.origin}/inspect.js`],
        }}
        theme="dark"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <InspectablePreview />
        <PreviewErrorBanner />
      </SandpackProvider>
    </div>
  );
}

/**
 * The preview plus "Point at it": toggle select mode, click any element in
 * the running app, and the chat input is prefilled with a description of
 * that element — no selectors, no code-speak, just point.
 */
function InspectablePreview() {
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
      const el = d.el as { tag: string; text: string; path: string; html: string };
      const bits = [
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
      <SandpackPreview
        showNavigator={false}
        showRefreshButton={false}
        showOpenInCodeSandbox={false}
        style={{ flex: 1 }}
      />
      <button
        onClick={() => setSelecting(s => !s)}
        title={selecting
          ? 'Click an element in the preview to describe a change — or click here to cancel'
          : 'Point at what you want to change'}
        className={`absolute bottom-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shadow-md transition-colors ${
          selecting
            ? 'bg-indigo-600 text-white'
            : 'bg-background/90 border text-muted-foreground hover:text-foreground'
        }`}
      >
        <MousePointerClick className="size-3.5" />
        {selecting ? 'Click the thing to change…' : 'Point at it'}
      </button>
    </div>
  );
}

function fixPrompt(errorText: string): string {
  return [
    'The live preview is showing this error:',
    '',
    '```',
    errorText.slice(0, 2000),
    '```',
    '',
    'Please fix it. Re-output the complete corrected file(s) with filename annotations, changing as little else as possible.',
  ].join('\n');
}

/**
 * The error→AI loop. Right after an AI build breaks the preview, ONE fix
 * pass fires automatically (armed per normal build; fix attempts never
 * re-arm it, so it cannot loop). If the error survives that pass — or came
 * from anything other than a fresh build — the manual button takes over.
 */
function PreviewErrorBanner() {
  const { sandpack } = useSandpack();
  const queueFix = useChatStore(s => s.queueFix);
  const isGenerating = useChatStore(s => s.isGenerating);
  const autoFixArmed = useChatStore(s => s.autoFixArmed);

  const error = sandpack.error;
  const errorText = error ? [error.title, error.message].filter(Boolean).join('\n') : '';

  // The single automatic pass
  useEffect(() => {
    if (!error || !autoFixArmed || isGenerating) return;
    useChatStore.setState({ autoFixArmed: false });
    queueFix(fixPrompt(errorText));
  }, [error, autoFixArmed, isGenerating, errorText, queueFix]);

  if (!error) return null;

  const autoFixing = isGenerating;

  return (
    <div className="shrink-0 border-t bg-destructive/10 px-3 py-2 flex items-center gap-2">
      <p className="text-xs text-destructive flex-1 line-clamp-2" title={errorText}>
        {autoFixing
          ? 'The preview hit an error — fixing it automatically…'
          : `The preview hit an error: ${error.message?.slice(0, 140) ?? 'unknown error'}`}
      </p>
      {autoFixing ? (
        <span className="inline-flex items-center gap-1 text-xs text-destructive shrink-0">
          <Loader2 className="size-3 animate-spin" />
        </span>
      ) : (
        <button
          onClick={() => queueFix(fixPrompt(errorText))}
          className="inline-flex items-center gap-1 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1 text-xs font-medium hover:opacity-90 shrink-0"
        >
          <Wrench className="size-3" />
          Ask AI to fix it
        </button>
      )}
    </div>
  );
}
