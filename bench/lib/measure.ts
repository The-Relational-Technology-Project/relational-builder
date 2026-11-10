/**
 * Measure a finished run's code quality from its artifacts: file stats
 * (quality.ts) plus eslint with the app's own config over the files each
 * model wrote. Results land on each trial as `quality` in run.json, so the
 * report and the board can show them, and so they survive the gitignored
 * artifacts. Also usable after the fact: `npm run bench -- measure <runDir>`.
 */

import { readdir, readFile, access, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileP = promisify(execFile);
import type { TrialResult } from '../types';
import { fileStats, classifyFailure, tokensPerSecond, lintPer100, designProxies } from './quality';
import { checkImports } from '@/project/import-check';
import { KIT_FILES } from '@/kit';

export type Quality = NonNullable<TrialResult['quality']>;

export async function readTree(dir: string, base = dir): Promise<Record<string, string>> {
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

/** The place each comparison prompt names, for the placeNamed proxy */
const PLACE_WORDS: Record<string, string[]> = {
  'hs-community-fridge': ['Judah', 'Outer Sunset', 'laundromat'],
  'hs-listening-wall': ['Frome'],
};

async function lintDir(dir: string): Promise<{ errors: number; warnings: number } | null> {
  try {
    const { ESLint } = await import('eslint');
    const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
    const eslint = new ESLint({
      cwd: root,
      overrideConfigFile: path.join(root, 'eslint.config.js'),
      errorOnUnmatchedPattern: false,
      // The repo's lint skips bench output (model-written apps); this
      // measure exists to lint exactly that, with the app's own rules
      ignore: false,
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

/**
 * Type errors in the files the model wrote. A temp project is laid out
 * beside the artifacts (inside the repo, so react, zustand and lucide-react
 * resolve to their real types), the kit merged underneath, a minimal
 * tsconfig with the `@/` alias, and every package not installed here
 * declared untyped so the count is about the model's code, not our
 * node_modules. Errors inside kit files are not counted. Syntax errors
 * (TS1xxx, a bad token that cascades through the file) are counted apart
 * from type errors, so one broken line does not read as twenty.
 */
async function typecheckDir(filesDir: string, files: Record<string, string>): Promise<{ types: number; syntax: number } | null> {
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');
  const tmp = path.join(path.dirname(filesDir), '.tsc');
  try {
    await rm(tmp, { recursive: true, force: true });
    await mkdir(tmp, { recursive: true });
    for (const [p, content] of Object.entries({ ...KIT_FILES, ...files })) {
      if (!/\.(tsx?|jsx?)$/.test(p)) continue;
      const out = path.join(tmp, p.replace(/^\//, ''));
      await mkdir(path.dirname(out), { recursive: true });
      await writeFile(out, content, 'utf8');
    }
    await writeFile(path.join(tmp, 'src', 'env.ts'), 'export const env: Record<string, string> = {};\n', 'utf8');
    await writeFile(
      path.join(tmp, 'untyped.d.ts'),
      [
        '// Packages a generated app may import that are not installed in this repo',
        '// (react, react-dom, zustand, lucide-react, clsx, tailwind-merge and',
        '// class-variance-authority ARE installed and keep their real types)',
        "declare module 'react-router-dom';",
        "declare module 'date-fns';",
        "declare module 'date-fns/*';",
        "declare module 'react-qr-code';",
        "declare module 'leaflet';",
        "declare module 'react-leaflet';",
        "declare module '*.css';",
        "declare module '*.json';",
        '',
      ].join('\n'),
      'utf8',
    );
    await writeFile(
      path.join(tmp, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            ignoreDeprecations: '6.0',
            target: 'es2022', lib: ['ES2022', 'DOM', 'DOM.Iterable'], module: 'esnext', moduleResolution: 'bundler',
            jsx: 'react-jsx', strict: false, skipLibCheck: true, noEmit: true, allowJs: true, esModuleInterop: true,
            baseUrl: '.', paths: { '@/*': ['./src/*'] }, types: [],
          },
          include: ['src', 'untyped.d.ts'],
        },
        null,
        2,
      ),
      'utf8',
    );
    const tsc = path.join(root, 'node_modules', 'typescript', 'bin', 'tsc');
    let stdout = '';
    try {
      ({ stdout } = await execFileP(process.execPath, [tsc, '--noEmit', '-p', tmp, '--pretty', 'false'], { cwd: tmp, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 }));
    } catch (err) {
      const e = err as { stdout?: string; killed?: boolean };
      if (e.killed || typeof e.stdout !== 'string') return null;
      stdout = e.stdout;
    }
    const kitPaths = new Set(Object.keys(KIT_FILES).map(p => p.replace(/^\//, '')));
    let types = 0;
    let syntax = 0;
    const codes: Record<string, number> = {};
    for (const line of stdout.split('\n')) {
      const m = /^(.+?)\(\d+,\d+\): error TS(\d+)/.exec(line);
      if (!m) continue;
      const file = m[1].split(path.sep).join('/');
      if (!file.startsWith('src/')) continue; // config or harness noise, not the model's code
      if (kitPaths.has(file) && !(('/' + file) in files)) continue;
      if (Number(m[2]) < 2000) syntax++;
      else {
        types++;
        codes[m[2]] = (codes[m[2]] ?? 0) + 1;
        if (process.env.BENCH_TSC_DUMP) console.log(`    tsc: ${line.slice(line.indexOf('src/'))}`);
      }
    }
    return { types, syntax, codes };
  } catch {
    return null;
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
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
    const tsc = await typecheckDir(filesDir, files);
    // Type errors are only meaningful on a build that compiled; on one that
    // did not, the bundle error is the finding and the type count is noise
    const tscErrors = tsc && t.bundle?.ok ? tsc.types : null;
    const tscSyntaxErrors = tsc ? tsc.syntax : null;
    const firstFailure = t.fixRound?.triggerErrors?.[0] ?? (t.bundle && !t.bundle.ok ? t.bundle.errors[0] : null);
    t.quality = {
      ...stats,
      design: designProxies(files, PLACE_WORDS[t.taskId] ?? []),
      lintErrors: lint?.errors ?? null,
      lintWarnings: lint?.warnings ?? null,
      lintPer100Lines: lint ? lintPer100(lint, stats.codeLines) : null,
      tscErrors,
      tscSyntaxErrors,
      tscCodes: tsc && t.bundle?.ok ? tsc.codes : null,
      tokensPerSecond: tokensPerSecond(t.outputChars ?? 0, t.latencyMs - (t.plan?.latencyMs ?? 0)),
      fixLatencyMs: t.fixRound?.latencyMs ?? null,
      failKind: classifyFailure(firstFailure),
    };
    n++;
    console.log(
      `  📐 ${t.taskId} · ${t.alias} t${t.trial}: ${stats.codeFiles} code files, largest ${stats.largestFileLines} lines, ` +
        `lint ${lint ? `${lint.errors}e/${lint.warnings}w` : 'n/a'}, tsc ${tscErrors ?? 'n/a'}${tscSyntaxErrors ? ` (+${tscSyntaxErrors} syntax)` : ''}, any ${stats.anyCount}, kit ${stats.kitImportingFiles}/${stats.codeFiles}` +
        (stats.invalidLucide.length ? `, bad icons: ${stats.invalidLucide.join(', ')}` : ''),
    );
  }
  return n;
}
