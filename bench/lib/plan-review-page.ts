import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { PlanRunReport } from '../plan-types';

/**
 * The plan bench's human-review artifact: one static page, no server, plans
 * rendered side by side per scenario.
 *
 * Models are BLINDED (Model A/B/C, shuffled once per run) with a reveal
 * toggle. Scoring is per model per scenario on 0–10:
 *   - RT alignment  ×1
 *   - Creativity    ×1
 *   - Overall       ×2   (the agreed weighting — composite = (rt+cr+2×ov)/4)
 * Scores persist in localStorage; "Export scores.json" downloads them (real
 * aliases). Drop the file at review/scores.json and run
 * `npm run bench -- plan report <runDir>` to merge into report.md.
 */

export async function writePlanReviewPage(runDir: string, run: PlanRunReport): Promise<void> {
  const reviewDir = path.join(runDir, 'review');
  await mkdir(reviewDir, { recursive: true });

  const aliases = [...new Set(run.trials.map(t => t.alias))];
  const shuffled = [...aliases].sort(() => Math.random() - 0.5);
  const blind = Object.fromEntries(shuffled.map((a, i) => [a, `Model ${String.fromCharCode(65 + i)}`]));

  const data = {
    runId: run.runId,
    scenarios: run.scenarios,
    blind,
    trials: run.trials.map(t => ({
      alias: t.alias,
      scenarioId: t.scenarioId,
      trial: t.trial,
      planText: t.planText,
      error: t.error,
      chips: {
        checks: `${t.checks.filter(c => c.pass).length}/${t.checks.length}`,
        failed: t.checks.filter(c => !c.pass).map(c => c.id),
        commons: `${t.mentionedTitles.length}/${t.retrieval.surfaced.length}`,
        fabricated: t.judge?.fabricated.length ?? null,
        words: t.words,
        secs: Math.round(t.latencyMs / 1000),
      },
    })),
  };

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plan bench review — ${run.runId}</title>
<style>
  :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
  body { margin: 0; padding: 1rem; }
  header { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; margin-bottom: .75rem; }
  h1 { font-size: 1.1rem; margin: 0; }
  .rubric { font-size: .82rem; opacity: .85; border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
            border-radius: 10px; padding: .6rem .8rem; margin-bottom: 1rem; max-width: 72rem; }
  .rubric b { font-weight: 600; }
  .scenariohead { font-size: 1rem; margin: 1.5rem 0 .5rem; opacity: .85; }
  .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: 1rem; }
  .card { border: 1px solid color-mix(in srgb, currentColor 25%, transparent); border-radius: 10px; padding: .75rem; }
  .card h3 { font-size: .95rem; margin: 0 0 .5rem; display: flex; gap: .5rem; align-items: baseline; }
  .card h3 small { opacity: .6; font-weight: normal; }
  .hidden { display: none; }
  .chips { display: flex; gap: .35rem; flex-wrap: wrap; margin-bottom: .5rem; }
  .chip { font-size: .72rem; padding: .1rem .45rem; border-radius: 999px; border: 1px solid color-mix(in srgb, currentColor 30%, transparent); }
  .chip.good { background: #16a34a22; } .chip.bad { background: #dc262622; }
  .plan { border: 1px solid color-mix(in srgb, currentColor 20%, transparent); border-radius: 8px;
          padding: .75rem 1rem; height: 480px; overflow: auto; font-size: .85rem; line-height: 1.55; background: color-mix(in srgb, currentColor 4%, transparent); }
  .plan h1 { font-size: 1.15rem; } .plan h2 { font-size: 1.02rem; margin: 1rem 0 .4rem; } .plan h3 { font-size: .92rem; }
  .plan code { font-size: .8rem; padding: 0 .25rem; border-radius: 4px; background: color-mix(in srgb, currentColor 10%, transparent); }
  .plan pre { overflow-x: auto; padding: .5rem; border-radius: 6px; background: color-mix(in srgb, currentColor 8%, transparent); }
  .scoring { display: flex; gap: .75rem; flex-wrap: wrap; align-items: end;
             border: 1px dashed color-mix(in srgb, currentColor 35%, transparent);
             border-radius: 10px; padding: .6rem .75rem; margin: .5rem 0 1rem; font-size: .82rem; }
  .scoring label { display: flex; flex-direction: column; gap: .2rem; }
  .scoring .who { font-weight: 600; align-self: center; min-width: 7rem; }
  .scoring .composite { font-weight: 600; min-width: 8rem; align-self: center; }
  .scoring .notes { flex: 1 1 14rem; } .scoring input[type=text] { width: 100%; }
  button { padding: .4rem .8rem; border-radius: 8px; cursor: pointer; }
  .nopreview { height: 480px; display: grid; place-items: center; opacity: .6; border: 1px dashed currentColor; border-radius: 8px; }
</style>
</head>
<body>
<header>
  <h1>Plan bench review · ${run.runId}</h1>
  <label><input type="checkbox" id="reveal"> reveal model names</label>
  <button id="export">Export scores.json</button>
  <span id="saved" style="opacity:.6;font-size:.8rem"></span>
</header>
<div class="rubric">
  Score each model per scenario, 0–10. <b>RT alignment</b>: draws on the surfaced commons by
  name; plans the practices around the tech (a tender, a gathering it attaches to); invites
  before infrastructure; the first screen is obvious in three seconds. <b>Creativity</b>: a plan
  only this place could get — a committed look with real values, a chosen physical-world shape,
  not the same tasteful default. <b>Overall</b> (counts 2×): would you hand this to the builder
  as-is? Anchors: 2 broken or generic · 5 competent but templated · 8 strong, minor polish left
  · 10 you'd frame it. Composite = (RT + Creativity + 2×Overall) / 4.
</div>
<div id="root"></div>
<script>
const DATA = ${JSON.stringify(data).replace(/</g, '\\u003c')};
const KEY = 'rb-plan-bench-scores-' + DATA.runId;
const state = JSON.parse(localStorage.getItem(KEY) || '{"scores":{}}');
const DIMS = [['rtAlignment','RT alignment'],['creativity','Creativity'],['overall','Overall (×2)']];

function esc(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
// Minimal markdown → HTML: headings, hr, lists, bold/italic/inline code,
// fenced blocks, paragraphs. Plans are prose — this is plenty.
function md(src) {
  const lines = src.split('\\n');
  const out = [];
  let list = null, para = [], fence = false, fenceBuf = [];
  const flushPara = () => { if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } };
  const flushList = () => { if (list) { out.push('</' + list + '>'); list = null; } };
  const inline = s => esc(s)
    .replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>')
    .replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
    .replace(/\`([^\`]+)\`/g, '<code>$1</code>');
  for (const raw of lines) {
    if (fence) {
      if (/^\`\`\`/.test(raw)) { out.push('<pre><code>' + esc(fenceBuf.join('\\n')) + '</code></pre>'); fence = false; fenceBuf = []; }
      else fenceBuf.push(raw);
      continue;
    }
    const line = raw.replace(/\\s+$/, '');
    if (/^\`\`\`/.test(line)) { flushPara(); flushList(); fence = true; continue; }
    const h = /^(#{1,6})\\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); const n = Math.min(h[1].length, 4); out.push('<h' + n + '>' + inline(h[2]) + '</h' + n + '>'); continue; }
    if (/^(---|\\*\\*\\*)\\s*$/.test(line)) { flushPara(); flushList(); out.push('<hr>'); continue; }
    const li = /^\\s*[-*]\\s+(.*)$/.exec(line);
    const oli = /^\\s*\\d+\\.\\s+(.*)$/.exec(line);
    if (li || oli) {
      flushPara();
      const want = li ? 'ul' : 'ol';
      if (list !== want) { flushList(); out.push('<' + want + '>'); list = want; }
      out.push('<li>' + inline((li || oli)[1]) + '</li>');
      continue;
    }
    if (line.trim() === '') { flushPara(); flushList(); continue; }
    para.push(line.trim());
  }
  flushPara(); flushList();
  if (fence) out.push('<pre><code>' + esc(fenceBuf.join('\\n')) + '</code></pre>');
  return out.join('\\n');
}

function chipHtml(c) {
  const bits = [
    '<span class="chip ' + (c.failed.length ? 'bad' : 'good') + '">checks ' + c.checks + '</span>',
    '<span class="chip">commons ' + c.commons + '</span>',
    c.fabricated != null ? '<span class="chip ' + (c.fabricated ? 'bad' : 'good') + '">fabricated ' + c.fabricated + '</span>' : '',
    '<span class="chip">' + c.words + ' words</span>',
    '<span class="chip">' + c.secs + 's</span>',
  ];
  if (c.failed.length) bits.push('<span class="chip bad" title="failed checks">✗ ' + c.failed.join(', ') + '</span>');
  return bits.join('');
}

const root = document.getElementById('root');
let htmlOut = '';
for (const sc of DATA.scenarios) {
  htmlOut += '<h2 class="scenariohead">Scenario: ' + esc(sc.id) + ' (expects ' + sc.expect + ')</h2>';
  const aliases = [...new Set(DATA.trials.filter(t => t.scenarioId === sc.id).map(t => t.alias))];
  for (const alias of aliases) {
    const ts = DATA.trials.filter(t => t.scenarioId === sc.id && t.alias === alias);
    htmlOut += '<div class="cards">';
    for (const t of ts) {
      htmlOut += '<section class="card">' +
        '<h3><span class="blind">' + esc(DATA.blind[t.alias]) + '</span>' +
        '<span class="real hidden">' + esc(t.alias) + '</span><small>trial ' + t.trial + '</small></h3>' +
        '<div class="chips">' + chipHtml(t.chips) + '</div>' +
        (t.error
          ? '<div class="nopreview">trial errored — ' + esc(t.error) + '</div>'
          : '<div class="plan">' + md(t.planText) + '</div>') +
        '</section>';
    }
    htmlOut += '</div>';
    const dimSelects = DIMS.map(([key, name]) =>
      '<label>' + name + '<select data-alias="' + esc(alias) + '" data-scenario="' + esc(sc.id) + '" data-dim="' + key + '">' +
      '<option value="">–</option>' + Array.from({length: 11}, (_, n) => '<option>' + n + '</option>').join('') +
      '</select></label>').join('');
    htmlOut += '<div class="scoring">' +
      '<span class="who"><span class="blind">' + esc(DATA.blind[alias]) + '</span><span class="real hidden">' + esc(alias) + '</span></span>' +
      dimSelects +
      '<span class="composite" data-alias="' + esc(alias) + '" data-scenario="' + esc(sc.id) + '">composite —</span>' +
      '<label class="notes">Notes <input type="text" data-alias="' + esc(alias) + '" data-scenario="' + esc(sc.id) + '" data-dim="notes"></label>' +
      '</div>';
  }
}
root.innerHTML = htmlOut;

function compositeOf(s) {
  if (!s || s.rtAlignment == null || s.creativity == null || s.overall == null) return null;
  return (s.rtAlignment + s.creativity + 2 * s.overall) / 4;
}
function refreshComposites() {
  for (const el of document.querySelectorAll('.composite')) {
    const c = compositeOf(state.scores[el.dataset.alias]?.[el.dataset.scenario]);
    el.textContent = c == null ? 'composite —' : 'composite ' + c.toFixed(1) + ' / 10';
  }
}

// restore
for (const el of document.querySelectorAll('[data-alias][data-scenario][data-dim]')) {
  const v = state.scores[el.dataset.alias]?.[el.dataset.scenario]?.[el.dataset.dim];
  if (v != null) el.value = v;
}
refreshComposites();

function save() {
  localStorage.setItem(KEY, JSON.stringify(state));
  document.getElementById('saved').textContent = 'saved ' + new Date().toLocaleTimeString();
}
document.addEventListener('change', e => {
  const el = e.target;
  if (!el.dataset?.alias || !el.dataset?.scenario || !el.dataset?.dim) return;
  state.scores[el.dataset.alias] = state.scores[el.dataset.alias] || {};
  const s = state.scores[el.dataset.alias][el.dataset.scenario] =
    state.scores[el.dataset.alias][el.dataset.scenario] || {};
  s[el.dataset.dim] = el.dataset.dim === 'notes' ? el.value : (el.value ? Number(el.value) : undefined);
  save();
  refreshComposites();
});

document.getElementById('reveal').addEventListener('change', e => {
  document.querySelectorAll('.blind').forEach(el => el.classList.toggle('hidden', e.target.checked));
  document.querySelectorAll('.real').forEach(el => el.classList.toggle('hidden', !e.target.checked));
});

document.getElementById('export').addEventListener('click', () => {
  const reviewer = prompt('Your name (for the report):') || 'anonymous';
  const blob = new Blob(
    [JSON.stringify({ runId: DATA.runId, reviewer, scores: state.scores }, null, 2)],
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
