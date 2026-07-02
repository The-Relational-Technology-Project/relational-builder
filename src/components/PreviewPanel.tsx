import { useMemo } from 'react';
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
import { Wrench } from 'lucide-react';

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
        }}
        theme="dark"
        style={{ flex: 1, display: 'flex', flexDirection: 'column' }}
      >
        <SandpackPreview
          showNavigator={false}
          showRefreshButton={false}
          showOpenInCodeSandbox={false}
          style={{ flex: 1 }}
        />
        <PreviewErrorBanner />
      </SandpackProvider>
    </div>
  );
}

/**
 * The error→AI loop: when the preview breaks (bundler or runtime error),
 * offer a one-click "Ask AI to fix it" that hands the exact error to the
 * chat in build mode — no copy-pasting stack traces.
 */
function PreviewErrorBanner() {
  const { sandpack } = useSandpack();
  const queueMessage = useChatStore(s => s.queueMessage);
  const isGenerating = useChatStore(s => s.isGenerating);

  const error = sandpack.error;
  if (!error) return null;

  const errorText = [error.title, error.message].filter(Boolean).join('\n');

  function handleFix() {
    queueMessage(
      [
        'The live preview is showing this error:',
        '',
        '```',
        errorText.slice(0, 2000),
        '```',
        '',
        'Please fix it. Re-output the complete corrected file(s) with filename annotations, changing as little else as possible.',
      ].join('\n'),
    );
  }

  return (
    <div className="shrink-0 border-t bg-destructive/10 px-3 py-2 flex items-center gap-2">
      <p className="text-xs text-destructive flex-1 line-clamp-2" title={errorText}>
        The preview hit an error: {error.message?.slice(0, 140) ?? 'unknown error'}
      </p>
      <button
        onClick={handleFix}
        disabled={isGenerating}
        className="inline-flex items-center gap-1 rounded-md bg-destructive text-destructive-foreground px-2.5 py-1 text-xs font-medium hover:opacity-90 disabled:opacity-50 shrink-0"
      >
        <Wrench className="size-3" />
        {isGenerating ? 'Fixing...' : 'Ask AI to fix it'}
      </button>
    </div>
  );
}
