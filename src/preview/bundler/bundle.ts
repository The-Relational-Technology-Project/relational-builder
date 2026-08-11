import * as esbuild from 'esbuild-wasm';
import wasmURL from 'esbuild-wasm/esbuild.wasm?url';
import { buildImportMap, cdnUrl } from './versions';
import { imageMimeFor } from '@/project/app-icon';

/**
 * The in-browser bundler: real multi-file React apps — Vite-style layout,
 * `@/` path aliases, npm packages, Tailwind — compiled right here in the
 * page with esbuild-wasm. It powers BOTH the live preview and publish
 * builds, so anything that previews also deploys, everywhere, as static
 * files.
 *
 * How each import kind is handled:
 * - Relative and `@/` imports resolve inside the project's virtual FS
 *   (Vite-style: exact path, then +.tsx/.ts/.jsx/.js, then /index.*).
 * - Bare imports (react, react-router-dom…) are left external; the preview
 *   shell maps them to pinned esm.sh URLs via an import map (versions.ts).
 *   No npm install, ever.
 * - CSS imports become no-op modules and their text is COLLECTED, not
 *   bundled: the shell inlines them as `<style type="text/tailwindcss">`
 *   so Tailwind v4's browser JIT compiles utilities and `@theme` token
 *   blocks; plain CSS passes through the JIT untouched.
 * - SVG imports inline as data URLs; JSON imports work natively.
 * - Binary images (png/jpg/…) live in the VFS as bare base64 (the app-icon
 *   convention) and compile to `export default "data:…;base64,…"` — Vite
 *   semantics, so imported apps' `import photo from '@/assets/photo.png'`
 *   just works. An image the project doesn't have resolves to a neutral
 *   placeholder instead of failing the whole build: a missing photo should
 *   read as a missing photo, not a broken app.
 */

export interface BundleInput {
  /** path (leading slash) → file content */
  files: Record<string, string>;
  /** Entry module, e.g. /src/main.tsx */
  entry: string;
  /** Development React in the import map (live preview only) — real error
   *  messages and component stacks instead of minified error codes */
  dev?: boolean;
  /**
   * Public env vars, compiled in as `import.meta.env.*` — the Vite
   * convention imported apps (Lovable and friends) already use. RB's own
   * generated apps import the env module instead, but a project moving in
   * from elsewhere shouldn't crash the preview over the difference.
   */
  env?: Record<string, string>;
}

export interface BundleSuccess {
  ok: true;
  /** Bundled ESM JavaScript (bare imports left for the import map) */
  js: string;
  /** Collected CSS text, in first-import order */
  css: string[];
  /** JSON import map covering every bare import the bundle uses */
  importMap: string;
}

export interface BundleFailure {
  ok: false;
  /** Human-readable build errors, formatted with file/line context */
  errors: string[];
}

export type BundleResult = BundleSuccess | BundleFailure;

/** Aliases the bundler understands (Vite convention used by generated apps). */
const ALIASES: Array<[prefix: string, target: string]> = [
  ['@/', '/src/'],
];

const RESOLVE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|ico)$/i;

/** The real bytes win over the extension: an oversized import is stored
 *  re-compressed, which can put JPEG bytes behind a .png path. */
function sniffImageMime(base64: string, path: string): string {
  if (base64.startsWith('/9j/')) return 'image/jpeg';
  if (base64.startsWith('iVBOR')) return 'image/png';
  if (base64.startsWith('R0lGOD')) return 'image/gif';
  if (base64.startsWith('UklGR')) return 'image/webp';
  return imageMimeFor(path);
}

/** What a missing image looks like: quiet, obviously a stand-in, never an
 *  error screen. */
const PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">' +
  '<rect width="800" height="500" fill="#e8e2d9"/>' +
  '<g fill="none" stroke="#b0a695" stroke-width="14" stroke-linecap="round" stroke-linejoin="round">' +
  '<rect x="290" y="160" width="220" height="180" rx="18"/>' +
  '<circle cx="352" cy="222" r="20"/>' +
  '<path d="M310 320 L380 250 L430 300 L470 260 L490 320"/>' +
  '</g></svg>';

const PLACEHOLDER_DATA_URL =
  'data:image/svg+xml,' + encodeURIComponent(PLACEHOLDER_SVG);

