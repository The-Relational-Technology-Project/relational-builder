/**
 * Static import check: the four import mistakes that made 8 of 10 open-model
 * builds fail on Oct 30 and 31, 2026, phrased as bundler-style errors so the
 * same single fix pass can act on them. The bundler itself only sees one of
 * the four (a file imported but never written); the other three surface in
 * the browser as a blank page.
 *
 *  1. a `lucide-react` icon name that does not exist
 *  2. a default import from a module that only exports names (project or
 *     kit files we can read; plus `zustand` and `lucide-react`)
 *  3. a capitalized JSX component used with no import or declaration in
 *     the file
 *  4. a relative or `@/` import that resolves to no project or kit file,
 *     or names an export the target does not have
 *  5. `React.` used (React.useState, React.FC) with no `import React` or
 *     `import * as React` in the file; the automatic JSX runtime makes the
 *     JSX itself work, so this only shows at runtime (gemma, Nov 1, 2026)
 *
 * Pure: files in, messages out. No bundling, no network. Lives in the
 * product (src/project) so the preview's guardrail and the bench measure
 * the same thing; the bench imports it from here.
 */

import { isLucideIconName } from '@/preview/lucide-icons';

const CODE_RE = /\.(tsx?|jsx?)$/;
/** React members that exist at runtime: hooks and functions (lower-case
 *  first letter) and the few components a file renders from React itself */
const REACT_VALUE_USE_RE = /\bReact\.(?:[a-z]\w*|StrictMode|Fragment|Suspense|Profiler|Children|Component|PureComponent)\b/;
const JSX_RE = /\.(tsx|jsx)$/;
/** Bare packages known to export names only (a default import is a mistake) */
const NAMED_ONLY_PACKAGES = new Set(['zustand', 'lucide-react']);

export interface ImportCheckOptions {
  /** Files that exist outside the project (the kit), path → source */
  kitFiles?: Record<string, string>;
}

interface ImportStmt {
  spec: string;
  defaultName: string | null;
  named: string[];
  namespace: string | null;
}

const IMPORT_STMT_RE = /import\s+(?:type\s+)?([^'";]+?)\s+from\s+['"]([^'"]+)['"]/g;

function parseImports(source: string): ImportStmt[] {
  const out: ImportStmt[] = [];
  for (const m of source.matchAll(IMPORT_STMT_RE)) {
    const clause = m[1].trim();
    const spec = m[2];
    let defaultName: string | null = null;
    const named: string[] = [];
    let namespace: string | null = null;
    const ns = clause.match(/\*\s+as\s+(\w+)/);
    if (ns) namespace = ns[1];
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const part of braces[1].split(',')) {
        const name = part.trim().replace(/^type\s+/, '');
        if (!name) continue;
        named.push(name.split(/\s+as\s+/)[0].trim());
      }
    }
    const before = clause.replace(/\{[^}]*\}/, '').replace(/\*\s+as\s+\w+/, '').replace(/,/g, '').trim();
    if (before && /^\w+$/.test(before)) defaultName = before;
    out.push({ spec, defaultName, named, namespace });
  }
  return out;
}

function resolveLocal(fromPath: string, spec: string, all: Record<string, string>): string | null | undefined {
  // undefined: not a local spec (bare package). null: local but missing.
  let base: string;
  if (spec.startsWith('@/')) base = '/src/' + spec.slice(2);
  else if (spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/')) {
    const dir = fromPath.slice(0, fromPath.lastIndexOf('/'));
    const parts = (spec.startsWith('/') ? spec : dir + '/' + spec).split('/');
    const out: string[] = [];
    for (const p of parts) {
      if (p === '' || p === '.') continue;
      if (p === '..') out.pop();
      else out.push(p);
    }
    base = '/' + out.join('/');
  } else return undefined;
  const candidates = [base, ...['.tsx', '.ts', '.jsx', '.js', '.json', '.css'].map(e => base + e), ...['/index.tsx', '/index.ts'].map(e => base + e)];
  for (const c of candidates) if (c in all) return c;
  return null;
}

function hasDefaultExport(source: string): boolean {
  return /export\s+default\b/.test(source) || /export\s*\{[^}]*\bas\s+default\b[^}]*\}/.test(source);
}

function hasNamedExport(source: string, name: string): boolean {
  if (new RegExp(`export\\s+(?:async\\s+)?(?:const|let|var|function\\*?|class|type|interface|enum)\\s+${name}\\b`).test(source)) return true;
  if (new RegExp(`export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`).test(source)) return true;
  if (/export\s*\*\s*from/.test(source)) return true; // re-export; cannot tell, assume present
  return false;
}

