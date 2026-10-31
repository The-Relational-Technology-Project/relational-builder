/**
 * Code-quality and speed measures for a trial, computed from the files it
 * produced (workstream 2, the "code quality" axis Josh asked for). Pure
 * functions here so they can be unit-tested; measure.ts reads artifacts and
 * runs eslint around them.
 *
 * Everything here is mechanical and free: nothing judges "good code", it
 * counts things a reviewer would count. The report shows medians; run.json
 * keeps the raw numbers.
 */

import { invalidLucideImports } from '@/preview/lucide-icons';

export interface FileStats {
  /** All files the model wrote */
  files: number;
  /** .ts/.tsx/.js/.jsx among them */
  codeFiles: number;
  /** Lines across code files */
  codeLines: number;
  largestFile: string | null;
  largestFileLines: number;
  /** `: any`, `as any`, `<any>` occurrences across code files */
  anyCount: number;
  /** Code files importing the RB kit (@/components/ui/*) */
  kitImportingFiles: number;
  /** Files the model wrote under src/components/ui/ (hand-rolled or
   *  overridden kit components) */
  handRolledUiFiles: number;
  /** lucide-react icon names imported that do not exist */
  invalidLucide: string[];
  /** Files that import cdn.tailwindcss.com or @tailwind directives (v3
   *  habits the prompt forbids) */
  tailwindV3Habits: number;
}

const CODE_RE = /\.(tsx?|jsx?)$/;

export function fileStats(files: Record<string, string>): FileStats {
  let codeFiles = 0;
  let codeLines = 0;
  let largestFile: string | null = null;
  let largestFileLines = 0;
  let anyCount = 0;
  let kitImportingFiles = 0;
  let handRolledUiFiles = 0;
  let tailwindV3Habits = 0;
  const invalid = new Set<string>();
  for (const [path, content] of Object.entries(files)) {
    if (/\/src\/components\/ui\/|^src\/components\/ui\//.test(path)) handRolledUiFiles++;
    if (/cdn\.tailwindcss\.com|@tailwind\s+(base|components|utilities)/.test(content)) tailwindV3Habits++;
    if (!CODE_RE.test(path)) continue;
    codeFiles++;
    const lines = content.split('\n').length;
    codeLines += lines;
    if (lines > largestFileLines) {
      largestFileLines = lines;
      largestFile = path;
    }
    anyCount += (content.match(/(?::\s*any\b|\bas\s+any\b|<any>)/g) ?? []).length;
    if (/from\s+['"]@\/components\/ui\//.test(content)) kitImportingFiles++;
    if (/lucide-react/.test(content)) for (const n of invalidLucideImports(content)) invalid.add(n);
  }
  return {
    files: Object.keys(files).length,
    codeFiles,
    codeLines,
    largestFile,
    largestFileLines,
    anyCount,
    kitImportingFiles,
    handRolledUiFiles,
    invalidLucide: [...invalid].sort(),
    tailwindV3Habits,
  };
}

export type FailKind =
  | 'missing-file'
  | 'bad-import'
  | 'unknown-package'
  | 'syntax'
  | 'other';

/** What kind of first-try bundle failure a bundler error describes. */
export function classifyFailure(error: string | null | undefined): FailKind | null {
  if (!error) return null;
  const e = error.toLowerCase();
  if (/could not find ".*" in the project|no such file|cannot find module ["']\.{1,2}\//.test(e)) return 'missing-file';
  if (/does not provide an export|no matching export|is not exported|has no exported member/.test(e)) return 'bad-import';
  if (/could not resolve|failed to resolve|unknown package|not in the import map|esm\.sh.*404/.test(e)) return 'unknown-package';
  if (/expected .* but found|unexpected token|unterminated|syntax error|unexpected end of file/.test(e)) return 'syntax';
  return 'other';
}

/** Output tokens per second over the build, from the chars/4 estimate */
export function tokensPerSecond(outputChars: number, latencyMs: number): number | null {
  if (!latencyMs || latencyMs <= 0) return null;
  return Math.round(((outputChars / 4) / (latencyMs / 1000)) * 10) / 10;
}

export interface LintCounts {
  errors: number;
  warnings: number;
}

/** Lint findings per 100 lines of code, one decimal; null without lines */
export function lintPer100(lint: LintCounts, codeLines: number): number | null {
  if (!codeLines) return null;
  return Math.round(((lint.errors + lint.warnings) / codeLines) * 1000) / 10;
}
