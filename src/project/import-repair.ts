/**
 * Mechanical repair of a stuttered import line, before anything is bundled.
 *
 * Gemma 4 26B, and now and then other small open models, sometimes repeats
 * part of an import clause: `import { Badge } { Avatar } from
 * '@/components/ui/avatar'`, `import { Button } import { Input } from
 * './input'`, `import { Badge } } from '.../badge'`, `import { Badge }
 * coming from '...'`. On the bench (Nov 1 to 8) this was the most common
 * syntax error behind a fix pass, and each one cost a model call to fix a
 * line whose intent is plain: the LAST brace group before `from` is the one
 * that names what the module exports. Repairing it in place is free and
 * cannot make a valid line worse: only lines whose clause is not a valid
 * import clause are touched.
 */

const IMPORT_LINE = /^(\s*import\s+)(.+?)(\s+from\s+(['"])[^'"]+\4\s*;?\s*(?:\/\/.*)?)$/;
const VALID_CLAUSE = /^(?:type\s+)?(?:[A-Za-z_$][\w$]*|\*\s+as\s+[A-Za-z_$][\w$]*|\{[^{}]*\}|[A-Za-z_$][\w$]*\s*,\s*\{[^{}]*\}|[A-Za-z_$][\w$]*\s*,\s*\*\s+as\s+[A-Za-z_$][\w$]*)$/;

/** `@/src/store` means `@/store`: the alias already points at /src
 *  (Gemma, Nov 2026) */
function repairSpecifier(line: string): string {
  return line.replace(/(from\s+['"])@\/src\//, '$1@/');
}

export function repairImportLine(line: string): string {
  line = repairSpecifier(line);
  const m = line.match(IMPORT_LINE);
  if (!m) return line;
  const clause = m[2].trim();
  if (VALID_CLAUSE.test(clause)) return line;
  const groups = clause.match(/\{[^{}]*\}/g);
  if (!groups || groups.length === 0) return line;
  return `${m[1]}${groups[groups.length - 1]}${m[3]}`;
}

/** Repair every stuttered import line in a source file; returns the new
 *  text and how many lines changed */
export function repairImports(source: string): { content: string; repaired: number } {
  let repaired = 0;
  const content = source
    .split('\n')
    .map(line => {
      if (!/^\s*import\s/.test(line)) return line;
      const fixed = repairImportLine(line);
      if (fixed !== line) repaired++;
      return fixed;
    })
    .join('\n');
  return { content, repaired };
}

export const REPAIRABLE_PATH = /\.(tsx?|jsx?|mjs)$/;

const SINGLE_IMPORT = /^(\s*import\s+)(type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^{}]*)\})?(\s+from\s+(['"])[^'"]+\6\s*;?\s*(?:\/\/.*)?)$/;

/**
 * Drop import names a file never uses (Nov 10). Unused imports were 132 of
 * Gemma's 146 lint findings on the bench and a rule line did not move them;
 * removing them is mechanical and safe: a name is kept if it appears
 * anywhere else in the file, `React` is always kept (classic JSX), and
 * side-effect imports (`import './x.css'`) and multi-line imports are left
 * alone. An import with nothing left is removed.
 */
export function removeUnusedImports(source: string): { content: string; removed: number } {
  const lines = source.split('\n');
  let removed = 0;
  const out: string[] = [];
  lines.forEach((line, i) => {
    const m = line.match(SINGLE_IMPORT);
    if (!m || (!m[3] && m[4] === undefined)) {
      out.push(line);
      return;
    }
    const rest = lines.filter((_, j) => j !== i).join('\n');
    const used = (name: string) => name === 'React' || new RegExp(`(^|[^\\w$.])${name.replace(/\$/g, '\\$')}([^\\w$]|$)`).test(rest);
    const def = m[3] && used(m[3]) ? m[3] : null;
    if (m[3] && !def) removed++;
    let named: string[] | null = null;
    if (m[4] !== undefined) {
      const parts = m[4].split(',').map(p => p.trim()).filter(Boolean);
      named = parts.filter(p => {
        const local = p.replace(/^type\s+/, '').split(/\s+as\s+/).pop()!.trim();
        const keep = used(local);
        if (!keep) removed++;
        return keep;
      });
    }
    if (!def && (!named || named.length === 0)) return; // nothing left: drop the line
    const clause = [def, named && named.length ? `{ ${named.join(', ')} }` : null].filter(Boolean).join(', ');
    out.push(`${m[1]}${m[2] ?? ''}${clause}${m[5]}`);
  });
  return { content: out.join('\n'), removed };
}

/**
 * Icon names models invent that lucide doesn't have, mapped to the real
 * icon closest in meaning. Tallied from the bench's fix-pass triggers
 * (Nov 11, 2026): `Fridge` 5 times on the fridge prompt, the rest once.
 */
export const LUCIDE_ALIASES: Record<string, string> = {
  Fridge: 'Refrigerator',
  ThumbUp: 'ThumbsUp',
  ThumbDown: 'ThumbsDown',
  Broom: 'Brush',
  Bread: 'Croissant',
  MilkBottle: 'Milk',
  Update: 'RefreshCw',
  CircleHalf: 'Contrast',
};

/**
 * In a lucide-react import, swap an invented name for its real icon under
 * the invented name (`{ Refrigerator as Fridge }`), so the JSX that uses
 * it keeps working. Names lucide has are never touched.
 */
export function repairLucideImports(source: string): { content: string; repaired: string[] } {
  const repaired: string[] = [];
  const content = source.replace(
    /(import\s*\{)([^}]*)(\}\s*from\s*['"]lucide-react['"])/g,
    (_all, open: string, names: string, close: string) => {
      const parts = names.split(',').map(part => {
        const m = part.match(/^(\s*)([A-Za-z_$][\w$]*)(\s+as\s+([A-Za-z_$][\w$]*))?(\s*)$/);
        if (!m) return part;
        const [, lead, name, asClause, local, trail] = m;
        const real = LUCIDE_ALIASES[name];
        if (!real) return part;
        repaired.push(name);
        return `${lead}${real} as ${asClause ? local : name}${trail}`;
      });
      return `${open}${parts.join(',')}${close}`;
    },
  );
  return { content, repaired };
}
