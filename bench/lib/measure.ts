/**
 * Measure a finished run's code quality from its artifacts: file stats
 * (quality.ts) plus eslint with the app's own config over the files each
 * model wrote. Results land on each trial as `quality` in run.json, so the
 * report and the board can show them, and so they survive the gitignored
 * artifacts. Also usable after the fact: `npm run bench -- measure <runDir>`.
 */

import { readdir, readFile, access } from 'node:fs/promises';
import path from 'node:path';
import type { TrialResult } from '../types';
import { fileStats, classifyFailure, tokensPerSecond, lintPer100 } from './quality';
import { checkImports } from './import-check';
import { KIT_FILES } from '@/kit';

export type Quality = NonNullable<TrialResult['quality']>;

async function readTree(dir: string, base = dir): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  let entries: import('node:fs').Dirent[] = [];
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) Object.assign(out, await readTree(p, base));
    else if (/\.(tsx?|jsx?|css|json|html|md)$/.test(e.name)) {
      out['/' + path.relative(base, p).split(path.sep).join('/')] = await readFile(p, 'utf8');
    }
  }
  return out;
}

async function lintDir(dir: string): Promise<{ errors: number; warnings: number } | null> {
  try {
    const { ESLint } = await import('eslint');
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: path.join(root, 'eslint.config.js'),
      errorOnUnmatchedPattern: false,
    });
    const results = await eslint.lintFiles([path.join(dir, '**/*.{ts,tsx,js,jsx}')]);
    let errors = 0;
    let warnings = 0;
    for (const r of results) {
      errors += r.errorCount;
      warnings += r.warningCount;
    }
    return { errors, warnings };
  } catch (err) {
    console.warn(`  lint skipped: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Compute `quality` for every trial with artifacts; returns how many were measured. */
export async function measureRun(runDir: string, trials: TrialResult[]): Promise<number> {
  let n = 0;
  for (const t of trials) {
    if (!t.artifactDir) continue;
    const filesDir = path.join(runDir, t.artifactDir, 'files');
    try {
      await access(filesDir);
    } catch {
      continue;
    }
    const files = await readTree(filesDir);
    if (Object.keys(files).length === 0) continue;
    const stats = fileStats(files);
    // Recompute with the current check, so a fixed false positive clears
    // from older runs too (the fix pass's own record stays as it was)
    t.importIssues = checkImports(files, { kitFiles: KIT_FILES });
    const lint = await lintDir(filesDir);
    const firstFailure = t.fixRound?.triggerErrors?.[0] ?? (t.bundle && !t.bundle.ok ? t.bundle.errors[0] : null);
    t.quality = {
      ...stats,
      lintErrors: lint?.errors ?? null,
      lintWarnings: lint?.warnings ?? null,
      lintPer100Lines: lint ? lintPer100(lint, stats.codeLines) : null,
      tokensPerSecond: tokensPerSecond(t.outputChars ?? 0, t.latencyMs - (t.plan?.latencyMs ?? 0)),
      fixLatencyMs: t.fixRound?.latencyMs ?? null,
      failKind: classifyFailure(firstFailure),
    };
    n++;
    console.log(
      `  📐 ${t.taskId} · ${t.alias} t${t.trial}: ${stats.codeFiles} code files, largest ${stats.largestFileLines} lines, ` +
        `lint ${lint ? `${lint.errors}e/${lint.warnings}w` : 'n/a'}, any ${stats.anyCount}, kit ${stats.kitImportingFiles}/${stats.codeFiles}` +
        (stats.invalidLucide.length ? `, bad icons: ${stats.invalidLucide.join(', ')}` : ''),
    );
  }
  return n;
}
