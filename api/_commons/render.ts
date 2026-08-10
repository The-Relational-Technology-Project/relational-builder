/**
 * Page shell + visualizations for the public commons pages. Everything is
 * server-rendered HTML with inline CSS and zero JavaScript — the pages work
 * (forms included) with JS disabled, which is also what crawlers see.
 */

import {
  SITE, Entry, GalleryRef, esc, kindLabel, KIND_COLOR, entryPath, hash, monthKey, hasOwnPage,
} from './shared';

const CSS = `
:root{--bg:#faf6f0;--card:#fffdf9;--ink:#221b14;--soft:#6f6353;--line:#e8dfd2;
--accent:#d95f1e;--accent-ink:#8a3a10;--night:#171320;--maxw:52rem}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:17px/1.65 ui-serif,Georgia,'Times New Roman',serif}
header.site,footer.site,nav,main{font-family:ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif}
main .prose{font-family:ui-serif,Georgia,serif}
a{color:var(--accent-ink);text-decoration-color:#e7b391}
a:hover{color:var(--accent)}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 1.25rem}
.wide{max-width:66rem}
header.site{border-bottom:1px solid var(--line);background:var(--card)}
header.site .wrap{display:flex;align-items:baseline;gap:1rem;padding:.9rem 1.25rem;flex-wrap:wrap}
.brand{font-weight:700;letter-spacing:-.01em;color:var(--ink);text-decoration:none;font-size:1.05rem}
.brand span{color:var(--accent)}
header.site nav{margin-left:auto;display:flex;gap:1rem;font-size:.92rem}
header.site nav a{text-decoration:none;color:var(--soft)}
header.site nav a:hover{color:var(--accent)}
.crumbs{font-size:.85rem;color:var(--soft);margin:1.6rem 0 .4rem;font-family:ui-sans-serif,system-ui,sans-serif}
.crumbs a{color:var(--soft)}
h1{font-size:2.1rem;line-height:1.15;letter-spacing:-.015em;margin:.2rem 0 .6rem}
.lede{font-size:1.15rem;color:#4b4030;margin:0 0 1.4rem;max-width:44rem}
.eyebrow{display:inline-block;font-size:.78rem;font-weight:600;letter-spacing:.08em;
text-transform:uppercase;color:var(--accent);margin-top:1.8rem;font-family:ui-sans-serif,system-ui,sans-serif}
.kind-dot{display:inline-block;width:.6em;height:.6em;border-radius:50%;margin-right:.4em}
.prose{max-width:44rem}
.prose h2{font-size:1.35rem;margin:1.8rem 0 .5rem;letter-spacing:-.01em}
.prose h3{font-size:1.1rem;margin:1.4rem 0 .4rem}
.prose img{max-width:100%;border-radius:10px;border:1px solid var(--line)}
.prose blockquote{margin:1rem 0;padding:.2rem 1.1rem;border-left:3px solid var(--accent);
background:var(--card);border-radius:0 8px 8px 0;color:#4b4030}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:1.1rem 1.25rem}
.grid{display:grid;gap:.9rem;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));padding:0;list-style:none}
.grid .card{margin:0}
.card h3{margin:.1rem 0 .3rem;font-size:1.02rem;line-height:1.3}
.card h3 a{text-decoration:none;color:var(--ink)}
.card h3 a:hover{color:var(--accent)}
.card .k{font-size:.75rem;color:var(--soft);text-transform:uppercase;letter-spacing:.06em}
.card p{margin:.3rem 0 0;font-size:.9rem;color:var(--soft);line-height:1.5}
.meta{font-size:.88rem;color:var(--soft)}
.pill{display:inline-block;border:1px solid var(--line);background:var(--card);border-radius:999px;
padding:.1rem .6rem;font-size:.78rem;color:var(--soft);margin:.15rem .2rem 0 0;text-decoration:none}
.cta{display:inline-block;background:var(--accent);color:#fff;border-radius:10px;
padding:.55rem 1rem;font-weight:600;text-decoration:none;font-size:.95rem;border:0;cursor:pointer}
.cta:hover{background:#c25317;color:#fff}
.cta.ghost{background:transparent;color:var(--accent-ink);border:1.5px solid var(--accent)}
.night{background:var(--night);border-radius:14px;padding:1rem;border:1px solid #2c2438}
.night a:hover circle{fill:#fff}
.attach{border-top:1px solid var(--line);margin-top:2.2rem;padding-top:1rem;font-size:.88rem;color:var(--soft)}
.notes{list-style:none;padding:0;display:grid;gap:.7rem}
.notes li{background:var(--card);border:1px solid var(--line);border-radius:4px 14px 14px 14px;padding:.7rem .95rem}
.notes .who{font-size:.8rem;color:var(--soft);font-family:ui-sans-serif,system-ui,sans-serif}
.notes .txt{margin:.15rem 0 0;font-size:.95rem}
form.note-form{display:grid;gap:.6rem;max-width:30rem}
form.note-form input[type=text],form.note-form textarea{font:inherit;padding:.55rem .7rem;
border:1px solid var(--line);border-radius:8px;background:#fff;width:100%}
form.vote{display:inline}
button.vote-btn{font:inherit;font-size:.85rem;border:1.5px solid var(--line);background:var(--card);
border-radius:999px;padding:.25rem .75rem;cursor:pointer;color:var(--soft)}
button.vote-btn:hover{border-color:var(--accent);color:var(--accent-ink)}
.hp{position:absolute;left:-6000px}
footer.site{border-top:1px solid var(--line);margin-top:3.5rem;background:var(--card)}
footer.site .wrap{padding:1.4rem 1.25rem 2rem;font-size:.88rem;color:var(--soft)}
footer.site .stats{display:flex;gap:.6rem 1.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem}
footer.site nav{display:flex;gap:1rem;flex-wrap:wrap;margin-top:.4rem}
@media(max-width:640px){h1{font-size:1.7rem}body{font-size:16px}}
`;

