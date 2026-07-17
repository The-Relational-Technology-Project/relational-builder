import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { HumanScores, RunReport, TrialResult } from '../types';
import { shotName } from './screenshots';

/**
 * run.json (+ review/scores.json when the human has scored) → report.md.
 * Also invoked standalone: `npm run bench -- report <runDir>`.
 * Runs can mix tasks — each task gets its own table; human scores/ranking
 * are per-model overall.
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

const fmtSecs = (ms: number | null): string => (ms == null ? '—' : `${Math.round(ms / 1000)}s`);

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

  const rankOf = (alias: string): string => {
    const i = human?.ranking?.indexOf(alias) ?? -1;
    return i >= 0 ? `#${i + 1}` : '—';
  };
  const hs = (alias: string, dim: 'designQuality' | 'rtpFit' | 'completeness'): string => {
    const v = human?.scores?.[alias]?.[dim];
    return v != null ? String(v) : '—';
  };

  const planFirst = run.config.planFirst ?? false;
  const taskIds = run.tasks?.map(t => t.id) ?? [...new Set(run.trials.map(t => t.taskId))];

  const taskSections = taskIds.map(taskId => {
    const aggs = aggregate(run.trials.filter(t => t.taskId === taskId));
    const version = run.trials.find(t => t.taskId === taskId)?.taskVersion ?? '?';
    const planCols = planFirst ? ' Plan time |' : '';
    const rows = aggs.map(a => {
      const ok = a.ok;
      const bundleOk = ok.filter(t => t.bundle?.ok).length;
      const checksPass = median(ok.map(t => t.checks.filter(c => c.pass).length));
      const checksTotal = ok[0]?.checks.length ?? 0;
      const errored = a.trials.length - ok.length;
      const planCell = planFirst
        ? ` ${fmtSecs(median(ok.map(t => t.plan?.latencyMs ?? NaN)))} |`
        : '';
      const buildLatency = median(ok.map(t => t.latencyMs - (t.plan?.latencyMs ?? 0)));
      return (
        `| ${a.alias} ` +
        `| ${ok.length === 0 ? '✗ all errored' : `${bundleOk}/${ok.length} ✓`} ` +
        `| ${median(ok.map(t => t.extraction.writes)) ?? '—'} ` +
        `| ${median(ok.map(t => t.extraction.failedEditBlocks)) ?? '—'} ` +
        `| ${ok.some(t => t.truncatedFinal) ? 'yes' : 'no'} ` +
        `| ${checksPass ?? '—'}/${checksTotal} ` +
        `| ${median(ok.map(t => t.securityFindings)) ?? '—'} ` +
        `| ${fmtSecs(median(ok.map(t => t.ttftMs ?? NaN)))} ` +
        `|${planCell} ${fmtSecs(buildLatency)} ` +
        `| ${fmtSecs(median(ok.map(t => t.latencyMs)))} ` +
        `| ${median(ok.map(t => t.estCostUsd ?? NaN))?.toFixed(2) ?? '—'} ` +
        `|${errored > 0 ? ` ${errored} errored` : ''}`
      );
    });
    return `### Task: ${taskId} (${version})

| Model | Bundle | Files | Failed edits | Truncated | Checks | Sec flags | TTFT |${planCols} Build time | Total | ~$ | |
|---|---|---|---|---|---|---|---|${planFirst ? '---|' : ''}---|---|---|---|
${rows.join('\n')}`;
  });

  const aliases = [...new Set(run.trials.map(t => t.alias))];
  const humanTable = human
    ? `## Human review

| Model | Design | RTP fit | Complete | Rank |
|---|---|---|---|---|
${aliases
        .map(
          a =>
            `| ${a} | ${hs(a, 'designQuality')} | ${hs(a, 'rtpFit')} | ${hs(a, 'completeness')} | ${rankOf(a)} |`,
        )
        .join('\n')}`
    : '## Human review\n\n_Not scored yet — open review/index.html, score, export, save as review/scores.json, re-run report._';

  const shotLines: string[] = [];
  for (const t of run.trials) {
    const rel = `shots/${shotName(t)}`;
    try {
      await access(path.join(runDir, rel));
      shotLines.push(`### ${t.taskId} — ${t.alias} (trial ${t.trial})\n\n![${t.alias}](${rel})`);
    } catch {
      /* no screenshot */
    }
  }

  const errors = run.trials
    .filter(t => t.error)
    .map(t => `- **${t.alias}** · ${t.taskId} t${t.trial}: ${t.error}`);

  const md = `# Model bench — ${run.runId}

- **Tasks:** ${taskIds.join(', ')} (harness ${run.harnessVersion}, commit \`${run.gitCommit}\`)
- **Date:** ${run.createdAt}
- **Trials per model per task:** ${run.config.trials}${planFirst ? ' · **plan-first flow** (plan-mode reply precedes each build, same model)' : ''}
- **Human review:** ${human ? `scored by ${human.reviewer}` : '_pending_'}

> Cost and token figures are **estimates** (chars ÷ 4 × list prices) — directional, not billing-grade.
> Mechanical columns are medians across trials. Total = plan + build wall time.

${taskSections.join('\n\n')}

${humanTable}

## Which model for what

_Maintainer's call, informed by the tables above — the report feeds the decision, it doesn't make it._
${errors.length ? `\n## Errors\n\n${errors.join('\n')}\n` : ''}
${shotLines.length ? `\n## Previews\n\n${shotLines.join('\n\n')}\n` : ''}`;

  await writeFile(path.join(runDir, 'report.md'), md, 'utf8');
  console.log(`Report written: ${path.join(runDir, 'report.md')}`);
  return 0;
}
