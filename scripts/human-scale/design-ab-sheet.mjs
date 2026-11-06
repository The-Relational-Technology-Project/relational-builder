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
const VARIANTS = ['none', 'recipe', 'direction'];
const TASKS = ['hs-community-fridge', 'hs-listening-wall'];
const MODEL_ORDER = ['gemma-4-26b', 'mistral-small-3.2', 'glm-4.5-air', 'opus-5-5'];

const cells = new Map(); // `${task}|${alias}|${variant}` -> [{img, caption}]
for (const dir of readdirSync(root).filter(d => d.startsWith(date))) {
  const f = path.join(root, dir, 'run.json');
  if (!existsSync(f)) continue;
  const run = JSON.parse(readFileSync(f, 'utf8'));
  const variant = run.config?.designScaffold || 'none';
  if (!run.config?.fixPasses || run.config.fixPasses < 2) continue; // today's A/B used two passes
  for (const t of run.trials) {
    if (!TASKS.includes(t.taskId)) continue;
    const shot = path.join(root, dir, 'shots', `${t.taskId}--${t.alias}-t${t.trial}.png`);
    const rt = t.runtime || {};
    const clean = !!(t.bundle?.ok && rt.rendered && !(rt.errors || []).length);
    const d = t.quality?.design;
    const caption = `${t.alias} · ${variant} · t${t.trial} · ${clean ? 'works' : t.bundle?.ok ? 'bundled, not clean' : 'did not bundle'} · ${Math.round(t.latencyMs / 1000)}s` +
      (d ? ` · tokens ${d.tokensFilled}/${d.tokensTotal}, md: ${d.mdClasses}` : '');
    const key = `${t.taskId}|${t.alias}|${variant}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ img: existsSync(shot) ? `data:image/png;base64,${readFileSync(shot).toString('base64')}` : null, caption, clean });
  }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const models = MODEL_ORDER.filter(m => [...cells.keys()].some(k => k.split('|')[1] === m));
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Design scaffolding A/B</title>
<style>
:root{--bg:#f6f7f9;--ink:#1d232b;--muted:#5b6573;--card:#fff;--line:#dde2e8;--ok:#1f7a4d;--bad:#a33a2a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15181d;--ink:#e8ebef;--muted:#a3adb9;--card:#1e2229;--line:#333a44;--ok:#5fc48f;--bad:#ef8a78}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;padding:16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p{color:var(--muted);margin:0 0 12px;max-width:70ch}
.grid{display:grid;grid-template-columns:140px repeat(3,minmax(0,1fr));gap:10px;align-items:start}
.head{font-weight:600;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.04em}
.model{font-weight:600;padding-top:6px}
.cell{display:flex;flex-direction:column;gap:8px}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figure img{display:block;width:100%;height:auto}
figcaption{font-size:12px;padding:6px 8px;color:var(--muted)}
figcaption.ok{border-left:3px solid var(--ok)}figcaption.bad{border-left:3px solid var(--bad)}
.none{font-size:12px;color:var(--muted);padding:8px}
@media (max-width:720px){.grid{grid-template-columns:1fr}.head{display:none}}
</style></head><body>
<h1>Design scaffolding A/B, ${esc(date)}</h1>
<p>Same models, same prompts, three versions of the Builder's design guidance: <b>none</b> (today's prompt), <b>recipe</b> (a concrete screen layout, spacing and type scale, filled palette and contrast rules), <b>direction</b> (the recipe plus five ready-made visual styles to choose from). Two fix passes, the bad host excluded. Captions: model, version, trial, whether the app works, build time, and two mechanical signals (theme tokens filled, desktop classes), which are not design scores.</p>
`;
for (const task of TASKS) {
  html += `<h2>${esc(task.replace('hs-', '').replace(/-/g, ' '))}</h2><div class="grid"><div></div>${VARIANTS.map(v => `<div class="head">${v}</div>`).join('')}`;
  for (const m of models) {
    html += `<div class="model">${esc(m)}</div>`;
    for (const v of VARIANTS) {
      const list = cells.get(`${task}|${m}|${v}`) || [];
      html += `<div class="cell">${list.length ? list.map(c => `<figure>${c.img ? `<img src="${c.img}" alt="${esc(c.caption)}" loading="lazy">` : '<div class="none">no screenshot</div>'}<figcaption class="${c.clean ? 'ok' : 'bad'}">${esc(c.caption)}</figcaption></figure>`).join('') : '<div class="none">not run</div>'}</div>`;
    }
  }
  html += '</div>';
}
html += '</body></html>';
mkdirSync('docs/human-scale/shots', { recursive: true });
const out = `docs/human-scale/shots/design-ab-${date}.html`;
writeFileSync(out, html);
console.log(`Design A/B sheet: ${out} (${[...cells.values()].reduce((n, l) => n + l.length, 0)} builds, ${(html.length / 1e6).toFixed(1)} MB)`);
