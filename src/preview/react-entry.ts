import type { SandpackFiles } from '@codesandbox/sandpack-react';

/**
 * Decide which module Sandpack should bundle as the entry for a react /
 * react-ts app, so the generated code actually runs instead of the template's
 * default "Hello world" shell.
 *
 * Sandpack merges the generated files ON TOP of its template's defaults
 * (/index.js + /App.js, where /App.js renders "Hello world"). Anything the app
 * doesn't put at those exact paths is ignored: the template's /index.js imports
 * `./App`, which resolves to the default /App.js — NOT a generated /App.jsx —
 * so the preview shows "Hello world". Pointing `customSetup.entry` at the app's
 * own entry fixes it. Three cases, in order of preference:
 *
 *   1. The app ships a conventionally named entry (Vite `/src/main.tsx`,
 *      CRA-style `/index.jsx`, etc.) — point Sandpack straight at it. This
 *      also covers `.jsx`/`.tsx` entries the template's default `/index.js`
 *      would otherwise shadow.
 *   2. No conventional name, but some module mounts the app itself
 *      (`createRoot(...)` / `ReactDOM.render(...)`) — use that module.
 *   3. Neither — the app is just an `App` component (the common shape: a bare
 *      `App.jsx` + `index.html`, no separate entry). Synthesize a tiny entry
 *      that mounts it, importing by exact path so it can't resolve back to the
 *      template's default `/App.js`.
 *
 * Mutates `spFiles` to add the synthesized entry in case 3. Returns the entry
 * path, or undefined when there's nothing to point at (leaving Sandpack on its
 * default — the best we can do for a react app with no discernible root).
 */
export function resolveReactEntry(
  spFiles: SandpackFiles,
  tmpl: 'react' | 'react-ts',
): string | undefined {
  const has = (p: string) => spFiles[p] !== undefined;
  const codeOf = (p: string) => {
    const f = spFiles[p];
    return typeof f === 'string' ? f : f?.code ?? '';
  };

  // 1. Conventionally named entry file.
  const named = [
    '/src/main.tsx', '/src/main.jsx',
    '/src/index.tsx', '/src/index.jsx',
    '/main.tsx', '/main.jsx',
    '/index.tsx', '/index.jsx', '/index.ts', '/index.js',
  ].find(has);
  if (named) return named;

  // 2. Some module mounts the app itself, under a non-standard name.
  const mounter = Object.keys(spFiles).find(
    p => /\.(t|j)sx?$/.test(p) && /\bcreateRoot\s*\(|ReactDOM\.render\s*\(/.test(codeOf(p)),
  );
  if (mounter) return mounter;

  // 3. Just an App component — synthesize an entry that mounts it.
  const appPath = ['/App.tsx', '/App.jsx', '/src/App.tsx', '/src/App.jsx'].find(has);
  if (appPath) {
    const entryPath = tmpl === 'react-ts' ? '/rb-entry.tsx' : '/rb-entry.jsx';
    // The template's default /index.* (which we're replacing) also imports a
    // global stylesheet, so carry one through if the app ships it as a sibling
    // — otherwise a bare `App + styles.css` app would render unstyled.
    const cssPath = [
      '/styles.css', '/index.css', '/global.css',
      '/src/styles.css', '/src/index.css', '/src/global.css',
    ].find(has);
    spFiles[entryPath] = { code: buildReactEntry(appPath, cssPath) };
    return entryPath;
  }

  return undefined;
}

/** Source for the synthesized entry: mount the app's App component at #root. */
function buildReactEntry(appPath: string, cssPath?: string): string {
  // Import by exact path (keep the extension) so it resolves to the generated
  // file, never the template's default /App.js sitting at the same base name.
  const toRel = (p: string) => p.replace(/^\//, './');
  const lines = ["import { createRoot } from 'react-dom/client';"];
  if (cssPath) lines.push(`import '${toRel(cssPath)}';`);
  lines.push(
    `import App from '${toRel(appPath)}';`,
    '',
    "const rootEl = document.getElementById('root');",
    'if (rootEl) createRoot(rootEl).render(<App />);',
    '',
  );
  return lines.join('\n');
}