/** A component name counts as declared when it appears anywhere in the file
 *  other than as a JSX tag: an import, a declaration, a destructured prop
 *  (`{ icon: Icon }`), a parameter. Only a name that exists solely inside
 *  `<Name ...>` tags is undeclared. Lenient on purpose: a false "undeclared"
 *  sends the fix pass chasing nothing. */
function declaredIn(source: string, name: string): boolean {
  const re = new RegExp(`(^|[^\\w$<\\/])${name}\\b`, 'g');
  for (const m of source.matchAll(re)) {
    // Skip the tag forms: `<Name` and `</Name`
    const i = m.index! + m[1].length;
    const before = source.slice(Math.max(0, i - 2), i);
    if (before.endsWith('<') || before.endsWith('</')) continue;
    return true;
  }
  return false;
}

/** The banner text for the preview: the issues as one error the fix pass
 *  can act on, or null when there are none. */
export function formatImportIssues(issues: string[]): string | null {
  if (issues.length === 0) return null;
  return [
    'The build compiled, but these imports will fail in the browser (a blank page or a missing component):',
    ...issues.slice(0, 8),
    ...(issues.length > 8 ? [`(${issues.length - 8} more)`] : []),
  ].join('\n');
}

/** Bundler-style messages for the import mistakes in `files`. Empty when clean. */
export function checkImports(files: Record<string, string>, opts: ImportCheckOptions = {}): string[] {
  // The env module is generated at bundle time (preview, publish, bench), so
  // `@/env` / `./env` always resolves even though no project file holds it
  const generated: Record<string, string> = { '/src/env.ts': 'export const env = {} as const;', '/env.js': 'export const env = {};' };
  const all: Record<string, string> = { ...generated, ...(opts.kitFiles ?? {}), ...files };
  const issues: string[] = [];
  issues.push(...checkRouters(files));
  issues.push(...checkFontUtilities(files));
  for (const [path, source] of Object.entries(files)) {
    if (!CODE_RE.test(path)) continue;
    // A CommonJS require in an ES module: the bundle carries no require,
    // so the page throws "Dynamic require of ... is not supported" on load
    // (gemma, Nov 3). Named: `const X = require('y')`, `require('y').z`
    const req = source.match(/(?:^|[^\w.])require\(\s*['"]([^'"]+)['"]\s*\)/m);
    if (req) issues.push(`vfs:${path}: Dynamic require of "${req[1]}" is not supported (this is an ES module; use import)`);
    // A kit `icon` prop takes an element; the bare component renders an
    // object as a child and React throws #31 on load (gemma, Nov 3)
    for (const m of source.matchAll(/<(?:AppBar|AppBarTitle|BottomNav|BottomNavItem|EmptyState)\b[^>]*?\bicon=\{\s*([A-Z][A-Za-z0-9]*)\s*\}/g)) {
      issues.push(`vfs:${path}: icon={${m[1]}} passes a component where the kit expects an element; write icon={<${m[1]} />}`);
    }
    const stmts = parseImports(source);
    for (const st of stmts) {
      // BrowserRouter reads the page's real path, which is a blob or file
      // URL in the preview and an arbitrary path on a static host, so the
      // app opens on "Page not found". The rule says HashRouter; a model
      // that writes `BrowserRouter as HashRouter` has followed its letter
      // only (gpt-oss, Nov 3)
      if (st.spec === 'react-router-dom' && st.named.includes('BrowserRouter')) {
        issues.push(`vfs:${path}: BrowserRouter from 'react-router-dom' opens on "Page not found" in the preview and on static hosts; use HashRouter`);
      }
      if (st.spec === 'lucide-react') {
        for (const n of st.named) {
          // Same wording the browser uses at module link time, so the
          // production fix prompt's bad-icon clause (FixBanner) recognizes it
          if (!isLucideIconName(n)) issues.push(`vfs:${path}: The requested module 'lucide-react' does not provide an export named '${n}'`);
        }
      }
      if (st.defaultName && NAMED_ONLY_PACKAGES.has(st.spec)) {
        issues.push(`vfs:${path}: No matching export in "${st.spec}" for import "default" (it exports names only: import { ... } from '${st.spec}')`);
      }
      const resolved = resolveLocal(path, st.spec, all);
      if (resolved === undefined) continue;
      if (resolved === null) {
        issues.push(`vfs:${path}: Could not find "${st.spec}" in the project (imported from ${path})`);
        continue;
      }
      const target = all[resolved];
      if (!CODE_RE.test(resolved)) continue;
      if (st.defaultName && !hasDefaultExport(target)) {
        issues.push(`vfs:${path}: No matching export in "vfs:${resolved}" for import "default" (it exports names only)`);
      }
      for (const n of st.named) {
        if (!hasNamedExport(target, n)) issues.push(`vfs:${path}: No matching export in "vfs:${resolved}" for import "${n}"`);
      }
    }
    // Only a VALUE use of React needs React in scope (React.useState,
    // React.forwardRef, <React.StrictMode>). Type uses (React.FormEvent,
    // React.ReactNode, React.HTMLAttributes) are erased when the file is
    // compiled, so flagging them sent builds that render fine through a
    // fix pass (Nov 5: the most common trigger on the board was this)
    if (CODE_RE.test(path) && REACT_VALUE_USE_RE.test(source)) {
      const importsReact = /import\s+(?:React\b|\*\s+as\s+React\b|React\s*,)/.test(source)
        || /import\s+type\s+React\b/.test(source);
      if (!importsReact) issues.push(`vfs:${path}: ReferenceError: React is not defined (uses React.* with no \`import React from 'react'\` or \`import * as React from 'react'\`)`);
    }
    if (JSX_RE.test(path)) {
      const seen = new Set<string>();
      // `<Name` preceded by an identifier character, `)` or `]` is a type
      // argument (forwardRef<HTMLDivElement>, useState<Item[]>), not a tag.
      for (const m of source.matchAll(/(^|[^\w$)\]])<([A-Z][A-Za-z0-9_]*)(?=[\s/>])/g)) {
        const name = m[2];
        if (seen.has(name)) continue;
        seen.add(name);
        if (!declaredIn(source, name)) {
          issues.push(`vfs:${path}: <${name}> is used but never imported or declared in this file`);
        }
      }
    }
  }
  return issues;
}

