import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PlanHumanScores, PlanRunReport } from '../plan-types';
import { weightedComposite } from '../plan-types';

/**
 * run.json (+ review/scores.json once the human has scored) → report.md for
 * a plan bench run. Also standalone: `npm run bench -- plan report <runDir>`.
 */

const median = (nums: number[]): number | null => {
  const xs = nums.filter(n => Number.isFinite(n)).sort((a, b) => a - b);
  if (xs.length === 0) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
};

const fmtSecs = (ms: number | null): string => (ms == null ? '—' : `${Math.round(ms / 1000)}s`);
const fmt1 = (n: number | null): string => (n == null ? '—' : n.toFixed(1));

function mechanicalSection(run: PlanRunReport): string {
  return run.scenarios
    .map(sc => {
      const scTrials = run.trials.filter(t => t.scenarioId === sc.id);
      const surfaced = scTrials[0]?.retrieval.surfaced ?? [];
      const query = scTrials[0]?.retrieval.query;
      const aliases = [...new Set(scTrials.map(t => t.alias))];
      const rows = aliases.map(alias => {
        const ts = scTrials.filter(t => t.alias === alias);
        const ok = ts.filter(t => !t.error);
        if (ok.length === 0) return `| ${alias} | ✗ all errored | | | | | | |`;
        const checksTotal = ok[0].checks.length;
        const judged = ok.filter(t => t.judge);
        const cost = median(ok.map(t => (t.estCostUsd ?? 0) + (t.judge?.estCostUsd ?? 0)));
        return (
          `| ${alias} ` +
          `| ${median(ok.map(t => t.checks.filter(c => c.pass).length))}/${checksTotal} ` +
          `| ${median(ok.map(t => t.mentionedTitles.length))}/${surfaced.length} ` +
          `| ${judged.length > 0 ? median(judged.map(t => t.judge!.fabricated.length)) : '—'} ` +
          `| ${median(ok.map(t => t.words))} ` +
          `| ${fmtSecs(median(ok.map(t => t.ttftMs ?? NaN)))} ` +
          `| ${fmtSecs(median(ok.map(t => t.latencyMs)))} ` +
          `| ${cost == null ? '—' : `$${cost.toFixed(2)}`} ` +
          `|${ts.length - ok.length > 0 ? ` ${ts.length - ok.length} errored` : ''}`
        );
      });
      return `### Scenario: ${sc.id} (expects **${sc.expect}**)

Retrieval: \`${(query ?? '(sat out)').replace(/\s+/g, ' ').slice(0, 90)}\` → ${surfaced.length} surfaced${surfaced.length > 0 ? ` (${surfaced.map(s => s.slug).join(', ')})` : ''}

| Model | Checks | Commons drawn | Fabricated | Words | TTFT | Time | ~$ | |
|---|---|---|---|---|---|---|---|---|
${rows.join('\n')}`;
    })
    .join('\n\n');
}

function failedChecksSection(run: PlanRunReport): string {
  const lines = run.trials
    .filter(t => !t.error)
    .flatMap(t =>
      t.checks
        .filter(c => !c.pass)
        .map(c => `- **${t.alias}** · ${t.scenarioId} t${t.trial}: ✗ \`${c.id}\`${c.detail ? ` — ${c.detail}` : ''}`),
    );
  return lines.length > 0
    ? `## Failed checks\n\n${lines.join('\n')}`
    : '## Failed checks\n\n_None — every trial passed every mechanical check._';
}

function judgeSection(run: PlanRunReport): string {
  const judged = run.trials.filter(t => t.judge);
  if (judged.length === 0) return '';
  const fabricated = judged.filter(t => (t.judge?.fabricated.length ?? 0) > 0);
  const lines = judged.map(t => {
    const j = t.judge!;
    return (
      `- **${t.alias}** · ${t.scenarioId} t${t.trial}: referenced ${j.referenced.length}` +
      ` (mechanical ${t.mentionedTitles.length})` +
      `${j.fabricated.length > 0 ? ` · **fabricated: ${j.fabricated.join('; ')}**` : ''}` +
      `${j.notes ? ` — ${j.notes}` : ''}`
    );
  });
  return `## Commons-honesty judge (${judged[0].judge!.model})

${fabricated.length > 0 ? `**${fabricated.length} trial(s) fabricated commons citations — read those plans before trusting the rest of their scores.**\n\n` : ''}${lines.join('\n')}`;
}

