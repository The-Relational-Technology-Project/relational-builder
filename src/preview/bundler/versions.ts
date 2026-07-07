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

/** CDN URL for one bare specifier. */
export function cdnUrl(spec: string): string {
  const { pkg, subpath } = splitSpecifier(spec);
  const version = PINNED_VERSIONS[pkg];
  const at = version ? `@${version}` : '';
  const isReact = pkg === 'react' || pkg === 'react-dom';
  const query = isReact ? '' : '?external=react,react-dom';
  return `${ESM_CDN}/${pkg}${at}${subpath}${query}`;
}

/**
 * Build the import map for the preview/publish shell from the set of bare
 * specifiers the bundle actually imports. React entries are always present
 * (the synthesized entry and jsx-runtime need them).
 */
export function buildImportMap(bareImports: Iterable<string>): string {
  const imports: Record<string, string> = {
    'react': cdnUrl('react'),
    'react/jsx-runtime': `${ESM_CDN}/react@${REACT_VERSION}/jsx-runtime`,
    'react/jsx-dev-runtime': `${ESM_CDN}/react@${REACT_VERSION}/jsx-dev-runtime`,
    'react-dom': cdnUrl('react-dom'),
    'react-dom/client': `${ESM_CDN}/react-dom@${REACT_VERSION}/client?external=react`,
  };
  for (const spec of bareImports) {
    if (!(spec in imports)) imports[spec] = cdnUrl(spec);
  }
  return JSON.stringify({ imports }, null, 2);
}

/** Tailwind v4 browser JIT — compiles utility classes at runtime in the shell. */
export const TAILWIND_BROWSER_URL = 'https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4';