export interface PageMeta {
  title: string;
  description: string;
  path: string;
  canonical?: string;        // defaults to SITE + path
  jsonLd?: object[];
  noindex?: boolean;
  wide?: boolean;
}

export interface FooterStats {
  entries: number;
  connections: number;
  months: [string, number][]; // cumulative, oldest first
}

export function page(meta: PageMeta, body: string, footer: FooterStats | null): string {
  const canonical = meta.canonical ?? `${SITE}${meta.path}`;
  const ld = (meta.jsonLd ?? [])
    .map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
<link rel="canonical" href="${esc(canonical)}">
${meta.noindex ? '<meta name="robots" content="noindex,follow">' : ''}
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${esc(`${SITE}${meta.path}`)}">
<meta property="og:image" content="${SITE}/og.png">
<meta property="og:type" content="article">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${ld}
<style>${CSS}</style>
</head>
<body>
<header class="site"><div class="wrap${meta.wide ? ' wide' : ''}">
<a class="brand" href="/commons">The RT Commons <span>🧡</span></a>
<nav>
<a href="/commons/themes/on-your-block">On your block</a>
<a href="/commons/themes/civic-media">Civic media</a>
<a href="/commons/stories">Stories</a>
<a href="/commons/map">Map</a>
<a href="/">Builder</a>
</nav>
</div></header>
<main><div class="wrap${meta.wide ? ' wide' : ''}">
${body}
</div></main>
${footerHtml(footer)}
</body>
</html>`;
}

function footerHtml(stats: FooterStats | null): string {
  const viz = stats
    ? `<div class="stats">
<strong>${stats.entries} entries</strong> · ${stats.connections} connections between them
· growing since ${fmtMonth(stats.months[0]?.[0])}
${sparkline(stats.months)}
</div>`
    : '';
  return `<footer class="site"><div class="wrap">
${viz}
<p>The RT Commons is the shared library of the
<a href="https://relationaltechproject.org" rel="noopener">Relational Technology Project</a> —
practices, tools and stories for building community where you live, kept remixable
in <a href="/">Relational Builder</a>. Entries carry their contributors' names and the
Relational Commons License; credit travels with the work.</p>
<nav>
<a href="/commons">Commons home</a>
<a href="/commons/map">Map &amp; timeline</a>
<a href="/commons/reading-room">Reading room</a>
<a href="/commons/stories">Story wall</a>
<a href="/new">Build something</a>
</nav>
</div></footer>`;
}

export function fmtMonth(ym?: string): string {
  if (!ym) return 'this year';
  const [y, m] = ym.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1)).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

// --- Sparkline (footer) ----------------------------------------------------

export function sparkline(months: [string, number][]): string {
  if (months.length < 2) return '';
  const w = 120, h = 28, pad = 2;
  const max = months[months.length - 1][1];
  const pts = months.map(([, n], i) => [
    pad + (i * (w - 2 * pad)) / (months.length - 1),
    h - pad - (n / max) * (h - 2 * pad),
  ]);
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join('');
  const area = `${line}L${pts[pts.length - 1][0].toFixed(1)},${h - pad}L${pad},${h - pad}Z`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="Commons growth over time">
<path d="${area}" fill="#e0662f22"/><path d="${line}" fill="none" stroke="#d95f1e" stroke-width="1.6"/>
<circle cx="${pts[pts.length - 1][0].toFixed(1)}" cy="${pts[pts.length - 1][1].toFixed(1)}" r="2.4" fill="#d95f1e"/>
</svg>`;
}

// --- Constellation ---------------------------------------------------------

/**
 * The commons as a night sky: every entry a dot (colored by kind, clustered
 * by shelf), every steward-confirmed connection a thin line. Deterministic —
 * a slug always lands in the same place — so the map is stable across
 * renders. In link mode each dot is an <a>, which makes the map page one
 * big crawlable index of the commons.
 */
