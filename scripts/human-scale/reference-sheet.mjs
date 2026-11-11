#!/usr/bin/env node
/**
 * Contact sheet for the reference experiment: one row per prompt; the Opus
 * reference screen first, then each arm's builds. Writes
 * docs/human-scale/shots/reference-<date>.html.
 *
 *   node scripts/human-scale/reference-sheet.mjs --date 2026-11-11 [--alias gemma-4-26b]
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const root = 'bench/results';
const arg = k => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : null);
const date = arg('--date') ?? new Date().toISOString().slice(0, 10);
const alias = arg('--alias') ?? 'gemma-4-26b';

const TASKS = [
  ['hs-community-fridge', 'Community fridge'],
  ['hs-listening-wall', 'Listening wall'],
  ['remix-income-sharing', 'Remix: Community Income Sharing'],
  ['hs-ballot-guide', 'Ballot guide'],
  ['remix-street-stories', 'Remix: Westminster Stories'],
  ['hs-skill-swap', 'Teen and elder skill swap'],
];
const ARMS = [
  ['none', 'A · today\'s guidance'],
  ['same', 'B · + Opus screenshot'],
  ['spec', 'C · + written spec'],
  ['both', 'D · + both'],
  ['other', 'E · + another app\'s screenshot'],
];
const OTHER = {
  'hs-community-fridge': 'hs-ballot-guide', 'hs-listening-wall': 'remix-street-stories', 'remix-income-sharing': 'hs-skill-swap',
  'hs-ballot-guide': 'hs-community-fridge', 'remix-street-stories': 'hs-listening-wall', 'hs-skill-swap': 'remix-income-sharing',
};
const b64 = f => `data:image/png;base64,${readFileSync(f).toString('base64')}`;

const cells = new Map(); // `${task}|${arm}` -> [{img, caption, clean}]
const tally = new Map(); // arm -> {n, ok, first}
for (const dir of readdirSync(root).filter(d => d.startsWith(date))) {
  const f = path.join(root, dir, 'run.json');
  if (!existsSync(f)) continue;
  const run = JSON.parse(readFileSync(f, 'utf8'));
  if (!run.config?.reference && !run.config?.designScaffold) continue;
  const arm = run.config.reference || 'none';
  for (const t of run.trials) {
    if (t.alias !== alias || !TASKS.some(([id]) => id === t.taskId)) continue;
    const shot = path.join(root, dir, 'shots', `${t.taskId}--${t.alias}-t${t.trial}.png`);
    const rt = t.runtime || {};
    const clean = !!(t.bundle?.ok !== false && rt.rendered && !(rt.errors || []).length);
    const caption = `t${t.trial} · ${clean ? 'works' : 'broken'}${t.fixRound ? ' after a fix pass' : ', first try'} · ${rt.aboveFoldChars ?? 0} chars on screen`;
    const key = `${t.taskId}|${arm}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push({ img: existsSync(shot) ? b64(shot) : null, caption, clean });
    const s = tally.get(arm) ?? { n: 0, ok: 0, first: 0 };
    s.n++; if (clean) s.ok++; if (clean && !t.fixRound) s.first++;
    tally.set(arm, s);
  }
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
const fig = c => `<figure>${c.img ? `<img src="${c.img}" alt="${esc(c.caption)}" loading="lazy">` : '<div class="none">no screenshot</div>'}<figcaption class="${c.clean ? 'ok' : 'bad'}">${esc(c.caption)}</figcaption></figure>`;
let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Reference Screens Sheet</title>
<style>
:root{--bg:#f6f7f9;--ink:#1d232b;--muted:#5b6573;--card:#fff;--line:#dde2e8;--ok:#1f7a4d;--bad:#a33a2a;--ref:#6b4fa0}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#15181d;--ink:#e8ebef;--muted:#a3adb9;--card:#1e2229;--line:#333a44;--ok:#5fc48f;--bad:#ef8a78;--ref:#b9a2e6}}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.45 system-ui,sans-serif;padding:16px}
h1{font-size:22px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px}p{color:var(--muted);margin:0 0 12px;max-width:78ch}
.grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;align-items:start}
.head{font-weight:600;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.col{display:grid;gap:8px}
img{display:block;width:100%;height:auto}
figure{margin:0;background:var(--card);border:1px solid var(--line);border-radius:8px;overflow:hidden}
figure.ref{border:2px solid var(--ref)}
figcaption{font-size:12px;padding:6px 8px;color:var(--muted)}
figcaption.ok{border-left:3px solid var(--ok)}figcaption.bad{border-left:3px solid var(--bad)}
.none{font-size:12px;color:var(--muted);padding:8px}
table{border-collapse:collapse;margin:8px 0 16px}td,th{padding:4px 12px 4px 0;text-align:left;font-size:14px}
@media (max-width:900px){.grid{grid-template-columns:1fr 1fr}}
@media (max-width:560px){.grid{grid-template-columns:1fr}}
</style></head><body>
<h1>Showing Gemma what good looks like, ${esc(date)}</h1>
<p>${esc(alias)} on six prompts, two builds per version. The first column is Opus's build (the reference). A: the Builder's current design guidance. B: plus Opus's screenshot of this same app. C: plus a written UI spec drawn from Opus's build. D: both. E: plus Opus's screenshot of a <em>different</em> app, to see whether quality carries to a new subject. B and D measure a ceiling; C and E are what a community could use without Opus.</p>
<table><tr><th>Version</th><th>Working</th><th>First try</th></tr>${ARMS.map(([a, label]) => { const s = tally.get(a) ?? { n: 0, ok: 0, first: 0 }; return `<tr><td>${esc(label)}</td><td>${s.ok} of ${s.n}</td><td>${s.first}</td></tr>`; }).join('')}</table>
`;
for (const [id, title] of TASKS) {
  html += `<h2>${esc(title)}</h2><div class="grid"><div class="head">Opus (reference)</div>${ARMS.map(([, l]) => `<div class="head">${esc(l)}</div>`).join('')}`;
  const ref = `bench/reference/${id}.png`;
  html += `<div class="col"><figure class="ref">${existsSync(ref) ? `<img src="${b64(ref)}" alt="Opus reference" loading="lazy">` : ''}<figcaption>E is shown: ${esc(OTHER[id])}</figcaption></figure></div>`;
  for (const [a] of ARMS) {
    const list = cells.get(`${id}|${a}`) || [];
    html += `<div class="col">${list.length ? list.map(fig).join('') : '<div class="none">not run</div>'}</div>`;
  }
  html += '</div>';
}
html += '</body></html>';
mkdirSync('docs/human-scale/shots', { recursive: true });
const out = `docs/human-scale/shots/reference-${date}.html`;
writeFileSync(out, html);
console.log(`Reference sheet: ${out} (${[...cells.values()].reduce((n, l) => n + l.length, 0)} builds, ${(html.length / 1e6).toFixed(1)} MB)`);
