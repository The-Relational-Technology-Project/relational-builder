/**
 * Page shell + visualizations for the public commons pages. Everything is
 * server-rendered HTML with inline CSS and zero JavaScript — the pages work
 * (forms included) with JS disabled, which is also what crawlers see.
 *
 * The look is Whole Earth Catalog: aged paper, ink-black rules, squared-off
 * cards, and one serif family (Georgia/ui-serif) everywhere — bold for
 * titles, uppercase for labels — tuned for readability first. Light mode
 * only, deliberately; every color is still a token in case that changes.
 */

import {
  SITE, Entry, GalleryRef, esc, kindLabel, KIND_COLOR, entryPath, hash, hasOwnPage,
} from './shared';

const CSS = `
:root{color-scheme:light;
--bg:#f4eee0;--card:#fbf7eb;--ink:#1c1710;--ink2:#42392a;--soft:#6b6150;
--line:#d9cdb4;--rule:#1c1710;--accent:#bd4a12;--accent-ink:#8f380d;
--mark:#f3dfa4;--night:#171320;--night-line:#2c2438;--maxw:52rem}
/* Kind palette: --kc is the mark color, --kc-text its readable text ink. */
.kc-recipe{--kc:#e0662f;--kc-text:#a3400f}
.kc-tool{--kc:#2f6fe0;--kc-text:#1d4fb0}
.kc-story{--kc:#c2452f;--kc-text:#96301d}
.kc-prompt{--kc:#0f8a7a;--kc-text:#0b6b5e}
.kc-framework{--kc:#4a8f3c;--kc-text:#376b2b}
.kc-methodology{--kc:#7a4fc2;--kc-text:#5d3a9e}
.kc-reference{--kc:#8a7f72;--kc-text:#6f6353}
.kc-program{--kc:#b0812f;--kc-text:#7d5a1d}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
font:17px/1.68 ui-serif,Georgia,'Times New Roman',serif}
input,textarea,button{font-family:inherit}
a{color:var(--accent-ink);text-decoration-color:color-mix(in srgb,var(--accent) 45%,transparent)}
a:hover{color:var(--accent)}
.wrap{max-width:var(--maxw);margin:0 auto;padding:0 1.25rem}
.wide{max-width:66rem}
/* Masthead: name big, tagline beside it, nav on its own ruled row. */
header.site{background:var(--card);border-bottom:1px solid var(--line)}
header.site .mast{display:flex;align-items:baseline;gap:.35rem 1rem;flex-wrap:wrap;
padding:1rem 1.25rem .55rem}
.brand{font-weight:800;color:var(--ink);text-decoration:none;
font-size:1.5rem;line-height:1.1}
.brand:hover{color:var(--ink)}
.tagline{color:var(--ink2);font-size:.95rem}
header.site .navbar{border-top:2px solid var(--rule)}
header.site .navrow{display:flex;align-items:center;gap:.4rem 1.15rem;flex-wrap:wrap;
padding:.5rem 1.25rem}
header.site nav{display:flex;gap:1.15rem;font-size:.84rem;letter-spacing:.08em;
text-transform:uppercase;font-weight:700}
header.site nav a{text-decoration:none;color:var(--ink);white-space:nowrap}
header.site nav a:hover{color:var(--accent)}
header.site form.search{flex:0 1 12rem;min-width:8rem;margin-left:auto}
header.site input[type=search]{width:100%;font:inherit;font-size:.85rem;padding:.3rem .7rem;
border:1px solid var(--line);border-radius:3px;background:var(--bg);color:var(--ink)}
header.site input[type=search]:focus{outline:none;border-color:var(--accent)}
form.search-hero{display:flex;gap:.6rem;max-width:34rem;margin:0 0 .5rem}
form.search-hero input{flex:1;min-width:0;font:inherit;font-size:.95rem;padding:.55rem .85rem;
border:1px solid var(--soft);border-radius:3px;background:var(--card);color:var(--ink)}
form.search-hero input:focus{outline:none;border-color:var(--accent);
box-shadow:0 0 0 2px color-mix(in srgb,var(--accent) 25%,transparent)}
mark{background:var(--mark);color:inherit;border-radius:2px;padding:0 .08em}
.crumbs{font-size:.85rem;color:var(--soft);margin:1.6rem 0 .4rem}
.crumbs a{color:var(--soft)}
h1{font-size:2.15rem;line-height:1.15;letter-spacing:-.01em;margin:.2rem 0 .7rem;
font-weight:800;border-bottom:4px solid var(--rule);padding-bottom:.45rem}
.lede{font-size:1.15rem;color:var(--ink2);margin:0 0 1.4rem;max-width:44rem}
/* Section headers wear a heavy catalog rule; black ink, not accent color. */
.eyebrow{display:block;border-top:3px solid var(--rule);padding-top:.5rem;
font-size:.85rem;font-weight:800;letter-spacing:.13em;text-transform:uppercase;
color:var(--ink);margin-top:2.6rem}
.kind-dot{display:inline-block;width:.6em;height:.6em;border-radius:50%;margin-right:.4em}
.chip{display:inline-block;border-radius:2px;padding:.08rem .5rem;font-size:.72rem;font-weight:700;
letter-spacing:.07em;text-transform:uppercase;
line-height:1.5;color:var(--kc-text,var(--soft));
background:color-mix(in srgb,var(--kc,#8a7f72) 13%,transparent)}
.kc-title{color:var(--kc-text)}
.prose{max-width:44rem}
.prose h2{font-size:1.4rem;margin:1.9rem 0 .5rem;letter-spacing:-.01em;font-weight:700;
border-bottom:1px solid var(--line);padding-bottom:.25rem}
.prose h3{font-size:1.12rem;margin:1.4rem 0 .4rem;font-weight:700}
.prose img{max-width:100%;border-radius:3px;border:1px solid var(--line)}
.prose blockquote{margin:1rem 0;padding:.2rem 1.1rem;border-left:4px solid var(--rule);
background:var(--card);color:var(--ink2)}
.card{background:var(--card);border:1px solid var(--line);border-radius:3px;padding:1.05rem 1.2rem}
.card.kc{border-top:3px solid var(--kc)}
.grid{display:grid;gap:.9rem;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr));padding:0;list-style:none}
.grid .card{margin:0}
.card h3{margin:.15rem 0 .3rem;font-size:1.06rem;line-height:1.3;font-weight:700}
.card h3 a{text-decoration:none;color:var(--ink)}
.card h3 a:hover{color:var(--accent)}
.card h3 a.kc-title{color:var(--kc-text)}
.card h3 a.kc-title:hover{color:var(--accent)}
.card .k{font-size:.75rem;color:var(--soft);text-transform:uppercase;letter-spacing:.06em}
.card p{margin:.3rem 0 0;font-size:.9rem;color:var(--soft);line-height:1.5}
.meta{font-size:.88rem;color:var(--soft)}
.pill{display:inline-block;border:1px solid var(--line);background:var(--card);border-radius:2px;
padding:.1rem .55rem;font-size:.78rem;color:var(--soft);margin:.15rem .2rem 0 0;text-decoration:none}
.cta{display:inline-block;background:var(--accent);color:#fff;border-radius:3px;
padding:.55rem 1rem;font-weight:700;text-decoration:none;font-size:.95rem;border:0;cursor:pointer}
.cta:hover{background:color-mix(in srgb,var(--accent) 88%,#000);color:#fff}
.cta.ghost{background:transparent;color:var(--accent-ink);border:1.5px solid var(--accent)}
.night{background:var(--night);border-radius:4px;padding:1rem;border:1px solid var(--night-line)}
.night a:hover circle{fill:#fff}
.attach{border-top:3px solid var(--rule);margin-top:2.4rem;padding-top:1rem;font-size:.88rem;color:var(--soft)}
.notes{list-style:none;padding:0;display:grid;gap:.7rem}
.notes li{background:var(--card);border:1px solid var(--line);border-radius:2px 10px 10px 10px;padding:.7rem .95rem}
.notes .who{font-size:.8rem;color:var(--soft)}
.notes .txt{margin:.15rem 0 0;font-size:.95rem}
form.note-form{display:grid;gap:.6rem;max-width:30rem}
form.note-form input[type=text],form.note-form textarea{font:inherit;padding:.55rem .7rem;
border:1px solid var(--soft);border-radius:3px;background:var(--card);color:var(--ink);width:100%}
form.vote{display:inline}
button.vote-btn{font:inherit;font-size:.85rem;border:1.5px solid var(--line);background:var(--card);
border-radius:3px;padding:.25rem .75rem;cursor:pointer;color:var(--soft)}
button.vote-btn:hover{border-color:var(--accent);color:var(--accent-ink)}
.hp{position:absolute;left:-6000px}
footer.site{border-top:4px solid var(--rule);margin-top:3.5rem;background:var(--card)}
footer.site .wrap{padding:1.4rem 1.25rem 2rem;font-size:.88rem;color:var(--soft)}
footer.site .stats{display:flex;gap:.6rem 1.4rem;align-items:center;flex-wrap:wrap;margin-bottom:.5rem}
footer.site nav{display:flex;gap:.5rem 1rem;flex-wrap:wrap;margin-top:.4rem}
@media(max-width:640px){
body{font-size:16px}
h1{font-size:1.75rem}
.lede{font-size:1.05rem}
.wrap{padding:0 1rem}
header.site .mast{padding:.8rem 1rem .45rem}
.brand{font-size:1.3rem}
.tagline{display:none}
header.site .navrow{padding:.45rem 1rem;row-gap:.3rem}
header.site nav{overflow-x:auto;gap:1rem;padding-bottom:.15rem;scrollbar-width:none;
flex:1 1 100%}
header.site nav::-webkit-scrollbar{display:none}
header.site form.search{flex:1 1 100%;margin-left:0}
form.search-hero button.cta{padding:.55rem .85rem}
.night{overflow-x:auto;-webkit-overflow-scrolling:touch}
.night svg{min-width:34rem}
.eyebrow{margin-top:1.9rem}
}
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
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#fbf7eb">
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
<header class="site">
<div class="wrap${meta.wide ? ' wide' : ''} mast">
<a class="brand" href="/commons">The Civic Commons</a>
<span class="tagline">Access to tools for building community where you live</span>
</div>
<div class="navbar"><div class="wrap${meta.wide ? ' wide' : ''} navrow">
<nav>
<a href="/commons/guides">Guides</a>
<a href="/commons/recipes">Recipes</a>
<a href="/commons/tools">Tools</a>
<a href="/commons/stories">Stories</a>
<a href="/commons/map">Map</a>
<a href="/">Builder</a>
</nav>
<form class="search" action="/commons/search" method="get" role="search">
<input type="search" name="q" placeholder="Search the commons…" aria-label="Search the commons">
</form>
</div></div>
</header>
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
<p>The Civic Commons is a shared library of practices, tools and stories for building
community where you live — stewarded by the
<a href="https://relationaltechproject.org" rel="noopener">Relational Technology Project</a>
and kept remixable in <a href="/">Relational Builder</a>. Entries carry their contributors'
names and the <a href="/commons/license">Reciprocal Commons License</a>; credit travels with the work.</p>
<nav>
<a href="/commons">Commons home</a>
<a href="/commons/guides">Guides</a>
<a href="/commons/search">Search</a>
<a href="/commons/map">Map &amp; timeline</a>
<a href="/commons/reading-room">Reading room</a>
<a href="/commons/stories">Stories</a>
<a href="/commons/license">License</a>
<a href="https://github.com/The-Relational-Technology-Project/relational-commons" rel="noopener">Commons in git</a>
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
 * by collection), every steward-confirmed connection a thin line. Deterministic —
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
        `<text x="${26 + i * 108}" y="${H - 12}" fill="#b7aec6" font-size="11" font-family="ui-serif,Georgia,serif">${esc(kindLabel(k, true))}</text>`,
    )
    .join('');

  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Map of the commons: ${entries.length} entries and their connections" style="display:block">
<g stroke="#5d5378" stroke-width="0.6" opacity="0.5">${edges.join('')}</g>
${dots.join('')}
${legend}
</svg>`;
}

// --- Shared fragments ------------------------------------------------------

/** The kind, worn as a small colored chip — how a card says what it is. */
export function kindChip(kind: string): string {
  return `<span class="chip kc-${esc(kind)}">${esc(kindLabel(kind))}</span>`;
}

/** Class hook that gives a card its kind's top accent + text color tokens. */
export const kindClass = (kind: string): string => `kc kc-${kind}`;

export function entryCard(e: Entry, note?: string): string {
  return `<li class="card ${kindClass(e.kind)}">
<div class="k">${kindChip(e.kind)}${e.attribution?.neighborhood ? ` · ${esc(e.attribution.neighborhood)}` : ''}</div>
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
