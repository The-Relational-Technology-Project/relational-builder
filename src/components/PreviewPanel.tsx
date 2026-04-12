import { useMemo } from 'react';
import {
  SandpackProvider,
  SandpackPreview,
  type SandpackFiles,
} from '@codesandbox/sandpack-react';
import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';

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

    // Inject public env vars as a virtual module
    if (publicEnvVars.length > 0) {
      const entries = publicEnvVars
        .map((v) => `  ${JSON.stringify(v.key)}: ${JSON.stringify(v.value)},`)
        .join('\n');
      spFiles['/src/env.ts'] = {
        code: `// Auto-generated from Environment panel — import { env } from "./env"\nexport const env = {\n${entries}\n} as const;\n`,
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
      </SandpackProvider>
    </div>
  );
}