let initPromise: Promise<void> | null = null;

/**
 * Initialize esbuild-wasm once. The wasm binary ships with the app bundle
 * (no CDN dependence for the compiler itself) and loads lazily — simple
 * projects on the fast Sandpack path never pay for it.
 */
export function initBundler(): Promise<void> {
  if (!initPromise) {
    // Under Node (the bench harness runs this module via Vite SSR),
    // esbuild-wasm resolves to its Node build, which boots the wasm binary
    // itself on first use — initialize({ wasmURL }) is browser-only and throws.
    initPromise = (typeof window === 'undefined'
      ? Promise.resolve()
      : esbuild.initialize({ wasmURL, worker: true })
    ).catch(err => {
      initPromise = null; // allow retry after a failed load
      throw err;
    });
  }
  return initPromise;
}

/** Vite-style resolution inside the VFS. Returns the resolved path or null. */
export function resolveInVfs(
  files: Record<string, string>,
  path: string,
): string | null {
  if (path in files) return path;
  for (const ext of RESOLVE_EXTENSIONS) {
    if (path + ext in files) return path + ext;
  }
  const dir = path.endsWith('/') ? path : path + '/';
  for (const ext of RESOLVE_EXTENSIONS) {
    if (dir + 'index' + ext in files) return dir + 'index' + ext;
  }
  return null;
}

/** Join an importer's directory with a relative import, normalizing ../ */
function joinRelative(importer: string, rel: string): string {
  const base = importer.slice(0, importer.lastIndexOf('/'));
  const parts = (base + '/' + rel).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return '/' + out.join('/');
}

function loaderFor(path: string): esbuild.Loader {
  if (path.endsWith('.tsx')) return 'tsx';
  if (path.endsWith('.ts')) return 'ts';
  if (path.endsWith('.jsx')) return 'jsx';
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.svg')) return 'dataurl';
  return 'js';
}

