#!/usr/bin/env node
/**
 * The bench board: every model bench run on this repo, over time, in one
 * page a person can read without running anything. Screenshots first,
 * mechanical numbers beside them, scores when someone has given them.
 *
 *   npm run bench:board            → docs/human-scale/BENCH-BOARD.md
 *
 * Sources, all already in the repo:
 *   bench/results/<run>/run.json          every trial's mechanical record
 *   bench/results/<run>/shots/*.png       what each build looked like
 *   bench/results/<run>/review/scores.json  the blinded review's export
 *   docs/human-scale/SCORES.md            hand-written scores (a table anyone
 *                                         can edit on GitHub; see that file)
 * No dependencies, no network. Re-run after any bench run or any scoring.
 */

import { readdir, readFile, access, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const RESULTS = path.join(ROOT, 'bench', 'results');
const OUT = path.join(ROOT, 'docs', 'human-scale', 'BENCH-BOARD.md');
const SCORES_MD = path.join(ROOT, 'docs', 'human-scale', 'SCORES.md');
const REL_RESULTS = '../../bench/results';

/** The one or two prompts models are compared on (Josh, Oct 30, 2026):
 *  one prompt per shape, not twelve, and never the same prompt many times. */
const COMPARE_TASKS = ['hs-community-fridge', 'hs-listening-wall'];

const exists = p => access(p).then(() => true, () => false);
const shotName = t => `${t.taskId}--${t.alias}-t${t.trial}.png`;
const median = xs => {
  const a = xs.filter(x => typeof x === 'number' && Number.isFinite(x)).sort((x, y) => x - y);
  if (!a.length) return null;
  const m = Math.floor(a.length / 2);
  const v = a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  return Math.round(v * 10) / 10;
};
const secs = ms => (ms == null ? '' : `${Math.round(ms / 1000)}s`);
const usd = x => (x == null ? '' : x < 0.005 ? '<$0.01' : `$${x.toFixed(2)}`);
const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : '');
const day = iso => (iso ? String(iso).slice(0, 10) : '');

async function readHandScores() {
  // | run | task | model | design | rtp fit | completeness | notes |
  const out = [];
  if (!(await exists(SCORES_MD))) return out;
  for (const line of (await readFile(SCORES_MD, 'utf8')).split('\n')) {
    if (!line.startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map(c => c.trim());
    if (cells.length < 6 || /^-+$/.test(cells[0]) || /^run$/i.test(cells[0])) continue;
    const [run, task, model, design, rtp, complete, notes = ''] = cells;
    const num = v => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);
    out.push({ run, task, model, designQuality: num(design), rtpFit: num(rtp), completeness: num(complete), notes });
  }
  return out;
}

async function loadRuns() {
  const runs = [];
  for (const name of (await readdir(RESULTS)).sort()) {
    const dir = path.join(RESULTS, name);
    const runJson = path.join(dir, 'run.json');
    if (!(await exists(runJson))) continue;
    let run;
    try { run = JSON.parse(await readFile(runJson, 'utf8')); } catch { continue; }
    if (!Array.isArray(run.trials)) continue;
    let review = null;
    const scoresPath = path.join(dir, 'review', 'scores.json');
    if (await exists(scoresPath)) {
      try { review = JSON.parse(await readFile(scoresPath, 'utf8')); } catch { /* unreadable */ }
    }
    runs.push({ name, dir, run, review });
  }
  return runs;
}

