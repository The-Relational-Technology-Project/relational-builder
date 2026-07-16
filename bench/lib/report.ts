import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HumanScores, RunReport, TrialResult } from '../types';

/**
 * run.json (+ review/scores.json when the human has scored) → report.md.
 * Also invoked standalone: `npm run bench -- report <runDir>`.
 */

const median = (nums: number[]): number | null => {
  const xs = nums.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

interface Aggregate {
  alias: string;
  trials: TrialResult[];
  ok: TrialResult[];
}

function aggregate(trials: TrialResult[]): Aggregate[] {
  const byAlias = new Map<string, TrialResult[]>();
  for (const t of trials) byAlias.set(t.alias, [...(byAlias.get(t.alias) ?? []), t]);
  return [...byAlias.entries()].map(([alias, ts]) => ({
    alias,
    trials: ts,
    ok: ts.filter(t => !t.error),
  }));
}

export async function generateReport(runDirArg: string | undefined): Promise<number> {
  if (!runDirArg) {
    console.error('Usage: npm run bench -- report <runDir>');
    return 1;
  }
  const runDir = path.resolve(runDirArg);
  const run: RunReport = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));

  let human: HumanScores | null = null;
  const scoresPath = path.join(runDir, 'review', 'scores.json');
  try {
    await access(scoresPath);
    human = JSON.parse(await readFile(scoresPath, 'utf8'));
  } catch {
    /* not scored yet */
  }

  const aggs = aggregate(run.trials);
  const rankOf = (alias: string): string => {
    const i = human?.ranking?.indexOf(alias) ?? -1;
    return i >= 0 ? `#${i + 1}` : '—';
  };
  const hs = (alias: string, dim: 'designQuality' | 'rtpFit' | 'completeness'): string => {
    const v = human?.scores?.[alias]?.[dim];
    return v != null ? String(v) : '—';
  };

  const fmtSecs = (ms: number | null): string => (ms == null ? '—' : `${Math.round(ms / 1000)}s`);

  const rows = aggs.map(a => {
    const ok = a.ok;
    const bundleOk = ok.filter(t => t.bundle?.ok).length;
    const checksPass = median(ok.map(t => t.checks.filter(c => c.pass).length));
    const checksTotal = ok[0]?.checks.length ?? 0;
    const errored = a.trials.length - ok.length;
    return (
      `| ${a.alias} ` +
      `| ${ok.length === 0 ? '✗ all errored' : `${bundleOk}/${ok.length} ✓`}` +
      `| ${median(ok.map(t => t.extraction.writes)) ?? '—'} ` +
      `| ${median(ok.map(t => t.extraction.failedEditBlocks)) ?? '—'} ` +
      `| ${ok.some(t => t.truncatedFinal) ? 'yes' : 'no'} ` +
      `| ${checksPass ?? '—'}/${checksTotal} ` +
      `| ${median(ok.map(t => t.securityFindings)) ?? '—'} ` +
      `| ${fmtSecs(median(ok.map(t => t.ttftMs ?? NaN)))} ` +
      `| ${fmtSecs(median(ok.map(t => t.latencyMs)))} ` +
      `| ${median(ok.map(t => t.estCostUsd ?? NaN))?.toFixed(2) ?? '—'} ` +
      `| ${hs(a.alias, 'designQuality')} | ${hs(a.alias, 'rtpFit')} | ${hs(a.alias, 'completeness')} ` +
      `| ${rankOf(a.alias)} ` +
      `|${errored > 0 ? ` ${errored} errored` : ''}`
    );
  });

  const shots = aggs
    .flatMap(a => a.trials)
    .map(t => {
      const rel = `shots/${t.alias}-t${t.trial}.png`;
      return { t, rel, abs: path.join(runDir, rel) };
    });
  const shotLines: string[] = [];
  for (const s of shots) {
    try {
      await access(s.abs);
      shotLines.push(`### ${s.t.alias} (trial ${s.t.trial})\n\n![${s.t.alias}](${s.rel})`);
    } catch {
      /* no screenshot */
    }
  }

  const errors = run.trials
    .filter(t => t.error)
    .map(t => `- **${t.alias}** t${t.trial}: ${t.error}`);

  const md = `# Model bench — ${run.runId}

- **Task:** mutual-aid-board (task ${run.taskVersion}, harness ${run.harnessVersion}, commit \`${run.gitCommit}\`)
- **Date:** ${run.createdAt}
- **Trials per model:** ${run.config.trials}
- **Human review:** ${human ? `scored by ${human.reviewer}` : '_not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report_'}

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials; latency = full generation wall time.

| Model | Bundle | Files | Failed edits | Truncated | Checks | Sec flags | TTFT | Latency | ~$ | Design | RTP fit | Complete | Rank | |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}

## Which model for what

_Maintainer's call, informed by the table above — the report feeds the decision, it doesn't make it._

- **Community first-build default:** _fill in_
- **Community edit model:** _n/a for this task version (build-only) — add an edit task before deciding here_
- **Free/open-tier candidate:** _fill in_
${errors.length ? `\n## Errors\n\n${errors.join('\n')}\n` : ''}
${shotLines.length ? `\n## Previews\n\n${shotLines.join('\n\n')}\n` : ''}`;

  await writeFile(path.join(runDir, 'report.md'), md, 'utf8');
  console.log(`Report written: ${path.join(runDir, 'report.md')}`);
  return 0;
}
