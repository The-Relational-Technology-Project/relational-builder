/**
 * Add the import a file forgot, when there is only one right answer.
 *
 * "<Calendar> is used but never imported" was the most common reason a
 * Gemma build needed a fix pass after the Nov 9 repairs (4 of 13). When the
 * name is a kit component or a real lucide icon, the import line is not a
 * judgment call: the kit file that exports it, or `lucide-react`. Adding it
 * here is free, where a fix pass costs a model call and sometimes misses.
 * Names that are neither are left for the fix pass, which can decide
 * whether to write the component.
 */
import { checkImports } from './import-check';
import { kitExports } from './fix-hints';
import { isLucideIconName } from '@/preview/lucide-icons';

const UNDECLARED = /<(\w+)> is used but never imported or declared in this file/;

function aliasOf(kitPath: string): string {
  return '@/' + kitPath.replace(/^\/src\//, '').replace(/\.tsx?$/, '');
}

export function addMissingImports(
  path: string,
  source: string,
  kitFiles: Record<string, string>,
): { content: string; added: string[] } {
  const names = new Set<string>();
  let needsReact = false;
  for (const issue of checkImports({ [path]: source }, { kitFiles })) {
    const m = issue.match(UNDECLARED);
    if (m) names.add(m[1]);
    if (issue.includes('ReferenceError: React is not defined')) needsReact = true;
  }
  // React.* used as a value with no React import: the namespace import is
  // always safe next to any named imports from 'react'
  if (needsReact) {
    const inner = addMissingImports(path, `import * as React from 'react';\n${source}`, kitFiles);
    return { content: inner.content, added: ['React', ...inner.added] };
  }
  if (names.size === 0) return { content: source, added: [] };

  const exportsByFile = kitExports(kitFiles);
  const kitLines = new Map<string, string[]>(); // alias -> names
  const icons: string[] = [];
  for (const name of names) {
    const kitPath = Object.entries(exportsByFile).find(([, ex]) => ex.includes(name))?.[0];
    if (kitPath) {
      const a = aliasOf(kitPath);
      kitLines.set(a, [...(kitLines.get(a) ?? []), name]);
    } else if (isLucideIconName(name)) {
      icons.push(name);
    }
  }
  if (kitLines.size === 0 && icons.length === 0) return { content: source, added: [] };

  let content = source;
  const added: string[] = [];
  // Icons join an existing lucide import when there is one
  if (icons.length) {
    const lucide = content.match(/^(\s*import\s*\{)([^}]*)(\}\s*from\s*['"]lucide-react['"];?)/m);
    if (lucide) {
      const have = lucide[2].split(',').map(s => s.trim()).filter(Boolean);
      content = content.replace(lucide[0], `${lucide[1]} ${[...have, ...icons].join(', ')} ${lucide[3]}`);
    } else {
      content = `import { ${icons.join(', ')} } from 'lucide-react';\n${content}`;
    }
    added.push(...icons);
  }
  for (const [alias, ns] of kitLines) {
    content = `import { ${ns.join(', ')} } from '${alias}';\n${content}`;
    added.push(...ns);
  }
  return { content, added };
}

/**
 * A kit import whose name the kit file doesn't export, when the right name
 * is plain to see: the same name in another case (`{ textarea }` from
 * textarea.tsx is `Textarea`), or the name exported by a different kit file
 * (`Textarea` imported from input.tsx). Bench, Nov 10 to 11: 4 of Gemma's
 * fix-pass triggers. Lines with any name that can't be placed are left
 * for the fix pass.
 */
export function repairKitImports(source: string, kitFiles: Record<string, string>): { content: string; repaired: string[] } {
  const exportsByFile = kitExports(kitFiles);
  const byAlias = new Map(Object.keys(exportsByFile).map(p => [aliasOf(p), p]));
  const repaired: string[] = [];
  const content = source.replace(
    /^import\s*\{([^}]*)\}\s*from\s*['"](@\/components\/ui\/[\w-]+)['"];?[ \t]*$/gm,
    (line, names: string, spec: string) => {
      const file = byAlias.get(spec);
      if (!file) return line;
      const own = exportsByFile[file];
      const stay: string[] = [];
      const moved = new Map<string, string[]>();
      for (const raw of names.split(',').map(s => s.trim()).filter(Boolean)) {
        const [name, local] = raw.split(/\s+as\s+/).map(s => s.trim());
        if (own.includes(name)) { stay.push(raw); continue; }
        const sameFileCase = own.find(n => n.toLowerCase() === name.toLowerCase());
        if (sameFileCase) {
          // `{ textarea }` used as <textarea> is the HTML element and the
          // import was simply wrong: bring the kit name in as itself
          stay.push(local ? `${sameFileCase} as ${local}` : sameFileCase);
          repaired.push(name);
          continue;
        }
        const elsewhere = Object.entries(exportsByFile).find(([, ex]) => ex.includes(name))?.[0];
        if (!elsewhere) return line; // not plain: leave the whole line for the fix pass
        const a = aliasOf(elsewhere);
        moved.set(a, [...(moved.get(a) ?? []), raw]);
        repaired.push(name);
      }
      if (moved.size === 0 && repaired.length === 0) return line;
      const out = stay.length ? [`import { ${stay.join(', ')} } from '${spec}';`] : [];
      for (const [a, ns] of moved) out.push(`import { ${ns.join(', ')} } from '${a}';`);
      return out.join('\n');
    },
  );
  return { content, repaired };
}
