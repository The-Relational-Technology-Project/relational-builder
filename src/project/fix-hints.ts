/**
 * Hints for the automatic fix pass, derived from the error text and what we
 * know about the kit. Small open models kept guessing at kit names
 * (`SelectContent`, `AvatarFallback`) and re-outputting files on faith; the
 * bench showed the one fix pass clears those far more often when the prompt
 * says exactly what exists and exactly which line to add (Nov 2, 2026).
 *
 * Pure: error text and kit sources in, prompt lines out. Used by the
 * preview's FixBanner (human-scale flag) and the bench's fix pass
 * (--import-guard).
 */

import { isLucideIconName } from '@/preview/lucide-icons';

/** Exported names per kit file, parsed from the kit sources. */
export function kitExports(kitFiles: Record<string, string>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [path, src] of Object.entries(kitFiles)) {
    const names = new Set<string>();
    for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (name && name !== 'default') names.add(name);
      }
    }
    out[path] = [...names].sort();
  }
  return out;
}

/** Which kit file exports a component name, if any (first match). */
function kitFileExporting(name: string, exports: Record<string, string[]>): string | null {
  for (const [path, names] of Object.entries(exports)) if (names.includes(name)) return path;
  return null;
}

const aliasOf = (path: string) => path.replace(/^\/src\//, '@/').replace(/\.tsx?$/, '');

/**
 * Prompt lines to append after the error. Empty when the error text names
 * nothing the hints know about.
 */
export function fixHints(errorText: string, kitFiles: Record<string, string>): string[] {
  const hints: string[] = [];
  const exports = kitExports(kitFiles);
  const seen = new Set<string>();

  // A name imported from a kit file that the kit file does not export
  for (const m of errorText.matchAll(/No matching export in "vfs:(\/src\/components\/ui\/[\w-]+\.tsx)" for import "(\w+)"/g)) {
    const [, path, name] = m;
    const key = `kit:${path}:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const names = exports[path];
    if (!names) continue;
    const alias = aliasOf(path);
    const isSelect = /\/select\.tsx$/.test(path);
    const isAvatar = /\/avatar\.tsx$/.test(path);
    hints.push(
      name === 'default'
        ? `\`${alias}\` has no default export. It exports exactly: ${names.join(', ')}. Import by name: \`import { ${names[0]} } from '${alias}'\`.`
        : `\`${name}\` does not exist in \`${alias}\`, which exports exactly: ${names.join(', ')}.` +
          (isSelect ? ` The kit's Select is a styled native <select>: use \`<Select value onChange>\` with plain \`<option>\` children; there is no SelectTrigger, SelectContent, SelectItem or SelectValue.` : '') +
          (isAvatar ? ` Avatar takes \`name\` (and optional \`src\`) and draws its own initials; there is no AvatarImage or AvatarFallback.` : '') +
          ` Do not create your own ${alias.split('/').pop()} file; change the import and its uses.`,
    );
  }

  // A component used in JSX with no import or declaration
  for (const m of errorText.matchAll(/<(\w+)> is used but never imported or declared/g)) {
    const name = m[1];
    const key = `undeclared:${name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const kitPath = kitFileExporting(name, exports);
    if (isLucideIconName(name)) {
      hints.push(`\`${name}\` is a lucide icon: add \`import { ${name} } from 'lucide-react';\` to that file. Change nothing else for this one.`);
    } else if (kitPath) {
      hints.push(`\`${name}\` is a kit component: add \`import { ${name} } from '${aliasOf(kitPath)}';\` to that file. Change nothing else for this one.`);
    } else {
      hints.push(`\`${name}\` is neither imported nor defined in that file. Either import it from the file that defines it, or define it there. If it does not exist anywhere yet, write it.`);
    }
  }

  // React.* without React in scope
  if (/React is not defined/.test(errorText)) {
    hints.push("That file uses `React.` (React.useState, React.FC) without importing React. Add `import React from 'react';` at the top of that file, or switch to named imports (`import { useState } from 'react'`) and drop the `React.` prefix.");
  }

  // A default import from a names-only package
  for (const m of errorText.matchAll(/No matching export in "(zustand|lucide-react)" for import "default"/g)) {
    const pkg = m[1];
    const key = `pkgdefault:${pkg}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hints.push(pkg === 'zustand'
      ? "`zustand` has no default export: write `import { create } from 'zustand';` and `const useStore = create((set) => ({ ... }))`."
      : "`lucide-react` has no default export: import icons by name, `import { Calendar } from 'lucide-react';`.");
  }

  return hints;
}
