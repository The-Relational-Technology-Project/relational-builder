import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { TrialResult } from '../types';

/**
 * The human-review artifact: one static page, side by side, no server.
 *
 * Models are BLINDED by default (Model A/B/C…, shuffled once per run) with a
 * reveal toggle — cheap insurance against brand bias while scoring. Scores
 * persist in localStorage; "Export scores" downloads scores.json (real
 * aliases, not blind labels). Drop that file at review/scores.json and run
 * `npm run bench -- report <runDir>` to merge it into report.md.
 */

const DIMENSIONS = [
  ['designQuality', 'Design quality'],
  ['rtpFit', 'RTP fit (warm, relational, seeded, zero-setup)'],
  ['completeness', 'Completeness'],
] as const;

export async function writeReviewPage(
  runDir: string,
  runId: string,
  trials: TrialResult[],
): Promise<void> {
  const reviewDir = path.join(runDir, 'review');
  await mkdir(reviewDir, { recursive: true });

  const aliases = [...new Set(trials.map(t => t.alias))];
  const shuffled = [...aliases].sort(() => Math.random() - 0.5);
  const blindLabel = new Map(shuffled.map((a, i) => [a, `Model ${String.fromCharCode(65 + i)}`]));

  const renderCard = (t: TrialResult): string => {
      const label = blindLabel.get(t.alias) ?? t.alias;
      const chips = t.error
        ? `<span class="chip bad">error</span>`
        : [
            `<span class="chip ${t.bundle?.ok ? 'good' : 'bad'}">bundle ${t.bundle?.ok ? '✓' : '✗'}</span>`,
            `<span class="chip">${t.extraction.writes} files</span>`,
            `<span class="chip">${Math.round(t.latencyMs / 1000)}s</span>`,
            `<span class="chip">~$${t.estCostUsd?.toFixed(2) ?? '?'}</span>`,
            `<span class="chip">${t.checks.filter(c => c.pass).length}/${t.checks.length} checks</span>`,
            t.truncatedFinal ? '<span class="chip bad">truncated</span>' : '',
          ].join('');
      const previewPath = t.artifactDir ? `../${t.artifactDir}/preview.html` : null;
      const frame = previewPath
        ? `<iframe src="${previewPath}" loading="lazy"></iframe>
           <a class="open" href="${previewPath}" target="_blank">open full-size ↗</a>`
        : `<div class="nopreview">no preview — ${t.error ? 'trial errored' : 'build failed'}</div>`;
      const scoring = DIMENSIONS.map(
        ([key, name]) => `
          <label>${name}
            <select data-alias="${t.alias}" data-dim="${key}">
              <option value="">–</option>${[1, 2, 3, 4, 5].map(n => `<option>${n}</option>`).join('')}
            </select>
          </label>`,
      ).join('');
      return `
      <section class="card" data-alias="${t.alias}">
        <h2><span class="blind">${label}</span><span class="real hidden">${t.alias}</span>
            <small>trial ${t.trial}</small></h2>
        <div class="chips">${chips}</div>
        ${frame}
        <div class="scoring">${scoring}
          <label class="notes">Notes <input type="text" data-alias="${t.alias}" data-dim="notes"></label>
        </div>
      </section>`;
  };

  const taskIds = [...new Set(trials.map(t => t.taskId))];
  const cards = taskIds
    .map(taskId => {
      const section = trials.filter(t => t.taskId === taskId).map(renderCard).join('\n');
      return `<h2 class="taskhead">Task: ${taskId}</h2>\n<div class="cards">${section}</div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Bench review — ${runId}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 1rem; }
  header { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: 1rem; }
  h1 { font-size: 1.1rem; margin: 0; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1rem; }
  .card { border: 1px solid color-mix(in srgb, currentColor 25%, transparent); border-radius: 10px; padding: .75rem; }
  .card h2 { font-size: 1rem; margin: 0 0 .5rem; display: flex; gap: .5rem; align-items: baseline; }
  .card h2 small { opacity: .6; font-weight: normal; }
  .hidden { display: none; }
  .chips { display: flex; gap: .35rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .chip { font-size: .72rem; padding: .1rem .45rem; border-radius: 999px; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
  .chip.good { background: #16a34a22; } .chip.bad { background: #dc262622; }
  iframe { width: 100%; height: 480px; border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 8px; background: #fff; }
  .nopreview { height: 480px; display: grid; place-items: center; opacity: .6; border: 1px dashed currentColor; border-radius: 8px; }
  .open { font-size: .8rem; }
  .scoring { display: flex; gap: .75rem; flex-wrap: wrap; margin-top: .5rem; font-size: .82rem; }
  .scoring label { display: flex; flex-direction: column; gap: .2rem; }
  .scoring .notes { flex: 1 1 100%; } .scoring input[type=text] { width: 100%; }
  #ranking { margin: 1.25rem 0; }
  #ranking ol { display: flex; gap: .5rem; flex-wrap: wrap; list-style: none; padding: 0; }
  #ranking li { border: 1px solid currentColor; border-radius: 8px; padding: .3rem .6rem; cursor: grab; user-select: none; }
  button { padding: .4rem .8rem; border-radius: 8px; cursor: pointer; }
  .taskhead { font-size: 1rem; margin: 1.5rem 0 .5rem; opacity: .85; }
</style>
</head>
<body>
<header>
  <h1>Bench review · ${runId}</h1>
  <label><input type="checkbox" id="reveal"> reveal model names</label>
  <button id="export">Export scores.json</button>
  <span id="saved" style="opacity:.6;font-size:.8rem"></span>
</header>
<div id="ranking">
  <strong>Overall ranking</strong> (drag to reorder, best first)
  <ol id="ranklist">${shuffled
    .map(
      a =>
        `<li draggable="true" data-alias="${a}"><span class="blind">${blindLabel.get(a)}</span><span class="real hidden">${a}</span></li>`,
    )
    .join('')}</ol>
</div>
${cards}
<script>
const RUN_ID = ${JSON.stringify(runId)};
const KEY = 'rb-bench-scores-' + RUN_ID;
const state = JSON.parse(localStorage.getItem(KEY) || '{"scores":{},"ranking":[]}');

// restore
for (const el of document.querySelectorAll('[data-alias][data-dim]')) {
  const v = state.scores[el.dataset.alias]?.[el.dataset.dim];
  if (v != null) el.value = v;
}
function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  document.getElementById('saved').textContent = 'saved ' + new Date().toLocaleTimeString();
}
document.addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset?.alias || !el.dataset?.dim) return;
  state.scores[el.dataset.alias] = state.scores[el.dataset.alias] || {};
  state.scores[el.dataset.alias][el.dataset.dim] =
    el.dataset.dim === 'notes' ? el.value : (el.value ? Number(el.value) : undefined);
  save();
});

// reveal toggle
document.getElementById('reveal').addEventListener('change', e => {
  document.querySelectorAll('.blind').forEach(el => el.classList.toggle('hidden', e.target.checked));
  document.querySelectorAll('.real').forEach(el => el.classList.toggle('hidden', !e.target.checked));
});

// drag-to-rank
const list = document.getElementById('ranklist');
let dragging = null;
list.addEventListener('dragstart', e => { dragging = e.target.closest('li'); });
list.addEventListener('dragover', e => {
  e.preventDefault();
  const over = e.target.closest('li');
  if (!over || over === dragging) return;
  const rect = over.getBoundingClientRect();
  const before = e.clientX < rect.x + rect.width / 2;
  list.insertBefore(dragging, before ? over : over.nextSibling);
});
list.addEventListener('drop', () => {
  state.ranking = [...list.querySelectorAll('li')].map(li => li.dataset.alias);
  save();
});
if (state.ranking.length) {
  for (const alias of [...state.ranking].reverse()) {
    const li = list.querySelector('li[data-alias="' + alias + '"]');
    if (li) list.prepend(li);
  }
}

document.getElementById('export').addEventListener('click', () => {
  const reviewer = prompt('Your name (for the report):') || 'anonymous';
  const ranking = [...list.querySelectorAll('li')].map(li => li.dataset.alias);
  const blob = new Blob(
    [JSON.stringify({ runId: RUN_ID, reviewer, scores: state.scores, ranking }, null, 2)],
    { type: 'application/json' },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'scores.json';
  a.click();
});
</script>
</body>
</html>`;

  await writeFile(path.join(reviewDir, 'index.html'), html, 'utf8');
}
