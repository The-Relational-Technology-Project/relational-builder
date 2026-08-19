/**
 * Pinned CDN versions for the in-browser bundler.
 *
 * Bare imports in generated apps (react, react-router-dom, lucide-react…)
 * are left bare by esbuild and resolved by an import map in the preview
 * shell, pointing at esm.sh. Pinning known-good versions keeps builds
 * reproducible — a generated app renders the same today and in a year.
 * Packages not listed here still work: they resolve to esm.sh's latest.
 *
 * Every non-React package gets `?external=react,react-dom` so the whole
 * app shares ONE React instance via the import map — two copies of React
 * is the classic invisible hooks crash.
 */

export const REACT_VERSION = '18.3.1';

/** Curated, known-good versions for packages generated apps commonly use. */
export const PINNED_VERSIONS: Record<string, string> = {
  'react': REACT_VERSION,
  'react-dom': REACT_VERSION,
  'react-router-dom': '6.30.0',
  'lucide-react': '0.469.0',
  'clsx': '2.1.1',
  'class-variance-authority': '0.7.1',
  'tailwind-merge': '2.6.0',
  'zustand': '5.0.3',
  'date-fns': '4.1.0',
  '@supabase/supabase-js': '2.49.4',
  'framer-motion': '11.18.2',
  'recharts': '2.15.1',
  'canvas-confetti': '1.9.3',
  'qrcode': '1.5.4',
  'marked': '15.0.7',
  'uuid': '11.1.0',
};

const ESM_CDN = 'https://esm.sh';

/** Split a bare specifier into package name and subpath. */
export function splitSpecifier(spec: string): { pkg: string; subpath: string } {
  const parts = spec.split('/');
  const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const subpath = spec.slice(pkg.length); // '' or '/client' etc.
  return { pkg, subpath };
}

/**
 * CDN URL for one bare specifier. `dev` swaps React (only) to its development
 * build: full error messages and component stacks instead of
 * "Minified React error #185" — which the error→AI-fix loop can't act on.
 */
export function cdnUrl(spec: string, dev = false): string {
  const { pkg, subpath } = splitSpecifier(spec);
  const version = PINNED_VERSIONS[pkg];
  const at = version ? `@${version}` : '';
  const isReact = pkg === 'react' || pkg === 'react-dom';
  const params = isReact ? (dev ? ['dev'] : []) : ['external=react,react-dom'];
  const query = params.length > 0 ? `?${params.join('&')}` : '';
  return `${ESM_CDN}/${pkg}${at}${subpath}${query}`;
}

/**
 * The attribute preview builds stamp on every host element: where this
 * element lives in the project source ("file:line:col"). It's what lets
 * "point at it" resolve a click straight to code — swap a photo, edit
 * repeated text — with no searching and no model call. Preview-only:
 * publish builds compile with the production jsx-runtime and never carry it.
 */
export const SOURCE_TAG_ATTR = 'data-rb-source';

/**
 * A drop-in jsx-dev-runtime that stamps SOURCE_TAG_ATTR on host elements
 * (plain tags — components pass through untouched) and then defers to the
 * real React dev runtime. Served as a data: URL through the import map, so
 * the dev bundle's `import { jsxDEV } from "react/jsx-dev-runtime"` lands
 * here without touching the bundle itself.
 */
function taggingJsxDevRuntimeUrl(): string {
  const real = `${ESM_CDN}/react@${REACT_VERSION}/jsx-dev-runtime?dev`;
  const src = [
    `import * as R from ${JSON.stringify(real)};`,
    'export const Fragment = R.Fragment;',
    'export function jsxDEV(type, props, key, isStatic, source, self) {',
    "  if (typeof type === 'string' && source && source.fileName) {",
    `    props = Object.assign({}, props, { '${SOURCE_TAG_ATTR}':`,
    "      source.fileName.replace(/^[a-z-]+:/, '') + ':' + source.lineNumber + ':' + source.columnNumber });",
    '  }',
    '  return R.jsxDEV(type, props, key, isStatic, source, self);',
    '}',
  ].join('\n');
  return 'data:text/javascript;charset=utf-8,' + encodeURIComponent(src);
}

/**
 * Build the import map for the preview/publish shell from the set of bare
 * specifiers the bundle actually imports. React entries are always present
 * (the synthesized entry and jsx-runtime need them). `dev` = development
 * React for live previews; publish builds stay on production React.
 */
export function buildImportMap(bareImports: Iterable<string>, dev = false): string {
  const devQuery = dev ? '?dev' : '';
  const imports: Record<string, string> = {
    'react': cdnUrl('react', dev),
    'react/jsx-runtime': `${ESM_CDN}/react@${REACT_VERSION}/jsx-runtime${devQuery}`,
    // Live previews compile with jsxDev, so this entry is what they actually
    // import — the tagging wrapper routes through the real dev runtime
    'react/jsx-dev-runtime': dev
      ? taggingJsxDevRuntimeUrl()
      : `${ESM_CDN}/react@${REACT_VERSION}/jsx-dev-runtime${devQuery}`,
    'react-dom': cdnUrl('react-dom', dev),
    'react-dom/client': `${ESM_CDN}/react-dom@${REACT_VERSION}/client?external=react${dev ? '&dev' : ''}`,
  };
  for (const spec of bareImports) {
    if (!(spec in imports)) imports[spec] = cdnUrl(spec);
  }
  return JSON.stringify({ imports }, null, 2);
}

/** Tailwind v4 browser JIT — compiles utility classes at runtime in the shell. */
export const TAILWIND_BROWSER_URL = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';