function trialRows(runs, hand) {
  const rows = [];
  for (const { name, dir, run, review } of runs) {
    for (const t of run.trials) {
      const fix = t.fixRound && t.fixRound.attempted ? t.fixRound : null;
      const bundled = !!(t.bundle && t.bundle.ok);
      const rt = t.runtime || null;
      const browser = !bundled || !rt ? '' : !rt.rendered ? ', BLANK in the browser' : rt.errors.length ? `, renders with ${rt.errors.length} error(s)` : ', renders clean';
      const result = (t.error
        ? `failed: ${String(t.error).slice(0, 60)}`
        : bundled && !fix ? 'bundled, first try'
        : bundled && fix ? 'bundled after one auto-fix'
        : 'did not bundle') + browser;
      const firstError = rt && rt.errors.length ? rt.errors[0].replace(/^(pageerror|console): /, '').slice(0, 110) : '';
      const q = t.quality || null;
      const code = q
        ? `${q.codeFiles} files, largest ${q.largestFileLines}, lint ${q.lintPer100Lines ?? 'n/a'}/100, any ${q.anyCount}, kit ${q.kitImportingFiles}/${q.codeFiles}${q.invalidLucide && q.invalidLucide.length ? `, bad icons ${q.invalidLucide.join(' ')}` : ''}`
        : '';
      const checks = Array.isArray(t.checks) ? `${t.checks.filter(c => c.pass).length}/${t.checks.length}` : '';
      const fromReview = review && review.scores && review.scores[t.alias] ? review.scores[t.alias] : {};
      const fromHand = hand.find(h => name.startsWith(h.run) && h.task === t.taskId && h.model === t.alias) || {};
      const score = k => fromHand[k] ?? fromReview[k];
      rows.push({
        runName: name,
        runDir: dir,
        date: day(t.startedAt || run.createdAt),
        taskId: t.taskId ?? run.config?.task ?? 'build',
        taskVersion: t.taskVersion,
        alias: t.alias,
        providerId: t.providerId,
        modelId: t.modelId,
        bundled,
        rendersClean: !!(bundled && rt && rt.rendered && rt.errors.length === 0),
        code,
        lintPer100: q ? q.lintPer100Lines : null,
        tokensPerSecond: q ? q.tokensPerSecond : null,
        failKind: q ? q.failKind : null,
        runtimeChecked: !!rt,
        firstTry: bundled && !fix,
        result,
        latencyMs: t.latencyMs,
        ttftMs: t.ttftMs,
        estCostUsd: t.estCostUsd,
        checks,
        truncated: !!t.truncatedFinal,
        security: t.securityFindings ?? 0,
        designQuality: score('designQuality'),
        rtpFit: score('rtpFit'),
        completeness: score('completeness'),
        notes: [fromHand.notes || fromReview.notes || '', firstError ? `browser: ${firstError}` : ''].filter(Boolean).join(' · '),
        shot: `${REL_RESULTS}/${name}/shots/${shotName(t)}`,
        shotAbs: path.join(dir, 'shots', shotName(t)),
        report: `${REL_RESULTS}/${name}/report.md`,
      });
    }
  }
  return rows;
}

function scoreCell(r) {
  const parts = [];
  if (r.designQuality != null) parts.push(`D ${r.designQuality}`);
  if (r.rtpFit != null) parts.push(`R ${r.rtpFit}`);
  if (r.completeness != null) parts.push(`C ${r.completeness}`);
  return parts.length ? parts.join(' · ') : '';
}