export function constellation(
  entries: Entry[],
  refs: GalleryRef[],
  opts: { width: number; height: number; links: boolean },
): string {
  const { width: W, height: H } = opts;
  const CLUSTERS: Record<string, [number, number, number]> = {
    // cx-fraction, cy-fraction, spread
    'rtp-canonical': [0.36, 0.48, 0.34],
    'civic-media': [0.76, 0.32, 0.20],
    'rt-studio': [0.72, 0.74, 0.18],
  };
  const pos = new Map<string, [number, number]>();
  const keyOf = (e: Entry) => `${e.kind}/${e.slug}`;

  for (const e of entries) {
    const [cx, cy, spread] = CLUSTERS[e.source_studio_slug ?? ''] ?? [0.5, 0.5, 0.4];
    const a = hash(`${e.slug}∠`) * Math.PI * 2;
    const r = Math.sqrt(hash(`${e.kind}/${e.slug}r`)) * spread;
    pos.set(keyOf(e), [
      (cx + Math.cos(a) * r * 0.92) * W,
      (cy + Math.sin(a) * r * 0.78) * H,
    ]);
  }

  // Edges address entries by slug; resolve to whichever kind we placed.
  const bySlug = new Map<string, Entry[]>();
  for (const e of entries) {
    if (!bySlug.has(e.slug)) bySlug.set(e.slug, []);
    bySlug.get(e.slug)!.push(e);
  }
  const connected = new Set<string>();
  const edges: string[] = [];
  const seen = new Set<string>();
  for (const ref of refs) {
    const a = bySlug.get(ref.from_id)?.[0];
    const b = bySlug.get(ref.to_id)?.[0];
    if (!a || !b || a === b) continue;
    const ek = [keyOf(a), keyOf(b)].sort().join('|');
    if (seen.has(ek)) continue;
    seen.add(ek);
    const [x1, y1] = pos.get(keyOf(a))!;
    const [x2, y2] = pos.get(keyOf(b))!;
    connected.add(keyOf(a)); connected.add(keyOf(b));
    edges.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`,
    );
  }
  // Lineage edges too — parent links are connections in their own right.
  for (const e of entries) {
    if (!e.parent_slug) continue;
    const p = (bySlug.get(e.parent_slug) ?? []).find(x => x.id !== e.id);
    if (!p) continue;
    const ek = [keyOf(e), keyOf(p)].sort().join('|');
    if (seen.has(ek)) continue;
    seen.add(ek);
    const [x1, y1] = pos.get(keyOf(e))!;
    const [x2, y2] = pos.get(keyOf(p))!;
    connected.add(keyOf(e)); connected.add(keyOf(p));
    edges.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`,
    );
  }

  const dots = entries.map(e => {
    const [x, y] = pos.get(keyOf(e))!;
    const c = KIND_COLOR[e.kind] ?? '#999';
    const r = connected.has(keyOf(e)) ? 3.4 : 2.2;
    const circle =
      `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${c}" opacity="${connected.has(keyOf(e)) ? '0.95' : '0.7'}"/>`;
    if (!opts.links || !hasOwnPage(e)) return circle;
    return `<a href="${entryPath(e)}"><title>${esc(e.title)} · ${esc(kindLabel(e.kind))}</title>${circle}</a>`;
  });

  const legend = Object.entries(KIND_COLOR)
    .filter(([k]) => entries.some(e => e.kind === k))
    .map(
      ([k, c], i) =>
        `<circle cx="${18 + i * 108}" cy="${H - 16}" r="3.4" fill="${c}"/>` +
        `<text x="${26 + i * 108}" y="${H - 12}" fill="#b7aec6" font-size="11" font-family="ui-sans-serif,system-ui">${esc(kindLabel(k, true))}</text>`,
    )
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Map of the commons: ${entries.length} entries and their connections" style="display:block">
<g stroke="#5d5378" stroke-width="0.6" opacity="0.5">${edges.join('')}</g>
${dots.join('')}
${legend}
</svg>`;
}

// --- Shared fragments ------------------------------------------------------

export function entryCard(e: Entry, note?: string): string {
  const c = KIND_COLOR[e.kind] ?? '#999';
  return `<li class="card">
<div class="k"><span class="kind-dot" style="background:${c}"></span>${esc(kindLabel(e.kind))}${e.attribution?.neighborhood ? ` · ${esc(e.attribution.neighborhood)}` : ''}</div>
<h3><a href="${entryPath(e)}">${esc(e.title)}</a></h3>
${note ? `<p>${esc(note)}</p>` : e.summary ? `<p>${esc(truncate(e.summary, 140))}</p>` : ''}
</li>`;
}

export const truncate = (s: string, n: number): string =>
  s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;

export function breadcrumbs(trail: [string, string][]): string {
  const html = trail
    .map(([label, href], i) =>
      i === trail.length - 1 ? esc(label) : `<a href="${href}">${esc(label)}</a>`,
    )
    .join(' › ');
  return `<nav class="crumbs" aria-label="Breadcrumb">${html}</nav>`;
}

export function breadcrumbLd(trail: [string, string][]): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map(([name, href], i) => ({
      '@type': 'ListItem', position: i + 1, name, item: `${SITE}${href}`,
    })),
  };
}
