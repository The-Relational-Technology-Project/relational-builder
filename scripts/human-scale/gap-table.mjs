#!/usr/bin/env node
/**
 * The Gemma to Opus gap table (NEXT, "Focus from Josh, Nov 9"), from run.json
 * files. Pass run directory prefixes for each column:
 *
 *   node scripts/human-scale/gap-table.mjs \
 *     --col "Opus 5.5=2026-11-06T11-45" --col "Gemma, Nov 9=2026-11-09T11-52"
 *
 * Each --col is "label=prefix[,prefix...]"; every trial in matching runs
 * counts. Prints a markdown table: working builds, first-try, lint per 100
 * lines, type errors, desktop classes, first-screen text, output tokens and
 * build time (medians where it says so).
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = 'bench/results';
const cols = [];
process.argv.forEach((a, i) => {
  if (a !== '--col') return;
  const [label, prefixes] = process.argv[i + 1].split('=');
  cols.push({ label, prefixes: prefixes.split(',') });
});
const med = xs => {
  const v = xs.filter(x => typeof x === 'number' && !Number.isNaN(x)).sort((a, b) => a - b);
  return v.length ? v[Math.floor(v.length / 2)] : null;
};
const stats = cols.map(c => {
  const trials = [];
  for (const d of readdirSync(root)) {
    if (!c.prefixes.some(p => d.startsWith(p))) continue;
    const f = path.join(root, d, 'run.json');
    if (!existsSync(f)) continue;
    trials.push(...JSON.parse(readFileSync(f, 'utf8')).trials);
  }
  const clean = t => !!(t.bundle?.ok && t.runtime?.rendered && !(t.runtime.errors || []).length);
  return {
    n: trials.length,
    clean: trials.filter(clean).length,
    firstTry: trials.filter(t => t.bundle?.ok && !t.fixRound?.attempted).length,
    lint: med(trials.map(t => t.quality?.lintPer100Lines)),
    tsc: med(trials.map(t => t.quality?.tscErrors)),
    md: med(trials.map(t => t.quality?.design?.mdClasses)),
    fold: med(trials.filter(clean).map(t => t.runtime?.aboveFoldChars)),
    out: med(trials.map(t => t.estTokens?.output)),
    lat: med(trials.map(t => Math.round(t.latencyMs / 1000))),
  };
});
const row = (name, f) => `| ${name} | ${stats.map(f).join(' | ')} |`;
const v = x => (x == null ? 'n/a' : String(x));
console.log([
  `| | ${cols.map(c => c.label).join(' | ')} |`,
  `|---|${cols.map(() => '---|').join('')}`,
  row('Working builds', s => `${s.clean} of ${s.n}`),
  row('Working on the first try', s => `${s.firstTry} of ${s.n}`),
  row('Lint findings per 100 lines (median)', s => v(s.lint)),
  row('Type errors (median)', s => v(s.tsc)),
  row('Desktop (`md:`) classes (median)', s => v(s.md)),
  row('First-screen text, working builds (median chars)', s => v(s.fold)),
  row('Output per build (median tokens, estimated)', s => v(s.out)),
  row('Build time (median)', s => (s.lat == null ? 'n/a' : `${s.lat}s`)),
].join('\n'));
