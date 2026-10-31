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
 *
 * Pure: files in, messages out. No bundling, no network.
 */

import { isLucideIconName } from '@/preview/lucide-icons';

const CODE_RE = /\.(tsx?|jsx?)$/;
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

/** Bundler-style messages for the import mistakes in `files`. Empty when clean. */
export function checkImports(files: Record<string, string>, opts: ImportCheckOptions = {}): string[] {
  const all: Record<string, string> = { ...(opts.kitFiles ?? {}), ...files };
  const issues: string[] = [];
  for (const [path, source] of Object.entries(files)) {
    if (!CODE_RE.test(path)) continue;
    const stmts = parseImports(source);
    for (const st of stmts) {
      if (st.spec === 'lucide-react') {
        for (const n of st.named) {
          if (!isLucideIconName(n)) issues.push(`vfs:${path}: No matching export in "lucide-react" for import "${n}" (not a lucide icon name; pick a real one)`);
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