function humanSection(run: PlanRunReport, human: PlanHumanScores | null): string {
  if (!human) {
    return (
      '## Human review\n\n_Not scored yet — open review/index.html, score each model per scenario ' +
      '(0–10: RT alignment, creativity, overall — overall counts 2×), export, save as ' +
      'review/scores.json, re-run `npm run bench -- plan report <runDir>`._'
    );
  }
  const aliases = [...new Set(run.trials.map(t => t.alias))];
  const perScenario = run.scenarios
    .map(sc => {
      const rows = aliases.map(a => {
        const s = human.scores?.[a]?.[sc.id];
        const comp = weightedComposite(s);
        return `| ${a} | ${s?.rtAlignment ?? '—'} | ${s?.creativity ?? '—'} | ${s?.overall ?? '—'} | ${fmt1(comp)} |${s?.notes ? ` ${s.notes} |` : ' |'}`;
      });
      return `### ${sc.id}

| Model | RT alignment | Creativity | Overall (×2) | Composite | Notes |
|---|---|---|---|---|---|
${rows.join('\n')}`;
    })
    .join('\n\n');

  const leaderboard = aliases
    .map(a => {
      const comps = run.scenarios
        .map(sc => weightedComposite(human.scores?.[a]?.[sc.id]))
        .filter((c): c is number => c != null);
      const mean = comps.length > 0 ? comps.reduce((x, y) => x + y, 0) / comps.length : null;
      return { alias: a, mean, scored: comps.length };
    })
    .sort((x, y) => (y.mean ?? -1) - (x.mean ?? -1))
    .map(
      (r, i) =>
        `| ${r.mean != null ? `#${i + 1}` : '—'} | ${r.alias} | ${fmt1(r.mean)} | ${r.scored}/${run.scenarios.length} |`,
    );

  return `## Human review (scored by ${human.reviewer})

Composite = (RT + Creativity + 2×Overall) / 4, out of 10.

| Rank | Model | Mean composite | Scenarios scored |
|---|---|---|---|
${leaderboard.join('\n')}

${perScenario}`;
}

export async function writePlanReport(
  runDir: string,
  run: PlanRunReport,
  human: PlanHumanScores | null = null,
): Promise<void> {
  const errors = run.trials
    .filter(t => t.error)
    .map(t => `- **${t.alias}** · ${t.scenarioId} t${t.trial}: ${t.error}`);

  const md = `# Plan bench — ${run.runId}

- **Scenarios:** ${run.scenarios.map(s => s.id).join(', ')} (set ${run.scenariosVersion}, harness ${run.planBenchVersion}, commit \`${run.gitCommit}\`)
- **Date:** ${run.createdAt}
- **Models:** ${run.models.map(m => m.alias).join(', ')} · **trials each:** ${run.config.trials} · **judge:** ${run.config.judge ?? 'off'}
- **Pipeline:** live commons retrieval → production plan prompt (\`buildPromptContext\`) → turn context after TURN_BREAK, production's exact message shape. Anonymous builder (no profile), web tools off.
- **Human review:** ${human ? `scored by ${human.reviewer}` : '_pending_'}

> Cost and token figures are **estimates** (chars ÷ 4 × list prices); ~$ includes the judge call.
> Mechanical columns are medians across trials. **Commons drawn** = surfaced entries the reply
> named (production chip matcher) / entries surfaced. Retrieval runs once per scenario per run —
> within-run comparisons share the same surfaced set; the corpus is live, so expect drift across runs.

## Mechanical

${mechanicalSection(run)}

${failedChecksSection(run)}

${judgeSection(run)}

${humanSection(run, human)}

## Which model plans best

_Maintainer's call, informed by the human composite first and the tables above — the report feeds the decision, it doesn't make it. The production default lives in \`COMMUNITY_PLAN_MODEL\` (src/store/community-store.ts)._
${errors.length > 0 ? `\n## Errors\n\n${errors.join('\n')}\n` : ''}`;

  await writeFile(path.join(runDir, 'report.md'), md, 'utf8');
}

export async function generatePlanReport(runDirArg: string | undefined): Promise<number> {
  if (!runDirArg) {
    console.error('Usage: npm run bench -- plan report <runDir>');
    return 1;
  }
  const runDir = path.resolve(runDirArg);
  const run: PlanRunReport = JSON.parse(await readFile(path.join(runDir, 'run.json'), 'utf8'));

  let human: PlanHumanScores | null = null;
  const scoresPath = path.join(runDir, 'review', 'scores.json');
  try {
    await access(scoresPath);
    human = JSON.parse(await readFile(scoresPath, 'utf8'));
  } catch {
    /* not scored yet */
  }

  await writePlanReport(runDir, run, human);
  console.log(`Report written: ${path.join(runDir, 'report.md')}${human ? ` (scores by ${human.reviewer} merged)` : ' (human scores pending)'}`);
  return 0;
}
