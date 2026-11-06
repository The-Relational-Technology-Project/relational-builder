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
      // A build that came back in the wrong shape (a single HTML file when
      // the prompt asked for an app) is a failure even if it renders
      const wrongShape = t.previewKindMatch === false;
      const result = (t.error
        ? `failed: ${String(t.error).slice(0, 60)}`
        : wrongShape ? `wrong shape (${t.previewKind || 'not the app stack'})`
        : bundled && !fix ? 'bundled, first try'
        : bundled && fix ? 'bundled after one auto-fix'
        : 'did not bundle') + (wrongShape ? '' : browser);
      const served = t.served ? [t.served.model, t.served.provider ? `via ${t.served.provider}` : ''].filter(Boolean).join(' ') : '';
      const firstError = rt && rt.errors.length ? rt.errors[0].replace(/^(pageerror|console): /, '').slice(0, 110) : '';
      const q = t.quality || null;
      const code = q
        ? `${q.codeFiles} files, largest ${q.largestFileLines}, lint ${q.lintPer100Lines ?? 'n/a'}/100, tsc ${q.tscErrors ?? 'n/a'}${q.tscSyntaxErrors ? ` (+${q.tscSyntaxErrors} syntax)` : ''}, any ${q.anyCount}, kit ${q.kitImportingFiles}/${q.codeFiles}${q.invalidLucide && q.invalidLucide.length ? `, bad icons ${q.invalidLucide.join(' ')}` : ''}`
        : '';
      const checks = Array.isArray(t.checks) ? `${t.checks.filter(c => c.pass).length}/${t.checks.length}` : '';
      const fromReview = review && review.scores && review.scores[t.alias] ? review.scores[t.alias] : {};
      const fromHand = hand.find(h => name.startsWith(h.run) && h.task === t.taskId && h.model === t.alias) || {};
      const score = k => fromHand[k] ?? fromReview[k];
      const guarded = !!(run.config && run.config.importGuard);
      const variant = !run.config ? '' : [run.config.importGuard ? 'guard' : '', run.config.humanScaleRules ? 'rules' : '', run.config.fixHints ? 'hints' : '', run.config.fixPasses > 1 ? `fix×${run.config.fixPasses}` : '', run.config.designScaffold && run.config.designScaffold !== 'none' ? `design:${run.config.designScaffold}` : '', run.config.openrouterIgnore ? `not ${run.config.openrouterIgnore}` : '', run.config.openrouterOnly ? `only ${run.config.openrouterOnly}` : ''].filter(Boolean).join('+');
      rows.push({
        guarded,
        variant,
        runName: name,
        runDir: dir,
        date: day(t.startedAt || run.createdAt),
        taskId: t.taskId ?? run.config?.task ?? 'build',
        taskVersion: t.taskVersion,
        alias: t.alias,
        providerId: t.providerId,
        modelId: t.modelId,
        bundled,
        rendersClean: !!(bundled && rt && rt.rendered && rt.errors.length === 0 && t.previewKindMatch !== false),
        outcome: outcomeOf(t),
        fixLatencyMs: t.fixRound && t.fixRound.attempted ? t.fixRound.latencyMs : null,
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
        servedHost: t.served && t.served.provider ? t.served.provider : null,
        notes: [fromHand.notes || fromReview.notes || '', firstError ? `browser: ${firstError}` : '', served ? `served: ${served}` : ''].filter(Boolean).join(' · '),
        shot: `${REL_RESULTS}/${name}/shots/${shotName(t)}`,
        shotAbs: path.join(dir, 'shots', shotName(t)),
        report: `${REL_RESULTS}/${name}/report.md`,
      });
    }
  }
  return rows;
}

/** One word for how a build ended, for the rates table. The order matters:
 *  the first thing that went wrong is what the build died of. */