/** Local names a file gives the react-router-dom routers (`HashRouter as Router`) */
function routerTagNames(source: string): string[] {
  const names = new Set<string>();
  for (const st of parseImports(source)) {
    if (st.spec !== 'react-router-dom') continue;
    const braces = source.match(new RegExp(`import\\s+\\{([^}]*)\\}\\s+from\\s+['"]react-router-dom['"]`));
    for (const part of (braces?.[1] ?? '').split(',')) {
      const [orig, alias] = part.trim().split(/\s+as\s+/).map(x => x.trim());
      if (/^(Hash|Browser|Memory)?Router$/.test(orig)) names.add(alias || orig);
    }
  }
  return [...names];
}

/**
 * Two routers in one app: a `<Router>` in main.tsx wrapping an `<HashRouter>`
 * in App.tsx throws inside react-router at load, and the fix pass that swaps
 * a BrowserRouter for a HashRouter can leave exactly that (gpt-oss, Nov 3).
 * One router, in one file, is the shape every template uses.
 */
function checkRouters(files: Record<string, string>): string[] {
  const where: string[] = [];
  for (const [path, source] of Object.entries(files)) {
    if (!CODE_RE.test(path)) continue;
    for (const name of routerTagNames(source)) {
      if (new RegExp(`<${name}(\\s|>)`).test(source)) where.push(path);
    }
  }
  if (where.length < 2) return [];
  return [`vfs:${where[1]}: a router is rendered in ${where.length} files (${where.join(', ')}); render one HashRouter only, in one of them`];
}

/** Tailwind's own font-* utilities; anything else needs a `--font-<name>` token in `@theme` */
const BUILTIN_FONT_UTILITIES = new Set([
  'sans', 'serif', 'mono', 'thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black',
  'stretch-normal', 'stretch-condensed', 'stretch-expanded',
]);

/**
 * A `font-<name>` utility that neither Tailwind nor the app's `@theme`
 * defines: in a className it does nothing, but inside `@apply` Tailwind v4
 * throws "Cannot apply unknown utility class" and the whole stylesheet is
 * dropped, so the page opens unstyled or blank (gpt-oss, Nov 3: `font-inter`).
 */
function checkFontUtilities(files: Record<string, string>): string[] {
  const declared = new Set<string>();
  for (const [path, source] of Object.entries(files)) {
    if (!/\.css$/.test(path)) continue;
    for (const m of source.matchAll(/--font-([a-z][a-z0-9-]*)\s*:/g)) declared.add(m[1]);
  }
  const issues: string[] = [];
  for (const [path, source] of Object.entries(files)) {
    if (!/\.css$/.test(path)) continue;
    for (const line of source.split('\n')) {
      if (!/@apply\b/.test(line)) continue;
      for (const m of line.matchAll(/\bfont-([a-z][a-z0-9-]*)/g)) {
        const name = m[1];
        if (BUILTIN_FONT_UTILITIES.has(name) || declared.has(name) || /^stretch-/.test(name)) continue;
        issues.push(`vfs:${path}: Cannot apply unknown utility class \`font-${name}\` (declare \`--font-${name}\` under @theme or use font-sans)`);
      }
    }
  }
  return issues;
}
