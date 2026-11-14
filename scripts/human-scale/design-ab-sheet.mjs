#!/usr/bin/env node
/**
 * Side-by-side contact sheet for the design-scaffolding A/B: rows are models,
 * columns are variants (none, recipe, direction), one block per comparison
 * prompt. Images are embedded so the page opens anywhere. Reads every run
 * under bench/results/ whose config.designScaffold is set (or whose date
 * matches --date) and writes docs/human-scale/shots/design-ab-<date>.html.
 *
 *   node scripts/human-scale/design-ab-sheet.mjs --date 2026-11-06
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = 'bench/results';
const argDate = process.argv[process.argv.indexOf('--date') + 1];
const date = argDate && !argDate.startsWith('--') ? argDate : new Date().toISOString().slice(0, 10);
// --also 2026-11-06:opus-5-5 pulls one model's builds from another day in as a reference row
const alsoArg = process.argv.includes('--also') ? process.argv[process.argv.indexOf('--also') + 1] : null;
const also = alsoArg ? { date: alsoArg.split(':')[0], alias: alsoArg.split(':')[1] } : null;
const ALL_VARIANTS = ['none', 'recipe', 'direction', 'reference'];
const TASKS = ['hs-community-fridge', 'hs-listening-wall'];
const MODEL_ORDER = ['gemma-4-26b', 'mistral-small-3.2', 'glm-4.5-air', 'opus-5-5'];

const cells = new Map(); // `${task}|${alias}|${variant}` -> [{img, caption}]
// --only p1,p2 keeps just those runs from the main date (prefix match)
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
for (const dir of readdirSync(root).filter(d => (d.startsWith(date) && (!only || only.some(p => d.startsWith(p)))) || (also && d.startsWith(also.date)))) {
  const fromAlso = also && dir.startsWith(also.date) && !dir.startsWith(date);
  const f = path.join(root, dir, 'run.json');
  if (!existsSync(f)) continue;
  const run = JSON.parse(readFileSync(f, 'utf8'));
  const variant = run.config?.designScaffold || 'none';
  if (!run.config?.fixPasses || run.config.fixPasses < 2) continue; // today's A/B used two passes
  for (const t of run.trials) {
    if (!TASKS.includes(t.taskId)) continue;
    if (fromAlso && t.alias !== also.alias) continue;
    const shot = path.join(root, dir, 'shots', `${t.taskId}--${t.alias}-t${t.trial}.png`);
    const rt = t.runtime || {};
    const clean = !!(t.bundle?.ok && rt.rendered && !(rt.errors || []).length);
    const d = t.quality?.design;
    const caption = `${t.alias} · ${variant}${fromAlso ? ` (${also.date})` : ''} · t${t.trial} · ${clean ? 'works' : t.bundle?.ok ? 'bundled, not clean' : 'did not bundle'} · ${Math.round(t.latencyMs / 1000)}s` +
      (d ? ` · tokens ${d.tokensFilled}/${d.tokensTotal}, md: ${d.mdClasses}` : '');
    const key = `${t.taskId}|${t.alias}|${variant}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ img: existsSync(shot) ? `data:image/png;base64,${readFileSync(shot).toString('base64')}` : null, caption, clean });
  }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const models = MODEL_ORDER.filter(m => [...cells.keys()].some(k => k.split('|')[1] === m));
const VARIANTS = ALL_VARIANTS.filter(v => [...cells.keys()].some(k => k.split('|')[2] === v));
let html = `<title>Design Sheet ${date}</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root{--bg:#f6f7f9;--ink:#1d232b;--muted:#5b6573;--card:#fff;--line:#dde2e8;--ok:#1f7a4d;--bad:#a33a2a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15181d;--ink:#e8ebef;--muted:#a3adb9;--card:#1e2229;--line:#333a44;--ok:#5fc48f;--bad:#ef8a78;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#15181d;--ink:#e8ebef;--muted:#a3adb9;--card:#1e2229;--line:#333a44;--ok:#5fc48f;--bad:#ef8a78;color-scheme:dark}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;padding-block:16px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p{color:var(--muted);margin:0 0 12px;max-width:70ch}
.grid{display:grid;grid-template-columns:140px repeat(var(--cols),minmax(0,1fr));gap:10px;align-items:start}
.head{font-weight:600;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.04em}
.model{font-weight:600;padding-top:6px}
.cell{display:flex;flex-direction:column;gap:8px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figure img{display:block;width:100%;height:auto}
figcaption{font-size:12px;padding:6px 8px;color:var(--muted)}
figcaption.ok{border-left:3px solid var(--ok)}figcaption.bad{border-left:3px solid var(--bad)}
.none{font-size:12px;color:var(--muted);padding:8px}
@media (max-width:720px){.grid{grid-template-columns:1fr}.head{display:none}}
</style>
<h1>Design scaffolding A/B, ${esc(date)}</h1>
<p>Same models, same prompts, versions of the Builder's design guidance: <b>none</b> (the original prompt), <b>recipe</b> (a concrete screen layout, spacing and type scale, filled palette and contrast rules), <b>direction</b> (the recipe plus five ready-made visual styles to choose from), <b>reference</b> (direction plus three rules and two reference first-screen shapes on other subjects). Columns appear only for versions run that day; a row marked with another date is a reference from that day. Two fix passes, the bad host excluded. Captions: model, version, trial, whether the app works, build time, and two mechanical signals (theme tokens filled, desktop classes), which are not design scores.</p>
`;
for (const task of TASKS) {
  html += `<h2>${esc(task.replace('hs-', '').replace(/-/g, ' '))}</h2><div class="grid" style="--cols:${VARIANTS.length}"><div></div>${VARIANTS.map(v => `<div class="head">${v}</div>`).join('')}`;
  for (const m of models) {
    html += `<div class="model">${esc(m)}</div>`;
    for (const v of VARIANTS) {
      const list = cells.get(`${task}|${m}|${v}`) || [];
      html += `<div class="cell">${list.length ? list.map(c => `<figure>${c.img ? `<img src="${c.img}" alt="${esc(c.caption)}" loading="lazy">` : '<div class="none">no screenshot</div>'}<figcaption class="${c.clean ? 'ok' : 'bad'}">${esc(c.caption)}</figcaption></figure>`).join('') : '<div class="none">not run</div>'}</div>`;
    }
  }
  html += '</div>';
}
// The Artifact publish wraps this in its own document skeleton
mkdirSync('docs/human-scale/shots', { recursive: true });
const out = `docs/human-scale/shots/design-ab-${date}.html`;
writeFileSync(out, html);
console.log(`Design A/B sheet: ${out} (${[...cells.values()].reduce((n, l) => n + l.length, 0)} builds, ${(html.length / 1e6).toFixed(1)} MB)`);
