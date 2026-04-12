import { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  type SandpackFiles,
} from '@codesandbox/sandpack-react';
import { useProjectStore } from '@/store/project-store';
import { RotateCw } from 'lucide-react';

/**
 * Live preview of the generated project using Sandpack.
 * Auto-detects whether to use static HTML or React template
 * based on the files in the virtual file system.
 */
export function PreviewPanel() {
  const version = useProjectStore(s => s.version);
  const getAllFiles = useProjectStore(s => s.getAllFiles);

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

    return { sandpackFiles: spFiles, template: tmpl };
  }, [files]);

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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <span className="text-xs font-medium">
          Preview
          <span className="text-muted-foreground ml-1.5">({template})</span>
        </span>
        <RefreshButton />
      </div>
      <div className="flex-1 min-h-0">
        <SandpackProvider
          template={template}
          files={sandpackFiles}
          options={{
            autoReload: true,
            autorun: true,
          }}
          theme="dark"
        >
          <SandpackPreview
            showNavigator={false}
            showRefreshButton={false}
            showOpenInCodeSandbox={false}
            style={{ height: '100%', width: '100%' }}
          />
        </SandpackProvider>
      </div>
    </div>
  );
}

function RefreshButton() {
  // Simple visual refresh button — forces a remount by bumping version
  // Sandpack auto-refreshes on file changes, but this is a manual fallback
  const version = useProjectStore(s => s.version);

  function handleRefresh() {
    // Force re-render by triggering a version bump with no actual changes
    useProjectStore.setState(s => ({ version: s.version + 1 }));
  }

  void version;

  return (
    <button
      onClick={handleRefresh}
      className="text-muted-foreground hover:text-foreground p-0.5 rounded"
      title="Refresh preview"
    >
      <RotateCw className="size-3.5" />
    </button>
  );
}
