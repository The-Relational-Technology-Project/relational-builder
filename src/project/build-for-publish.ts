import type { FileEntry } from './virtual-fs';
import type { PublicEnvVar } from './env-module';
import { buildEnvJs, buildEnvTs } from './env-module';
import { ASSET_APPLIER, buildShellHtml } from '@/preview/bundler/shell';
import { isPhotoAssetPath } from './assets';
import { detectPreviewKind } from '@/preview/detect';
import { KIT_FILES, withKitFiles } from '@/kit';
import { PINNED_VERSIONS, REACT_VERSION, splitSpecifier } from '@/preview/bundler/versions';

/**
 * Publish-time builds for framework projects, so everything that previews
 * also deploys — as plain static files — on every target (Community,
 * Netlify, Vercel, download, share links).
 *
 * Two shapes come out of one project:
 * - `buildStaticSite` — the RUNNING site: the same bundler + shell as the
 *   live preview (minus preview-only scripts), plus non-source assets
 *   passed through (manifest, sw.js, images, assets/*.js).
 * - `materializeSource` — the SOURCE: project files + the kit files they
 *   use + a working Vite scaffold (package.json, vite.config, tsconfig),
 *   so a download or repo clone runs with `npm install && npm run dev`.
 */

const now = () => Date.now();

function entryOf(path: string, content: string, language = 'text'): FileEntry {
  return { path, content, language, createdAt: now(), updatedAt: now() };
}

function toRecord(files: FileEntry[]): Record<string, string> {
  const rec: Record<string, string> = {};
  for (const f of files) rec[f.path.startsWith('/') ? f.path : '/' + f.path] = f.content;
  return rec;
}

/** Is this a framework project (needs a publish-time build)? */
export function needsBuild(files: FileEntry[]): boolean {
  return detectPreviewKind(files) === 'framework';
}

/** Source paths consumed by the bundle — everything else passes through. */
const SOURCE_PATH = /(^\/src\/)|(^\/index\.html$)|(\.(tsx|ts|jsx)$)|(\.css$)|((^|\/)(vite|tailwind|postcss)\.config\.[jt]s$)|((^|\/)(package|tsconfig[^/]*)\.json$)/;

/**
 * Build the deployable static site for a framework project.
 * Throws with readable build errors — publish should fail loudly, not ship
 * a broken site.
 */
export async function buildStaticSite(
  files: FileEntry[],
  publicEnvVars: PublicEnvVar[],
): Promise<FileEntry[]> {
  // The compiler loads on demand: this module rides in the app's core graph
  // (code-sync's push path imports materializeSource below), and a static
  // import here put the whole esbuild-wasm shim in the initial chunk for
  // every visitor. Only publishing actually bundles.
  const { bundleProject, findFrameworkEntry } = await import('@/preview/bundler/bundle');

  const vfs: Record<string, string> = { ...KIT_FILES, ...toRecord(files) };
  vfs['/env.js'] = buildEnvJs(publicEnvVars);
  vfs['/src/env.ts'] = buildEnvTs(publicEnvVars);

  const entry = findFrameworkEntry(vfs);
  if (!entry) {
    throw new Error(
      'No entry module found — expected an index.html pointing at a module script, or /src/main.tsx.',
    );
  }

  const result = await bundleProject({
    files: vfs,
    entry,
    env: Object.fromEntries(publicEnvVars.map(v => [v.key, v.value])),
  });
  if (!result.ok) {
    throw new Error(`The app failed to build:\n${result.errors.join('\n')}`);
  }

  // Photo assets pass through as real files below — reference them from the
  // shell (plus the applier that wires `img[data-asset]` up after React
  // renders), so photos work on the published site exactly like in preview.
  const assetTags = files
    .filter(f => isPhotoAssetPath(f.path))
    .map(f => {
      const rel = f.path.startsWith('/') ? f.path.slice(1) : f.path;
      return `<script src="./${rel}"></script>`;
    });

  const html = buildShellHtml({
    bundle: result,
    indexHtml: vfs['/index.html'],
    bodyExtra: assetTags.length > 0 ? [...assetTags, ASSET_APPLIER] : [ASSET_APPLIER],
  });

  const out: FileEntry[] = [entryOf('/index.html', html, 'html')];
  for (const f of files) {
    const path = f.path.startsWith('/') ? f.path : '/' + f.path;
    if (!SOURCE_PATH.test(path)) out.push({ ...f, path });
  }
  return out;
}

/** Bare npm specifiers the project + used kit files import. */
function collectBarePackages(rec: Record<string, string>): string[] {
  const pkgs = new Set<string>();
  for (const [path, content] of Object.entries(rec)) {
    if (!/\.(t|j)sx?$/.test(path)) continue;
    for (const m of content.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('@/')) continue;
      if (/^https?:/.test(spec)) continue;
      pkgs.add(splitSpecifier(spec).pkg);
    }
  }
  return [...pkgs].sort();
}

/**
 * Project source + used kit files + a working Vite scaffold. What Download
 * and GitHub should carry for framework projects: clone → npm install →
 * npm run dev, no builder required.
 */
export function materializeSource(files: FileEntry[]): FileEntry[] {
  const rec = withKitFiles(toRecord(files));

  const deps: Record<string, string> = {
    react: `^${REACT_VERSION}`,
    'react-dom': `^${REACT_VERSION}`,
  };
  for (const pkg of collectBarePackages(rec)) {
    if (pkg === 'react' || pkg === 'react-dom') continue;
    deps[pkg] = PINNED_VERSIONS[pkg] ? `^${PINNED_VERSIONS[pkg]}` : 'latest';
  }

  if (!rec['/package.json']) {
    rec['/package.json'] = JSON.stringify(
      {
        name: 'community-app',
        private: true,
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: deps,
        devDependencies: {
          '@vitejs/plugin-react': '^5.0.0',
          '@tailwindcss/vite': '^4.1.0',
          tailwindcss: '^4.1.0',
          typescript: '^5.8.0',
          vite: '^7.0.0',
        },
      },
      null,
      2,
    );
  }

  if (!rec['/vite.config.ts']) {
    rec['/vite.config.ts'] = [
      "import { defineConfig } from 'vite';",
      "import react from '@vitejs/plugin-react';",
      "import tailwindcss from '@tailwindcss/vite';",
      "import path from 'node:path';",
      '',
      'export default defineConfig({',
      '  plugins: [react(), tailwindcss()],',
      "  resolve: { alias: { '@': path.resolve(__dirname, './src') } },",
      '});',
      '',
    ].join('\n');
  }

  if (!rec['/tsconfig.json']) {
    rec['/tsconfig.json'] = JSON.stringify(
      {
        compilerOptions: {
          target: 'ES2020',
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          strict: false,
          skipLibCheck: true,
          noEmit: true,
          baseUrl: '.',
          paths: { '@/*': ['./src/*'] },
        },
        include: ['src'],
      },
      null,
      2,
    );
  }

  return Object.entries(rec).map(([path, content]) => entryOf(path, content));
}
