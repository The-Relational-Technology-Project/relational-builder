#!/usr/bin/env node
/**
 * Contact sheet for the spread set: one row per prompt, one column per
 * model, the day's runs only. Writes docs/human-scale/shots/spread-<date>.html.
 *
 *   node scripts/human-scale/spread-sheet.mjs --date 2026-11-10
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = 'bench/results';
const argDate = process.argv[process.argv.indexOf('--date') + 1];
// --only p1,p2 keeps just runs whose directory starts with one of these
const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const date = argDate && !argDate.startsWith('--') ? argDate : new Date().toISOString().slice(0, 10);

const TASKS = [
  ['remix-income-sharing', 'Remix: Community Income Sharing', 'Gallery tool, remixed for Albuquerque\'s International District, 5% of income, English and Spanish.'],
  ['remix-gathering-fund', 'Remix: Hello Neighbor Gathering Fund', 'Gallery story (Peoria), remixed as $75 winter gatherings in Duluth\'s Lincoln Park.'],
  ['remix-street-stories', 'Remix: Westminster Stories', 'Gallery story, remixed as a street oral history for Main Street, Hazard, Kentucky.'],
  ['remix-tool-lending-seed', 'Remix: Tool Lending Library seed', 'A builder-shared prompt seed, grown for Kalihi, Honolulu.'],
  ['hs-story-circle', 'Story circle companion', 'A live in-room tool: prompt on a TV, talking order, a gentle timer. Tucson library.'],
  ['hs-ballot-guide', 'Ballot guide', 'Plain-language, English and Spanish, nonpartisan. East Boston.'],
  ['hs-skill-swap', 'Teen and elder skill swap', 'Library sessions, big type, no accounts for elders. Vancouver.'],
  ['hs-bulletin-boards', 'Bulletin board map', 'A map of physical boards with a printable flyer route. Richmond\'s Church Hill.'],
];
const MODEL_ORDER = ['gemma-4-26b', 'glm-4.5-air', 'gpt-oss-120b', 'mistral-small-3.2', 'opus-5-5'];
const ids = TASKS.map(t => t[0]);

const cells = new Map(); // `${task}|${alias}` -> [{img, caption, clean}]
for (const dir of readdirSync(root).filter(d => d.startsWith(date) && (!only || only.some(p => d.startsWith(p))))) {
  const f = path.join(root, dir, 'run.json');
  if (!existsSync(f)) continue;
  const run = JSON.parse(readFileSync(f, 'utf8'));
  for (const t of run.trials) {
    if (!ids.includes(t.taskId)) continue;
    const shot = path.join(root, dir, 'shots', `${t.taskId}--${t.alias}-t${t.trial}.png`);
    const rt = t.runtime || {};
    const clean = !!(t.bundle?.ok && rt.rendered && !(rt.errors || []).length);
    const caption = `${t.alias} · ${clean ? 'works' : t.bundle?.ok ? 'bundled, not clean' : 'did not bundle'}` +
      `${t.fixRound ? ' after a fix pass' : ' first try'} · ${Math.round(t.latencyMs / 1000)}s`;
    // Runs with a reference arm get their own column (Nov 12: library vs none)
    const col = run.config?.reference ? `${t.alias} + ${run.config.reference}` : t.alias;
    const key = `${t.taskId}|${col}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ img: existsSync(shot) ? `data:image/png;base64,${readFileSync(shot).toString('base64')}` : null, caption, clean });
  }
}

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const cols = [...new Set([...cells.keys()].map(k => k.split('|')[1]))];
const rank = c => { const i = MODEL_ORDER.indexOf(c.split(' + ')[0]); return (i < 0 ? 99 : i) * 10 + (c.includes(' + ') ? 1 : 0); };
const models = cols.sort((a, b) => rank(a) - rank(b));
const works = m => [...cells.entries()].filter(([k]) => k.split('|')[1] === m).flatMap(([, l]) => l);
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Spread Set Sheet</title>
<style>
:root{--bg:#f6f7f9;--ink:#1d232b;--muted:#5b6573;--card:#fff;--line:#dde2e8;--ok:#1f7a4d;--bad:#a33a2a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15181d;--ink:#e8ebef;--muted:#a3adb9;--card:#1e2229;--line:#333a44;--ok:#5fc48f;--bad:#ef8a78}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;padding:16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 2px}p{color:var(--muted);margin:0 0 12px;max-width:75ch}
.grid{display:grid;grid-template-columns:repeat(var(--cols),minmax(0,1fr));gap:10px;align-items:start}
.head{font-weight:600;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.04em}
img{display:block;width:100%;height:auto}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figcaption{font-size:12px;padding:6px 8px;color:var(--muted)}
figcaption.ok{border-left:3px solid var(--ok)}figcaption.bad{border-left:3px solid var(--bad)}
.none{font-size:12px;color:var(--muted);padding:8px}
@media (max-width:720px){.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>The spread set, ${esc(date)}</h1>
<p>Eight more kinds of relational tech: four remixes of gallery items, worded the way the Builder's gallery opens a remix, and four new asks. Each column is a model, with the Builder's current design guidance and two fix passes. A column marked "+ library" also saw one reference screen of a different app from the Builder's library (for now, screens from Opus builds); other open-model columns had no Opus help. A green edge means the app works; a red one means it bundled with errors or didn't bundle.</p>
<p>${models.map(m => { const l = works(m); return `<b>${esc(m)}</b> ${l.filter(c => c.clean).length} of ${l.length} working`; }).join(' · ')}</p>
`;
for (const [id, title, blurb] of TASKS) {
  html += `<h2>${esc(title)}</h2><p>${esc(blurb)}</p><div class="grid" style="--cols:${models.length}">${models.map(m => `<div class="head">${esc(m)}</div>`).join('')}`;
  for (const m of models) {
    const list = cells.get(`${id}|${m}`) || [];
    html += `<div>${list.length ? list.map(c => `<figure>${c.img ? `<img src="${c.img}" alt="${esc(c.caption)}" loading="lazy">` : '<div class="none">no screenshot</div>'}<figcaption class="${c.clean ? 'ok' : 'bad'}">${esc(c.caption)}</figcaption></figure>`).join('') : '<div class="none">not run</div>'}</div>`;
  }
  html += '</div>';
}
html += '</body></html>';
mkdirSync('docs/human-scale/shots', { recursive: true });
const out = `docs/human-scale/shots/spread-${date}.html`;
writeFileSync(out, html);
console.log(`Spread sheet: ${out} (${[...cells.values()].reduce((n, l) => n + l.length, 0)} builds, ${(html.length / 1e6).toFixed(1)} MB)`);