async function main() {
  const runs = await loadRuns();
  const hand = await readHandScores();
  const rows = trialRows(runs, hand);
  for (const r of rows) r.hasShot = await exists(r.shotAbs);

  const byTask = new Map();
  for (const r of rows) {
    if (!byTask.has(r.taskId)) byTask.set(r.taskId, []);
    byTask.get(r.taskId).push(r);
  }
  const taskOrder = [
    ...COMPARE_TASKS.filter(t => byTask.has(t)),
    ...[...byTask.keys()].filter(t => !COMPARE_TASKS.includes(t)).sort((a, b) => {
      const la = Math.max(...byTask.get(a).map(r => r.date)), lb = Math.max(...byTask.get(b).map(r => r.date));
      return la < lb ? 1 : la > lb ? -1 : a.localeCompare(b);
    }),
  ];

  // Models over all build trials (edit tasks excluded from the summary: they
  // measure restraint, a different question)
  const builds = rows.filter(r => !r.taskId.startsWith('edit-'));
  const byModel = new Map();
  for (const r of builds) {
    if (!byModel.has(r.alias)) byModel.set(r.alias, []);
    byModel.get(r.alias).push(r);
  }
  const modelRows = [...byModel.entries()]
    .map(([alias, rs]) => {
      const ok = rs.filter(r => r.bundled);
      const checked = rs.filter(r => r.runtimeChecked);
      const scored = rs.filter(r => r.designQuality != null);
      return {
        alias,
        provider: rs[rs.length - 1].providerId,
        modelId: rs[rs.length - 1].modelId,
        n: rs.length,
        bundled: pct(ok.length, rs.length),
        firstTry: pct(rs.filter(r => r.firstTry).length, rs.length),
        renders: checked.length ? `${pct(checked.filter(r => r.rendersClean).length, checked.length)} of ${checked.length}` : 'n/a',
        lint: (() => { const m = median(rs.map(r => r.lintPer100)); return m == null ? 'n/a' : String(m); })(),
        tps: (() => { const m = median(rs.map(r => r.tokensPerSecond)); return m == null ? 'n/a' : String(m); })(),
        build: secs(median(ok.map(r => r.latencyMs))),
        cost: usd(median(rs.map(r => r.estCostUsd))),
        design: scored.length ? `${median(scored.map(r => r.designQuality))} (${scored.length})` : '',
        last: rs.map(r => r.date).sort().pop(),
      };
    })
    .sort((a, b) => (a.last < b.last ? 1 : a.last > b.last ? -1 : a.alias.localeCompare(b.alias)));

  const lines = [];
  lines.push(
    '# Bench board',
    '',
    'Every model bench run in this repo, over time, on one page: what each model',
    'built (screenshots), how it went (bundled, first try, time, cost, checks), and',
    'the human scores where someone has given them. Generated by',
    '`npm run bench:board` from `bench/results/`; do not edit by hand.',
    '',
    `Last generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC from ${runs.length} runs, ${rows.length} builds, ${rows.filter(r => r.hasShot).length} screenshots.`,
    '',
    '**To score** (whenever there is time): open [SCORES.md](SCORES.md) on GitHub,',
    'add a row per build (run, task, model, design 1 to 5, RTP fit 1 to 5,',
    'completeness 1 to 5, a note), save; the next run regenerates this page. The',
    'blinded review page (`bench/results/<run>/review/index.html`, built with',
    '`npm run bench -- review <run>`) still works and its export is read too.',
    '',
    `**Comparison prompts:** ${COMPARE_TASKS.map(t => `\`${t}\``).join(' and ')}. Models are compared on these two;`,
    'other tasks appear below as they were run. Scores: D design, R RTP fit, C completeness, each 1 to 5.',
    '',
    '## Models tested',
    '',
    '| Model | Provider id | Builds | Bundled | First try | Renders clean | Median build time | tok/s | Lint/100 lines | Median est. cost | Median design score (n) | Last run |',
    '|---|---|---|---|---|---|---|---|---|---|---|---|',
    ...modelRows.map(m => `| ${m.alias} | \`${m.modelId}\` | ${m.n} | ${m.bundled} | ${m.firstTry} | ${m.renders} | ${m.build} | ${m.tps} | ${m.lint} | ${m.cost} | ${m.design} | ${m.last} |`),
    '',
    '"Bundled" is the compiler\'s view. "Renders clean" is the browser\'s: the built app opened with visible content and no uncaught errors (checked from Oct 30, 2026; n/a before). A build can pass the first and fail the second, which is why the screenshots matter.',
    '',
  );

  for (const taskId of taskOrder) {
    const rs = byTask.get(taskId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.alias.localeCompare(b.alias)));
    const tag = COMPARE_TASKS.includes(taskId) ? ' (comparison prompt)' : taskId.startsWith('edit-') ? ' (edit task)' : '';
    lines.push(`## ${taskId}${tag}`, '');
    const withShots = rs.filter(r => r.hasShot);
    if (withShots.length) {
      lines.push(
        '<p>',
        ...withShots.map(r => `<a href="${r.shot}"><img src="${r.shot}" width="230" alt="${r.alias} ${r.date}" title="${r.alias} · ${r.date} · ${r.result}"></a>`),
        '</p>',
        '',
        withShots.map(r => `${r.alias} (${r.date})`).join(' · '),
        '',
      );
    }
    lines.push(
      '| Date | Model | Result | Checks | Build time | Est. cost | Code | Scores | Notes | Shot | Report |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
      ...rs.map(r =>
        `| ${r.date} | ${r.alias} | ${r.result}${r.truncated ? ', truncated' : ''}${r.security ? `, ${r.security} security flag(s)` : ''} | ${r.checks} | ${secs(r.latencyMs)} | ${usd(r.estCostUsd)} | ${r.code} | ${scoreCell(r)} | ${r.notes.replace(/\|/g, '/')} | ${r.hasShot ? `[png](${r.shot})` : ''} | [report](${r.report}) |`,
      ),
      '',
    );
  }

  await writeFile(OUT, lines.join('\n') + '\n');
  console.log(`Bench board: ${path.relative(ROOT, OUT)} (${runs.length} runs, ${rows.length} builds, ${rows.filter(r => r.hasShot).length} shots)`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
