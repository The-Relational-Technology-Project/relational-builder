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