function outcomeOf(t) {
  if (t.error) return 'harness-error';
  if (t.previewKindMatch === false) return 'wrong-shape';
  const bundled = !!(t.bundle && t.bundle.ok);
  const fr = t.fixRound && t.fixRound.attempted ? t.fixRound : null;
  const text = [...((fr && fr.triggerErrors) || []), ...((fr && fr.remainingErrors) || []), ...((t.bundle && t.bundle.errors) || [])].join('\n');
  const importKind = s =>
    /Could not find "/.test(s) ? 'missing-file'
    : /is used but never imported|React is not defined|is not defined/.test(s) ? 'undeclared'
    : /No matching export|does not provide an export/.test(s) ? 'bad-import'
    : /Expected .* but found|Unexpected|not valid inside|Unterminated/.test(s) ? 'syntax'
    : null;
  if (!bundled) return importKind(text) || 'no-bundle';
  const rt = t.runtime || null;
  if (!rt) return 'bundled-unchecked';
  if (!rt.rendered) {
    const k = importKind((rt.errors || []).join('\n'));
    return k ? `blank-${k}` : 'blank-runtime';
  }
  if (rt.errors && rt.errors.length) return 'renders-with-errors';
  return 'clean';
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
    '"(import guard)" marks runs where the static import check fed the fix pass (from Oct 31, 2026); compare them with the unguarded row for the same model and prompt.',
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

  // Rates over guarded runs on the comparison prompts: the table that answers
  // "how often does this model produce a working app, and how does it fail"
  const guardedRows = builds.filter(r => r.guarded && COMPARE_TASKS.includes(r.taskId));
  if (guardedRows.length) {
    const byM = new Map();
    for (const r of guardedRows) { if (!byM.has(r.alias)) byM.set(r.alias, []); byM.get(r.alias).push(r); }
    const kinds = [...new Set(guardedRows.map(r => r.outcome))].filter(k => k !== 'clean').sort();
    lines.push(
      '## Guarded runs on the comparison prompts: rates per model',
      '',
      'Only runs with the import guard on (Oct 31 onward), both comparison prompts, all trials. "Clean" means bundled, opened in a browser with visible content and no errors, in the shape the prompt asked for. Each other column is the share of builds that ended that way; a build counts once, under the first thing that went wrong. Fix time is the median wall time of the automatic fix pass when one ran.',
      '',
      `| Model | Builds | Clean | ${kinds.join(' | ')} | Median build | Median fix | Median est. cost |`,
      `|---|---|---|${kinds.map(() => '---|').join('')}---|---|---|`,
      ...[...byM.entries()].sort((a, b) => b[1].filter(r => r.outcome === 'clean').length / b[1].length - a[1].filter(r => r.outcome === 'clean').length / a[1].length).map(([alias, rs]) => {
        const share = k => pct(rs.filter(r => r.outcome === k).length, rs.length) || '0%';
        return `| ${alias} | ${rs.length} | **${share('clean')}** | ${kinds.map(share).join(' | ')} | ${secs(median(rs.map(r => r.latencyMs)))} | ${secs(median(rs.map(r => r.fixLatencyMs)))} | ${usd(median(rs.map(r => r.estCostUsd)))} |`;
      }),
      '',
    );
    // The same builds split by the upstream host the router reported. One
    // model name on OpenRouter is served by several hosts, and a host can
    // serve it badly (Nov 3: every gemma build from one host failed on a
    // doubled quote; every build from the others compiled)
    const hosted = guardedRows.filter(r => r.servedHost);
    if (hosted.length) {
      const byMH = new Map();
      for (const r of hosted) { const k = `${r.alias}|${r.servedHost}`; if (!byMH.has(k)) byMH.set(k, []); byMH.get(k).push(r); }
      lines.push(
        '### The same builds, by the host that served them',
        '',
        'Recorded from the provider\'s stream metadata since Nov 3, 2026 (earlier builds have no host). A model name is not a model: compare rows for one model before trusting its average.',
        '',
        'A host shows a rate only once it has served three builds of that model; fewer is noise, so those hosts are listed underneath with their raw counts.',
        '',
        '| Model | Served by | Builds | Clean | Bundled | First failure kinds |',
        '|---|---|---|---|---|---|',
        ...[...byMH.entries()].filter(([, rs]) => rs.length >= 3).sort((a, b) => a[0].localeCompare(b[0])).map(([k, rs]) => {
          const [alias, host] = k.split('|');
          const fails = [...new Set(rs.filter(r => r.outcome !== 'clean').map(r => r.outcome))].join(', ');
          return `| ${alias} | ${host} | ${rs.length} | **${pct(rs.filter(r => r.outcome === 'clean').length, rs.length) || '0%'}** | ${pct(rs.filter(r => r.bundled).length, rs.length) || '0%'} | ${fails} |`;
        }),
        '',
      );
      const few = [...byMH.entries()].filter(([, rs]) => rs.length < 3).sort((a, b) => a[0].localeCompare(b[0]));
      if (few.length) {
        lines.push(
          `Fewer than three builds: ${few.map(([k, rs]) => { const [alias, host] = k.split('|'); return `${alias} on ${host} (${rs.filter(r => r.outcome === 'clean').length} of ${rs.length} clean)`; }).join('; ')}.`,
          '',
        );
      }
    }
  }

  for (const taskId of taskOrder) {
    const rs = byTask.get(taskId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.alias.localeCompare(b.alias)));
    const tag = COMPARE_TASKS.includes(taskId) ? ' (comparison prompt)' : taskId.startsWith('edit-') ? ' (edit task)' : '';
    lines.push(`## ${taskId}${tag}`, '');
    const withShots = rs.filter(r => r.hasShot);
    if (withShots.length) {
      lines.push(
        '<p>',
        ...withShots.map(r => `<a href="${r.shot}"><img src="${r.shot}" width="230" alt="${r.alias} ${r.date}" title="${r.alias} · ${r.date}${r.guarded ? ' · import guard' : ''} · ${r.result}"></a>`),
        '</p>',
        '',
        withShots.map(r => `${r.alias}${r.guarded ? ' +guard' : ''} (${r.date})`).join(' · '),
        '',
      );
    }
    lines.push(
      '| Date | Model | Result | Checks | Build time | Est. cost | Code | Scores | Notes | Shot | Report |',
      '|---|---|---|---|---|---|---|---|---|---|---|',
      ...rs.map(r =>
        `| ${r.date} | ${r.alias}${r.variant ? ` (${r.variant})` : ''} | ${r.result}${r.truncated ? ', truncated' : ''}${r.security ? `, ${r.security} security flag(s)` : ''} | ${r.checks} | ${secs(r.latencyMs)} | ${usd(r.estCostUsd)} | ${r.code} | ${scoreCell(r)} | ${r.notes.replace(/\|/g, '/')} | ${r.hasShot ? `[png](${r.shot})` : ''} | [report](${r.report}) |`,
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