/** Bundle a project from the virtual FS. Never throws on build errors. */
export async function bundleProject(input: BundleInput): Promise<BundleResult> {
  await initBundler();

  const { files, entry } = input;
  const bareImports = new Set<string>();
  const cssChunks: string[] = [];
  const seenCss = new Set<string>();

  const vfsPlugin: esbuild.Plugin = {
    name: 'rb-vfs',
    setup(build) {
      // Entry + everything project-local lives in the 'vfs' namespace.
      build.onResolve({ filter: /.*/ }, args => {
        let path = args.path;

        if (args.kind === 'entry-point') {
          return { path: entry, namespace: 'vfs' };
        }

        // `@/` and friends → VFS directories
        for (const [prefix, target] of ALIASES) {
          if (path.startsWith(prefix)) {
            path = target + path.slice(prefix.length);
            break;
          }
        }

        // Absolute (/src/x) and relative (./x, ../x) → VFS
        if (path.startsWith('./') || path.startsWith('../')) {
          path = joinRelative(args.importer, path);
        }
        if (path.startsWith('/')) {
          // Vite-style asset suffixes (?url and friends) name the same file
          const bare = path.replace(/\?[^?]*$/, '');
          const resolved = resolveInVfs(files, IMAGE_EXT.test(bare) ? bare : path);
          if (resolved) return { path: resolved, namespace: 'vfs' };
          if (IMAGE_EXT.test(bare)) {
            // An image the workspace doesn't hold (skipped at import, or a
            // forge that can't provide it): stand in, don't fail the build
            return { path: bare, namespace: 'rb-missing-image' };
          }
          return {
            errors: [{
              text: `Could not find "${args.path}" in the project (imported from ${args.importer})`,
            }],
          };
        }

        // URL imports pass straight through to the browser
        if (/^https?:\/\//.test(path)) return { path, external: true };

        // Live preview only: route by hash, whatever router the app asks
        // for. The preview runs in a blob: iframe whose URL path matches no
        // app route, so a BrowserRouter mounts, matches nothing, and renders
        // a blank page with no error — the classic imported-app mystery
        // (every Lovable app ships BrowserRouter). The preview toolbar
        // already navigates by hash (NAV_BRIDGE), so hash routing is the
        // native dialect here. Publish builds keep the app's own router and
        // its real URLs.
        if (input.dev && path === 'react-router-dom') {
          return { path, namespace: 'rb-router-preview' };
        }

        // Bare import → external, satisfied by the shell's import map
        bareImports.add(path);
        return { path, external: true };
      });

      build.onLoad({ filter: /.*/, namespace: 'rb-router-preview' }, () => {
        // Same URL the import map would use, so the module instance is
        // shared with anything else that reaches react-router-dom
        const real = cdnUrl('react-router-dom');
        return {
          contents: [
            `export * from ${JSON.stringify(real)};`,
            // Explicit exports win over the star per ESM semantics
            `export { HashRouter as BrowserRouter, createHashRouter as createBrowserRouter } from ${JSON.stringify(real)};`,
          ].join('\n'),
          loader: 'js',
        };
      });

      build.onLoad({ filter: /.*/, namespace: 'rb-missing-image' }, () => ({
        contents: `export default ${JSON.stringify(PLACEHOLDER_DATA_URL)};`,
        loader: 'js',
      }));

      build.onLoad({ filter: /.*/, namespace: 'vfs' }, args => {
        const content = files[args.path] ?? '';

        // Binary images: bare base64 in the VFS → a data-URL module, the
        // same shape Vite gives `import photo from './photo.png'`
        if (IMAGE_EXT.test(args.path)) {
          const url = `data:${sniffImageMime(content, args.path)};base64,${content}`;
          return { contents: `export default ${JSON.stringify(url)};`, loader: 'js' };
        }

        // CSS: collect for the shell's Tailwind JIT, import becomes a no-op
        if (args.path.endsWith('.css')) {
          if (!seenCss.has(args.path)) {
            seenCss.add(args.path);
            // The browser JIT provides Tailwind itself — drop the import
            // that only makes sense to a build pipeline.
            cssChunks.push(
              content.replace(/@import\s+(['"])tailwindcss\1\s*;?/g, ''),
            );
          }
          return { contents: '', loader: 'js' };
        }

        return { contents: content, loader: loaderFor(args.path) };
      });
    },
  };

  try {
    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      format: 'esm',
      target: 'es2020',
      jsx: 'automatic',
      // Generated code is read by the browser JIT and by humans remixing —
      // keep it debuggable, don't minify.
      minify: false,
      logLevel: 'silent',
      // The whole object, not per-key defines: `import.meta.env.ANYTHING`
      // then reads a real object — unknown keys are undefined instead of a
      // TypeError on `env` itself, matching how Vite behaves.
      define: {
        'import.meta.env': JSON.stringify({
          ...(input.env ?? {}),
          MODE: input.dev ? 'development' : 'production',
          DEV: input.dev ?? false,
          PROD: !(input.dev ?? false),
          SSR: false,
          BASE_URL: '/',
        }),
      },
      plugins: [vfsPlugin],
    });

    const js = result.outputFiles?.[0]?.text ?? '';
    return {
      ok: true,
      js,
      css: cssChunks,
      importMap: buildImportMap(bareImports, input.dev ?? false),
    };
  } catch (err) {
    const failure = err as { errors?: esbuild.Message[] };
    const errors = (failure.errors ?? []).map(m => {
      const loc = m.location ? `${m.location.file}:${m.location.line}: ` : '';
      return `${loc}${m.text}`;
    });
    return {
      ok: false,
      errors: errors.length > 0 ? errors : [String(err)],
    };
  }
}

/**
 * Find the entry module for a framework project: the module script its
 * index.html points at, or the conventional Vite locations.
 */
export function findFrameworkEntry(files: Record<string, string>): string | null {
  const html = files['/index.html'];
  if (html) {
    const m = html.match(/<script[^>]*type=["']module["'][^>]*src=["']([^"']+)["']/i)
      ?? html.match(/<script[^>]*src=["']([^"']+)["'][^>]*type=["']module["']/i);
    if (m) {
      const src = m[1].replace(/^\.\//, '/');
      const resolved = resolveInVfs(files, src.startsWith('/') ? src : '/' + src);
      if (resolved) return resolved;
    }
  }
  for (const candidate of [
    '/src/main.tsx', '/src/main.jsx', '/src/index.tsx', '/src/index.jsx',
    '/main.tsx', '/main.jsx', '/index.tsx', '/index.jsx',
  ]) {
    if (candidate in files) return candidate;
  }
  return null;
}
