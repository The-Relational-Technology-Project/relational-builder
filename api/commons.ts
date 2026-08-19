/**
 * The public face of the Civic Commons: /commons/... — server-rendered pages
 * for every substantial commons entry, theme pages to jam on with
 * colleagues, a story wall, a reading room, a search page over the whole
 * commons, and a map of how the whole thing connects. Built for the crawlers that don't run JavaScript (which
 * is most of the AI ones) as much as for people: semantic HTML, JSON-LD,
 * canonicals, a sitemap — and no client JS at all. Forms post; pages render.
 *
 * Reads the same public shelves the app reads. Notes and votes go through
 * the commons-guestbook Supabase function (service-role writes, rate
 * limited there).
 */

import {
  SITE, Entry, esc, kindLabel, entryPath, hasOwnPage, resolveSlugTarget,
  fetchAllSlim, fetchAllRefs, fetchEntry, fetchBySlugs, fetchRefsFor, renderMarkdown,
  qualifyAsset, monthKey, searchCommonsHybrid,
} from './_commons/shared';
import {
  page, FooterStats, constellation, entryCard, kindChip, kindClass, truncate, breadcrumbs, breadcrumbLd, fmtMonth, sparkline,
} from './_commons/render';
import { THEMES } from './_commons/themes';
import { LICENSE_INTRO, LICENSE_MD } from './_commons/license';

export const config = { runtime: 'edge' };

const GUESTBOOK_ORIGIN = 'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/commons-guestbook';

/** The commons review queue — contributions land pending, stewards get an email. */
const SUBMIT_ORIGIN = 'https://odowkowcinyoxejyzhwl.supabase.co/functions/v1/submit-contribution';

/** The commons in git — one markdown file per entry, mirrored nightly. */
const MIRROR_REPO = 'https://github.com/The-Relational-Technology-Project/relational-commons';

const CACHE_LONG = 'public, s-maxage=3600, stale-while-revalidate=86400';
const CACHE_SHORT = 'public, s-maxage=300, stale-while-revalidate=3600';

const SHELVES: Record<string, string> = {
  recipes: 'recipe', tools: 'tool', prompts: 'prompt',
  frameworks: 'framework', methodologies: 'methodology',
};

/** The four guides — shown as themselves, no metaphor needed. */
const GUIDES: [slug: string, title: string, blurb: string][] = [
  ['on-your-block', 'Community-Building on Your Block',
    'Block parties, welcome wagons, tool libraries — the practices that make a block a neighborhood, and where to start.'],
  ['civic-media', 'Civic Media for Your Neighborhood',
    'How information becomes care work at neighborhood scale — ten recipes and the worksheets to plan yours.'],
  ['organizing', 'Building Power with Your Neighbors',
    'Organizing in the Ganz tradition, hung on six questions — who are my people, what do we care about, what could we do together?'],
  ['neighborhood-civic-tech', 'Civic Tech at Neighborhood Scale',
    'Open tools remixable for your block — maps, ballots, mutual-aid stacks — and the design lessons from a decade of neighborhood tech.'],
];

const guideCards = (): string =>
  GUIDES.map(
    ([slug, title, blurb]) => `<li class="card"><h3><a href="/commons/themes/${slug}">${esc(title)}</a></h3>
<p>${esc(blurb)}</p></li>`,
  ).join('');
/** Human names for the source collections — internal slugs stay internal. */
const COLLECTION_LABEL: Record<string, string> = {
  'rtp-canonical': 'neighboring practices',
  'civic-media': 'civic media',
  'rt-studio': 'tool gallery',
  'community-organizing': 'community organizing',
  'local-civic-tech': 'local civic tech',
};
const collectionLabel = (slug: string): string =>
  COLLECTION_LABEL[slug] ?? slug.replace(/-/g, ' ');

const shelfPath = (kind: string): string =>
  kind === 'story' ? '/commons/stories'
  : kind === 'reference' ? '/commons/reading-room'
  : `/commons/${Object.entries(SHELVES).find(([, k]) => k === kind)?.[0] ?? ''}`;

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = (url.searchParams.get('path') ?? '').replace(/^\/+|\/+$/g, '');
  const seg = path === '' ? [] : path.split('/');

  try {
    if (req.method === 'POST' && seg[0] === 'themes' && seg[1]) {
      return await handleGuestbookPost(req, seg[1]);
    }
    if (req.method === 'POST' && seg[0] === 'contribute') {
      return await handleContributePost(req);
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405 });
    }

    if (seg.length === 0) return await homePage(url);
    if (seg[0] === 'search') return await searchPage(url);
    if (seg[0] === 'sitemap.xml') return await sitemap();
    if (seg[0] === 'llms.txt') return await llmsTxt();
    if (seg[0] === 'map') return await mapPage();
    if (seg[0] === 'license') return await licensePage();
    if (seg[0] === 'stories') return await storyWall(url);
    if (seg[0] === 'guides') return await guidesPage();
    if (seg[0] === 'reading-room') return await readingRoom();
    if (seg[0] === 'themes' && seg[1]) return await themePage(seg[1], url);
    if (seg[0] === 'e' && seg[1]) return await slugRedirect(seg[1]);
    if (seg[0] in SHELVES && seg.length === 1) return await shelfPage(seg[0]);
    if (seg.length === 2) return await entryPage(seg[0], seg[1]);

    return notFound();
  } catch (err) {
    return new Response(`Something went sideways rendering this page. ${esc(String(err))}`, {
      status: 500, headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
}

// --- Shared data -----------------------------------------------------------

async function commonsData() {
  const [all, refs] = await Promise.all([fetchAllSlim(), fetchAllRefs()]);
  const months = new Map<string, number>();
  for (const e of all) months.set(monthKey(e), (months.get(monthKey(e)) ?? 0) + 1);
  const cumulative: [string, number][] = [];
  let run = 0;
  for (const [m, n] of [...months].sort()) cumulative.push([m, (run += n)]);
  const footer: FooterStats = { entries: all.length, connections: refs.length, months: cumulative };
  const bySlug = new Map<string, Entry[]>();
  for (const e of all) {
    if (!bySlug.has(e.slug)) bySlug.set(e.slug, []);
    bySlug.get(e.slug)!.push(e);
  }
  return { all, refs, footer, bySlug };
}

const html = (body: string, cache = CACHE_LONG, status = 200) =>
  new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': cache },
  });

const redirect = (to: string) =>
  new Response(null, { status: 302, headers: { location: to, 'cache-control': CACHE_LONG } });

function notFound(): Response {
  return html(
    page(
      { title: 'Not found · The Civic Commons', description: 'No such page.', path: '/commons', noindex: true },
      `<h1>Not found</h1><p class="lede">Nothing lives at this address. Try the <a href="/commons">commons home</a> or the <a href="/commons/map">map</a>.</p>`,
      null,
    ),
    CACHE_SHORT, 404,
  );
}

// --- Contribute ------------------------------------------------------------

/**
 * Deb's invitation, on the pages themselves: a no-JS form that drops a link,
 * doc, or story from your neighborhood into the steward review queue. Same
 * queue the Builder's Contribute dialog feeds — stewards get an email and
 * tag it into the right collection; nothing goes public unreviewed.
 */
function contributeBox(backPath: string, posted: boolean): string {
  return `
<span class="eyebrow" id="contribute">Want to share a link or doc that highlights a story from your neighborhood?</span>
<p class="meta" style="max-width:44rem">Add your insights and learnings (and mistakes!) from your neighborhood
here. RTP Stewards will tag it to the appropriate Commons collection, gallery or studio. Then, your
contribution shapes the journey of other neighborhood stewards around the world!</p>
${posted ? `<p class="meta" style="color:var(--accent-ink)"><strong>Thank you — it's on its way to the stewards. 🧡</strong> A human reads every contribution before it joins the commons.</p>` : `
<form class="note-form" method="post" action="/commons/contribute" enctype="multipart/form-data">
<input type="hidden" name="back" value="${esc(backPath)}">
<input type="text" name="link" placeholder="https:// — the link or doc" maxlength="500">
<textarea name="note" rows="3" placeholder="What is it, and what did your neighborhood learn? (a sentence or two)" maxlength="1000"></textarea>
<input type="text" name="name" placeholder="Your name (credited in the commons)" maxlength="120" required>
<input type="text" name="email" placeholder="Email (optional — so a steward can reach you)" maxlength="200">
<label style="font-size:.85rem;color:var(--soft)">Photos <span style="opacity:.8">(optional — up to 4 images, 3MB total)</span><br>
<input type="file" name="images" accept="image/png,image/jpeg,image/webp,image/gif" multiple style="font:inherit;font-size:.85rem;margin-top:.25rem"></label>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<div><button class="cta" type="submit">Offer it to the commons</button></div>
</form>`}`;
}

async function handleContributePost(req: Request): Promise<Response> {
  const form = await req.formData();
  const back = String(form.get('back') ?? '/commons');
  // Only bounce back to our own commons pages
  const safeBack = back.startsWith('/commons') && !back.includes('//') ? back : '/commons';
  const thanks = new Response(null, {
    status: 303,
    headers: { location: `${safeBack}?contributed=1#contribute` },
  });

  // Honeypot filled → a bot; thank it politely and save the stewards' time
  if (String(form.get('website') ?? '').trim()) return thanks;

  const name = String(form.get('name') ?? '').slice(0, 120).trim();
  const link = String(form.get('link') ?? '').slice(0, 500).trim();
  const note = String(form.get('note') ?? '').slice(0, 1000).trim();
  const email = String(form.get('email') ?? '').slice(0, 200).trim();

  // Photos ride along as data URLs — submit-contribution hosts them and the
  // approved entry shows them. No client JS means no downscaling, so caps
  // are enforced here (and the platform's request-size limit above us).
  const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  const images: string[] = [];
  let imageBytes = 0;
  for (const f of form.getAll('images')) {
    if (images.length >= 4) break;
    if (!(f instanceof File) || f.size === 0 || !IMAGE_TYPES.has(f.type)) continue;
    if (f.size > 2.5 * 1024 * 1024 || imageBytes + f.size > 3.5 * 1024 * 1024) continue;
    imageBytes += f.size;
    const bytes = new Uint8Array(await f.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    images.push(`data:${f.type};base64,${btoa(bin)}`);
  }

  if (!name || (!link && !note && !images.length)) return thanks; // nothing to offer — just bounce

  let host = '';
  try { host = link ? new URL(link).hostname : ''; } catch { /* not a URL — travels in the note */ }
  const title = note
    ? note.split(/[.!?\n]/)[0].split(/\s+/).slice(0, 8).join(' ').slice(0, 150)
    : host ? `Neighborhood link: ${host}`
    : images.length ? `Photos from ${name}` : `A gift from ${name}`;

  await fetch(SUBMIT_ORIGIN, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contribution_type: 'story',
      title: title.length >= 3 ? title : `A gift from ${name}`,
      summary: note || (link ? `Shared through the commons page: ${link}` : `Photos shared through the commons page by ${name}.`),
      builder_name: name,
      images: images.length ? images : undefined,
      contact_email: email || undefined,
      source_url: link && host ? link : undefined,
      tags: ['commons-page', 'neighborhood-link'],
      submitted_via: 'commons-page',
    }),
  }).catch(() => null);

  return thanks;
}

// --- Home ------------------------------------------------------------------

async function homePage(url: URL): Promise<Response> {
  const { all, refs, footer } = await commonsData();
  const kinds = [...new Set(all.map(e => e.kind))];
  const counts = new Map(kinds.map(k => [k, all.filter(e => e.kind === k).length]));

  const featured = await fetchBySlugs([
    'welcome-wagon', 'block-stewards', 'community-stewarded-stories', 'tool-library',
  ]);
  const featuredCards = featured
    .filter(hasOwnPage)
    .map(e => entryCard(e))
    .join('');

  const kindCards = [
    ['recipe', 'Practices with steps — follow one on your block this month.'],
    ['tool', 'Working software from real neighborhoods, remixable in the Builder.'],
    ['story', 'What happened when real people tried this, in their words.'],
    ['prompt', 'Starting points for building your own version.'],
    ['framework', 'The thinking behind the practices, worksheets included.'],
    ['methodology', 'How the commons gets built — the process itself, documented.'],
    ['reference', 'The wider library: books, essays and projects we learn from.'],
  ]
    .filter(([k]) => counts.get(k as string))
    .map(([k, blurb]) => {
      // Each kind wears its color — accent bar and title ink — so the
      // catalog sections read as different kinds of thing at a glance.
      const n = counts.get(k as string)!;
      return `<li class="card ${kindClass(k as string)}">
<div class="k">${n} ${n === 1 ? 'entry' : 'entries'}</div>
<h3><a class="kc-title" href="${shelfPath(k as string)}">${esc(kindLabel(k as string, true))}</a></h3>
<p>${esc(blurb as string)}</p></li>`;
    })
    .join('');

  const body = `
${breadcrumbs([['The Civic Commons', '/commons']])}
<h1>A commons of ways to build community where you live</h1>
<p class="lede">${footer.entries} practices, tools, stories and ideas for strengthening the place
you live — contributed by neighbors and community builders, connected to each other,
credited to the people they came from, and free to remix in
<a href="/">Relational Builder</a>.</p>

<form class="search-hero" action="/commons/search" method="get" role="search">
<input type="search" name="q" placeholder="Search all ${footer.entries} entries — try &quot;block party&quot; or &quot;tool library&quot;…" aria-label="Search the commons">
<button class="cta" type="submit">Search</button>
</form>

<span class="eyebrow">Start with a guide</span>
<p class="meta" style="max-width:44rem">Each guide gathers the practices, tools and stories for one kind of
work — pick the one closest to what you're trying to do.</p>
<ul class="grid">${guideCards()}</ul>

<span class="eyebrow">Browse the whole catalog</span>
<ul class="grid">${kindCards}</ul>

<span class="eyebrow">Good first reads</span>
<ul class="grid">${featuredCards}</ul>

<span class="eyebrow">How it all connects</span>
<p class="meta" style="max-width:44rem">Every dot is an entry; every line is a connection a steward confirmed —
this practice used in that neighborhood, this tool descended from that one. The commons grows by
connection, not just addition.</p>
<div class="night">${constellation(all, refs, { width: 900, height: 420, links: true })}</div>
<p class="meta"><a href="/commons/map">Explore the full map and timeline →</a></p>

${contributeBox('/commons', url.searchParams.get('contributed') === '1')}

<div class="attach">
<p><strong>Want to add to the commons?</strong> Build something for your neighborhood in
<a href="/new">Relational Builder</a> and publish it back, or share a practice that works where you live —
the <a href="/gallery">gallery</a> shows what others have contributed. Every entry keeps its
contributor's name attached.</p>
</div>`;

  return html(
    page(
      {
        title: 'The Civic Commons — practices, tools & stories for building community',
        description: `${footer.entries} community-building practices, remixable neighborhood tools, and stories from real blocks — a shared, credited, remixable library stewarded by the Relational Technology Project.`,
        path: '/commons',
        jsonLd: [
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'The Civic Commons',
            description: 'A shared library of practices, tools and stories for building community where you live, stewarded by the Relational Technology Project.',
            url: `${SITE}/commons`,
            isPartOf: { '@type': 'WebSite', name: 'Relational Builder', url: SITE },
          },
        ],
      },
      body,
      footer,
    ),
    url.searchParams.get('contributed') === '1' ? 'no-store' : CACHE_LONG,
  );
}

// --- Guides ----------------------------------------------------------------

/** The four guides on one page — the nav's front door to the themes. */
async function guidesPage(): Promise<Response> {
  const { footer } = await commonsData();
  const trail: [string, string][] = [['The Civic Commons', '/commons'], ['Guides', '/commons/guides']];
  const body = `
${breadcrumbs(trail)}
<h1>Guides</h1>
<p class="lede">Four guides into the commons, each written around one kind of work: an editorial
point of view, the practices and tools that fit it, stories of real blocks that tried them, and
prompts to build your own. Start with the one closest to what you're trying to do.</p>
<ul class="grid" style="grid-template-columns:repeat(auto-fill,minmax(19rem,1fr))">${guideCards()}</ul>
<div class="attach">
<p>Not sure where to start? <a href="/commons/search">Search the whole commons</a>, browse the
<a href="/commons/map">map of everything</a>, or begin from the <a href="/commons">commons home</a>.</p>
</div>`;

  return html(
    page(
      {
        title: 'Guides · The Civic Commons',
        description:
          'Four guides for building community where you live: community-building on your block, civic media for your neighborhood, building power with your neighbors, and civic tech at neighborhood scale.',
        path: '/commons/guides',
        jsonLd: [
          breadcrumbLd(trail),
          {
            '@context': 'https://schema.org', '@type': 'CollectionPage',
            name: 'Guides · The Civic Commons', url: `${SITE}/commons/guides`,
            hasPart: GUIDES.map(([slug, title]) => ({
              '@type': 'CreativeWork', name: title, url: `${SITE}/commons/themes/${slug}`,
            })),
          },
        ],
      },
      body,
      footer,
    ),
  );
}

// --- Search ----------------------------------------------------------------

/** Where a search hit should land — its own page, or its anchor on a collection. */
function resultHref(e: Entry): string {
  if (hasOwnPage(e)) return entryPath(e);
  if (e.kind === 'reference') return `/commons/reading-room#${e.slug}`;
  if (e.kind === 'story') return `/commons/stories#${e.slug}`;
  return shelfPath(e.kind);
}

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Escape, then wrap the query's words in <mark> so matches read at a glance. */
function highlight(text: string, terms: string[]): string {
  const safe = esc(text);
  if (!terms.length) return safe;
  const pattern = terms.map(t => escapeRe(esc(t))).filter(Boolean).join('|');
  if (!pattern) return safe;
  return safe.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

/**
 * One search box over the whole commons. Two passes, merged: the hybrid
 * semantic+full-text edge function ranks by meaning first, then a plain
 * word-match sweep over every entry's title, summary, tags and attribution
 * catches anything retrieval missed — so the search is thorough even when
 * the edge function is unreachable. No JS: the form GETs, the page renders.
 */
async function searchPage(url: URL): Promise<Response> {
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 200);
  const [{ all, footer, bySlug }, hybrid] = await Promise.all([
    commonsData(),
    q ? searchCommonsHybrid(q, 40) : Promise.resolve([]),
  ]);

  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  const keyOf = (e: Entry) => `${e.kind}/${e.slug}`;
  const haystack = (e: Entry) =>
    [
      e.title, e.summary, e.attribution?.name, e.attribution?.neighborhood,
      e.attribution?.source, ...(e.tags ?? []), kindLabel(e.kind),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

  // Semantic rank leads; hits resolve to canonical entries by slug (+kind).
  const seen = new Set<string>();
  const results: Entry[] = [];
  for (const h of hybrid) {
    const candidates = bySlug.get(h.slug) ?? [];
    const e = candidates.find(c => c.kind === h.kind) ?? candidates[0];
    if (!e || seen.has(keyOf(e))) continue;
    seen.add(keyOf(e));
    results.push(e);
  }

  // Word-match sweep over everything — title matches surface first.
  if (terms.length) {
    const titleHit = (e: Entry) => terms.some(t => e.title.toLowerCase().includes(t));
    const rest = all
      .filter(e => !seen.has(keyOf(e)))
      .filter(e => {
        const h = haystack(e);
        return terms.every(t => h.includes(t));
      })
      .sort((a, b) =>
        (titleHit(a) ? 0 : 1) - (titleHit(b) ? 0 : 1) || (a.title < b.title ? -1 : 1),
      );
    results.push(...rest);
  }

  const resultCard = (e: Entry): string => {
    const who = [e.attribution?.name, e.attribution?.neighborhood].filter(Boolean).join(', ');
    return `<li class="card ${kindClass(e.kind)}">
<div class="k">${kindChip(e.kind)}${who ? ` · ${esc(who)}` : ''}</div>
<h3><a href="${resultHref(e)}">${highlight(e.title, terms)}</a></h3>
${e.summary ? `<p>${highlight(truncate(e.summary, 160), terms)}</p>` : ''}
</li>`;
  };

  const SHOWN = 100;
  const resultsHtml = !q
    ? `<p class="meta" style="max-width:44rem">Search by name, topic, place or person — or describe what you're
trying to do (“welcome new neighbors”, “share tools on my block”) and the commons will look for
practices that fit, even when no entry uses your exact words. Or start from the
<a href="/commons/map">map</a>, the <a href="/commons/stories">story wall</a>, or the
<a href="/commons/reading-room">reading room</a>.</p>`
    : results.length === 0
      ? `<p class="meta" style="max-width:44rem">Nothing in the commons matches “${esc(q)}”. Try fewer or
different words, or browse the <a href="/commons/map">map of everything</a> and the collections on
the <a href="/commons">commons home</a>.</p>`
      : `<p class="meta">${results.length} ${results.length === 1 ? 'entry matches' : 'entries match'} “${esc(q)}”${
          results.length > SHOWN ? ` — showing the first ${SHOWN}` : ''
        }.</p>
<ul class="grid">${results.slice(0, SHOWN).map(resultCard).join('')}</ul>`;

  const trail: [string, string][] = [['The Civic Commons', '/commons'], ['Search', '/commons/search']];
  const body = `
${breadcrumbs(trail)}
<h1>Search the commons</h1>
<p class="lede">One search across the whole catalog — recipes, tools, stories, prompts, frameworks,
methodologies and the reading room. ${footer.entries} entries, all of them.</p>
<form class="search-hero" action="/commons/search" method="get" role="search">
<input type="search" name="q" value="${esc(q)}" placeholder="Try &quot;block party&quot;, &quot;tool library&quot;, or describe what you want to do…" aria-label="Search the commons" autofocus>
<button class="cta" type="submit">Search</button>
</form>
${resultsHtml}`;

  return html(
    page(
      {
        title: q ? `“${q}” · Search · The Civic Commons` : 'Search · The Civic Commons',
        description:
          'Search the whole RT Commons — community-building practices, remixable neighborhood tools, stories, prompts and references — by keyword or by meaning.',
        path: '/commons/search',
        noindex: !!q,
        jsonLd: [breadcrumbLd(trail)],
      },
      body,
      footer,
    ),
    CACHE_SHORT,
  );
}

// --- Map & timeline --------------------------------------------------------

async function mapPage(): Promise<Response> {
  const { all, refs, footer } = await commonsData();
  const months = footer.months;
  const monthRows = months
    .map(([m, cum], i) => {
      const added = cum - (months[i - 1]?.[1] ?? 0);
      return `<tr><td>${esc(fmtMonth(m))}</td><td style="text-align:right">+${added}</td><td style="text-align:right">${cum}</td></tr>`;
    })
    .join('');

  const body = `
${breadcrumbs([['The Civic Commons', '/commons'], ['Map & timeline', '/commons/map']])}
<h1>The shape of the commons</h1>
<p class="lede">${all.length} entries, ${refs.length} steward-confirmed connections between them.
Five collections feed it: canonical neighboring practices, the Civic Media Cookbook,
the tool gallery, community organizing, and local civic tech — one commons, woven
together.</p>
<div class="night">${constellation(all, refs, { width: 1000, height: 640, links: true })}</div>
<p class="meta">Every dot links to its entry. Larger dots are connected to something —
a lineage parent, a story that mentions them, a practice they pair with.</p>

<span class="eyebrow">How it grew</span>
<p class="meta" style="max-width:44rem">Seeded ${esc(fmtMonth(months[0]?.[0]))} with the RTP's core library,
growing as neighborhoods contribute practices, publish tools, and stewards weave in new connections.</p>
<div class="card" style="max-width:30rem">
${sparkline(months)}
<table style="width:100%;border-collapse:collapse;font-size:.9rem;margin-top:.5rem">
<thead><tr style="text-align:left;color:var(--soft)"><th>Month</th><th style="text-align:right">Added</th><th style="text-align:right">Total</th></tr></thead>
<tbody>${monthRows}</tbody></table>
</div>`;

  return html(
    page(
      {
        title: 'Map & timeline · The Civic Commons',
        description: `A living map of the Civic Commons: ${all.length} entries and ${refs.length} connections between practices, tools and stories — and how the ecosystem has grown.`,
        path: '/commons/map',
        wide: true,
        jsonLd: [breadcrumbLd([['The Civic Commons', '/commons'], ['Map & timeline', '/commons/map']])],
      },
      body,
      footer,
    ),
  );
}

// --- License ---------------------------------------------------------------

async function licensePage(): Promise<Response> {
  const { footer } = await commonsData();
  const trail: [string, string][] = [['The Civic Commons', '/commons'], ['License', '/commons/license']];
  const body = `
${breadcrumbs(trail)}
<h1>Reciprocal Commons License v1.0</h1>
${LICENSE_INTRO.map((p, i) => `<p class="${i === 0 ? 'lede' : 'meta'}" style="max-width:44rem">${esc(p)}</p>`).join('')}
<div class="prose">${renderMarkdown(LICENSE_MD)}</div>
<div class="attach">
<p>The canonical text of this license lives in the
<a href="https://github.com/The-Relational-Technology-Project/neighboring-recipes/blob/main/LICENSE.md" rel="noopener">Neighboring Recipes repository</a>,
where it was first published. Questions about whether your use needs permission:
<a href="mailto:commons@relationaltechproject.org">commons@relationaltechproject.org</a>.</p>
</div>`;

  return html(
    page(
      {
        title: 'Reciprocal Commons License (RCL-1.0) · The Civic Commons',
        description: 'The license the Civic Commons is shared under: free for neighbors, communities and place-based organizations; commercial platforms, services and AI systems need permission. Credit travels with the work.',
        path: '/commons/license',
        jsonLd: [breadcrumbLd(trail)],
      },
      body,
      footer,
    ),
  );
}

// --- Shelves ---------------------------------------------------------------

async function shelfPage(plural: string): Promise<Response> {
  const kind = SHELVES[plural];
  const { all, footer } = await commonsData();
  const entries = all.filter(e => e.kind === kind);
  if (!entries.length) return notFound();
  const label = kindLabel(kind, true);

  const blurbs: Record<string, string> = {
    recipe: 'Practices with steps: what it is, why it works, how to run it where you live. Every recipe names who it came from.',
    tool: 'Working software built by and for real neighborhoods. Each one can be remixed in Relational Builder — describe your block and the tool adapts.',
    prompt: 'Starting points: describe-what-you-want prompts that become working tools in the Builder.',
    framework: 'The thinking underneath the practices — models, worksheets, and ways of seeing a neighborhood.',
    methodology: 'How the Relational Technology Project builds: the process itself, documented and reusable.',
  };

  const cards = entries.map(e => entryCard(e)).join('');
  const trail: [string, string][] = [['The Civic Commons', '/commons'], [label, `/commons/${plural}`]];
  const body = `
${breadcrumbs(trail)}
<h1>${esc(label)}</h1>
<p class="lede">${esc(blurbs[kind] ?? '')} ${entries.length} in this collection.</p>
<ul class="grid">${cards}</ul>`;

  return html(
    page(
      {
        title: `${label} · The Civic Commons`,
        description: `${entries.length} ${label.toLowerCase()} in the Civic Commons. ${blurbs[kind] ?? ''}`,
        path: `/commons/${plural}`,
        jsonLd: [
          breadcrumbLd(trail),
          {
            '@context': 'https://schema.org', '@type': 'CollectionPage',
            name: `${label} · The Civic Commons`, url: `${SITE}/commons/${plural}`,
            hasPart: entries.slice(0, 50).map(e => ({
              '@type': 'CreativeWork', name: e.title, url: `${SITE}${entryPath(e)}`,
            })),
          },
        ],
      },
      body,
      footer,
    ),
  );
}

// --- Story wall ------------------------------------------------------------

async function storyWall(url: URL): Promise<Response> {
  const { all, footer } = await commonsData();
  const stories = (await fetchBySlugs(
    all.filter(e => e.kind === 'story').map(e => e.slug),
  )).filter(e => e.kind === 'story')
    .sort((a, b) => (a.title < b.title ? -1 : 1));

  const items = stories
    .map(e => {
      const text = (e.body ?? e.summary ?? '').trim();
      const own = hasOwnPage(e);
      const who = [e.attribution?.name, e.attribution?.neighborhood].filter(Boolean).join(', ');
      return `<li class="card" id="${esc(e.slug)}">
<h3>${own ? `<a href="${entryPath(e)}">${esc(e.title)}</a>` : esc(e.title)}</h3>
<p style="font-size:.95rem;color:var(--ink)">${esc(own ? truncate(text, 260) : text)}</p>
${who ? `<p class="meta">— ${esc(who)}</p>` : ''}
${own ? `<p class="meta"><a href="${entryPath(e)}">Read the whole story →</a></p>` : ''}
</li>`;
    })
    .join('');

  const trail: [string, string][] = [['The Civic Commons', '/commons'], ['Stories', '/commons/stories']];
  const body = `
${breadcrumbs(trail)}
<h1>Stories from the field</h1>
<p class="lede">${stories.length} accounts of what actually happened when people tried these practices —
in their own words, with their names on them. The short ones live here whole; the longer ones
open into their own pages.</p>
<ul class="grid">${items}</ul>

${contributeBox('/commons/stories', url.searchParams.get('contributed') === '1')}`;

  return html(
    page(
      {
        title: 'Stories from the field · The Civic Commons',
        description: `${stories.length} first-hand stories of community-building practices tried on real blocks — from block parties to care webs, told by the people who did them.`,
        path: '/commons/stories',
        jsonLd: [breadcrumbLd(trail)],
      },
      body,
      footer,
    ),
    url.searchParams.get('contributed') === '1' ? 'no-store' : CACHE_LONG,
  );
}

// --- Reading room ----------------------------------------------------------

async function readingRoom(): Promise<Response> {
  const { all, footer } = await commonsData();
  const refs = all.filter(e => e.kind === 'reference');

  // Group by leading tag; loose buckets beat 208 flat rows.
  const groups = new Map<string, Entry[]>();
  for (const r of refs) {
    const g = r.tags?.[0] ?? 'more';
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(r);
  }
  const sections = [...groups]
    .sort((a, b) => b[1].length - a[1].length)
    .map(
      ([tag, items]) => `<h2 style="font-size:1.2rem;margin:2rem 0 .6rem;text-transform:capitalize">${esc(tag.replace(/-/g, ' '))} <span class="meta">(${items.length})</span></h2>
<ul style="list-style:none;padding:0;display:grid;gap:.55rem">${items
        .map(
          r => `<li class="card" id="${esc(r.slug)}" style="padding:.7rem 1rem">
<h3 style="font-size:.98rem;margin:0">${
            r.source_url
              ? `<a href="${esc(r.source_url)}" rel="noopener">${esc(r.title)}</a>`
              : esc(r.title)
          }</h3>
${r.summary ? `<p style="margin:.2rem 0 0">${esc(truncate(r.summary, 200))}</p>` : ''}
</li>`,
        )
        .join('')}</ul>`,
    )
    .join('');

  const trail: [string, string][] = [['The Civic Commons', '/commons'], ['Reading room', '/commons/reading-room']];
  const body = `
${breadcrumbs(trail)}
<h1>The reading room</h1>
<p class="lede">${refs.length} books, essays, projects and organizations the commons learns from.
These are other people's work — each link goes to the original, where it belongs. They're here
because the practices in the commons cite them.</p>
${sections}`;

  return html(
    page(
      {
        title: 'The reading room · The Civic Commons',
        description: `${refs.length} curated references on neighboring, mutual aid, civic media and community resilience — the library behind the Civic Commons, linked to the originals.`,
        path: '/commons/reading-room',
        jsonLd: [breadcrumbLd(trail)],
      },
      body,
      footer,
    ),
  );
}

// --- Entry pages -----------------------------------------------------------

async function slugRedirect(slug: string): Promise<Response> {
  const { bySlug } = await commonsData();
  return redirect(resolveSlugTarget(bySlug.get(slug) ?? []));
}

async function entryPage(kind: string, slug: string): Promise<Response> {
  const entry = await fetchEntry(kind, slug);
  if (!entry) return notFound();
  if (!hasOwnPage(entry)) {
    const { bySlug } = await commonsData();
    return redirect(resolveSlugTarget((bySlug.get(slug) ?? []).filter(e => e.kind === kind)));
  }

  const [{ all, footer, bySlug }, refs] = await Promise.all([commonsData(), fetchRefsFor(slug)]);

  // Lineage: resolve parent (never self — colliding slugs), collect children.
  const parent = entry.parent_slug
    ? (bySlug.get(entry.parent_slug) ?? []).find(e => e.id !== entry.id) ?? null
    : null;
  const children = all.filter(
    e => e.parent_slug === entry.slug && e.id !== entry.id,
  );

  // Confirmed cross-references, both directions, deduped, excluding lineage dupes.
  const linked = new Map<string, { title: string; href: string; relation: string; dir: 'out' | 'in' }>();
  for (const r of refs) {
    const outbound = r.from_source === 'commons' && r.from_id === slug;
    const oSource = outbound ? r.to_source : r.from_source;
    const oId = outbound ? r.to_id : r.from_id;
    const oTitle = outbound ? r.to_title : r.from_title;
    if (oId === slug && oSource === 'commons') continue;
    const href =
      oSource === 'commons'
        ? `/commons/e/${oId}`
        : `https://studio.relationaltechproject.org/library?item=${oId}`;
    linked.set(`${oSource}:${oId}`, { title: oTitle, href, relation: r.relation, dir: outbound ? 'out' : 'in' });
  }

  const related = all
    .filter(
      e =>
        e.id !== entry.id && hasOwnPage(e) &&
        (e.tags ?? []).some(t => (entry.tags ?? []).includes(t)),
    )
    .slice(0, 5);

  const RELATION_LABEL: Record<string, [string, string]> = {
    mentions: ['Mentions', 'Mentioned in'],
    used_in: ['Used in', 'Uses'],
    paired_with: ['Paired with', 'Paired with'],
    related: ['Related to', 'Related to'],
  };

  const connectionItems = [
    ...(parent
      ? [`<li class="card"><div class="k">Grew from</div><h3><a href="${entryPath(parent)}">${esc(parent.title)}</a></h3></li>`]
      : []),
    ...children.map(
      c => `<li class="card"><div class="k">Grew into</div><h3><a href="/commons/e/${esc(c.slug)}">${esc(c.title)}</a></h3></li>`,
    ),
    ...[...linked.values()].map(
      l => `<li class="card"><div class="k">${esc((RELATION_LABEL[l.relation] ?? [l.relation, l.relation])[l.dir === 'out' ? 0 : 1])}</div><h3><a href="${esc(l.href)}">${esc(l.title)}</a></h3></li>`,
    ),
  ];

  const meta = Object.entries(entry.metadata ?? {}).filter(
    ([k, v]) => v !== null && v !== undefined && v !== '' && v !== false && k !== 'source_const',
  );
  const links: string[] = [];
  const m = entry.metadata ?? {};
  if (typeof m.hosted_url === 'string') links.push(`<a class="cta ghost" href="${esc(m.hosted_url)}" rel="noopener">Visit the live tool</a>`);
  if (typeof m.github_url === 'string') links.push(`<a class="cta ghost" href="${esc(m.github_url)}" rel="noopener">Source on GitHub</a>`);

  const images = (entry.image_urls ?? [])
    .map(qualifyAsset)
    .filter((u): u is string => !!u)
    .slice(0, 2)
    .map(u => `<p><img src="${esc(u)}" alt="${esc(entry.title)}" loading="lazy" style="max-width:100%;border-radius:10px;border:1px solid var(--line)"></p>`)
    .join('');

  const credit = [
    entry.attribution?.name && `Contributed by <strong>${esc(entry.attribution.name)}</strong>`,
    entry.attribution?.neighborhood && esc(entry.attribution.neighborhood),
    entry.attribution?.source && esc(entry.attribution.source),
  ]
    .filter(Boolean)
    .join(' · ');

  const licenseHtml =
    entry.license === 'RCL-1.0'
      ? `<a href="/commons/license" title="Reciprocal Commons License v1.0">RCL-1.0</a>`
      : entry.license
        ? esc(entry.license)
        : '';

  const isCivicDerived =
    entry.source_studio_slug === 'civic-media' &&
    !!entry.source_url && entry.source_url.includes('newsfutures.org');

  const shelfLabel = kindLabel(entry.kind, true);
  const trail: [string, string][] = [
    ['The Civic Commons', '/commons'],
    [shelfLabel, shelfPath(entry.kind)],
    [entry.title, entryPath(entry)],
  ];

  const tagPills = (entry.tags ?? [])
    .map(t => `<span class="pill">${esc(t)}</span>`)
    .join('');

  const body = `
${breadcrumbs(trail)}
<div class="k" style="color:var(--soft);font-size:.85rem">${kindChip(entry.kind)}${entry.source_studio_slug ? ` · from the ${esc(collectionLabel(entry.source_studio_slug))} collection` : ''}</div>
<h1>${esc(entry.title)}</h1>
${entry.summary ? `<p class="lede">${esc(entry.summary)}</p>` : ''}
${links.length ? `<p>${links.join(' ')}</p>` : ''}
${images}
<div class="prose">${renderMarkdown(entry.body ?? '')}</div>
${meta.length ? `<div class="prose"><h2>Details</h2><ul>${meta
    .map(([k, v]) => `<li><strong>${esc(k.replace(/_/g, ' '))}:</strong> ${esc(Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : String(v))}</li>`)
    .join('')}</ul></div>` : ''}
${connectionItems.length ? `<span class="eyebrow">Connected in the commons</span><ul class="grid">${connectionItems.join('')}</ul>` : ''}
${related.length ? `<span class="eyebrow">Related by topic</span><ul class="grid">${related.map(e => entryCard(e)).join('')}</ul>` : ''}
<div class="attach">
${credit ? `<p>${credit}${licenseHtml ? ` · ${licenseHtml}` : ''}</p>` : licenseHtml ? `<p>${licenseHtml}</p>` : ''}
${entry.source_url ? `<p>Original source: <a href="${esc(entry.source_url)}" rel="noopener">${esc(entry.source_url)}</a></p>` : ''}
<p>See something to fix or add? <a href="${MIRROR_REPO}/edit/main/content/${esc(entry.kind)}/${esc(entry.slug)}.md" rel="noopener">Suggest an edit on GitHub</a> —
the commons <a href="${MIRROR_REPO}" rel="noopener">lives in git</a> too, and its history is the changelog.</p>
<p>${tagPills}</p>
<p style="margin-top:1rem"><a class="cta" href="/new">Remix this in Relational Builder</a>
&nbsp;<a class="cta ghost" href="/commons">Browse the commons</a></p>
</div>`;

  const ld: object[] = [breadcrumbLd(trail)];
  if (entry.kind === 'tool') {
    ld.push({
      '@context': 'https://schema.org', '@type': 'SoftwareApplication',
      name: entry.title, description: entry.summary ?? undefined,
      url: `${SITE}${entryPath(entry)}`,
      applicationCategory: 'Community software',
      operatingSystem: 'Web',
      ...(typeof m.hosted_url === 'string' ? { installUrl: m.hosted_url } : {}),
      ...(entry.attribution?.name ? { author: { '@type': 'Person', name: entry.attribution.name } } : {}),
      ...(entry.license === 'RCL-1.0' ? { license: `${SITE}/commons/license` } : {}),
    });
  } else {
    ld.push({
      '@context': 'https://schema.org', '@type': 'Article',
      headline: entry.title,
      description: entry.summary ?? undefined,
      url: `${SITE}${entryPath(entry)}`,
      datePublished: entry.published_at ?? entry.created_at,
      dateModified: entry.updated_at ?? entry.created_at,
      author: entry.attribution?.name
        ? { '@type': 'Person', name: entry.attribution.name }
        : { '@type': 'Organization', name: 'Relational Technology Project', url: 'https://relationaltechproject.org' },
      publisher: { '@type': 'Organization', name: 'Relational Technology Project', url: 'https://relationaltechproject.org' },
      ...(entry.source_url ? { isBasedOn: entry.source_url } : {}),
      ...(entry.license
        ? { license: entry.license === 'RCL-1.0' ? `${SITE}/commons/license` : entry.license }
        : {}),
    });
  }

  return html(
    page(
      {
        title: `${entry.title} · ${kindLabel(entry.kind)} · The Civic Commons`,
        description: truncate(
          entry.summary ?? (entry.body ?? '').replace(/\s+/g, ' ').trim(),
          158,
        ),
        path: entryPath(entry),
        // Derived civic-media entries point their canonical at the original.
        canonical: isCivicDerived ? entry.source_url! : undefined,
        jsonLd: ld,
      },
      body,
      footer,
    ),
  );
}

// --- Themes ----------------------------------------------------------------

interface GuestbookData {
  notes: { name: string; note: string; created_at: string }[];
  votes: Record<string, number>;
}

async function fetchGuestbook(pageSlug: string): Promise<GuestbookData> {
  try {
    const res = await fetch(`${GUESTBOOK_ORIGIN}?page=${encodeURIComponent(pageSlug)}`, {
      headers: { accept: 'application/json' },
    });
    if (!res.ok) throw new Error(String(res.status));
    return (await res.json()) as GuestbookData;
  } catch {
    return { notes: [], votes: {} };
  }
}

async function themePage(slug: string, url: URL): Promise<Response> {
  const theme = THEMES[slug];
  if (!theme) return notFound();

  const allSlugs = [...new Set(theme.sections.flatMap(s => s.slugs))];
  const [{ footer }, entries, guestbook] = await Promise.all([
    commonsData(), fetchBySlugs(allSlugs), fetchGuestbook(slug),
  ]);
  const bySlug = new Map<string, Entry>();
  // Prefer page-worthy kind when a slug matches multiple entries.
  for (const e of entries) {
    const cur = bySlug.get(e.slug);
    if (!cur || (!hasOwnPage(cur) && hasOwnPage(e))) bySlug.set(e.slug, e);
  }

  const sections = theme.sections
    .map(sec => {
      const cards = sec.slugs
        .map(s => bySlug.get(s))
        .filter((e): e is Entry => !!e)
        .map(e => entryCard(e, sec.notes?.[e.slug]))
        .join('');
      return `<span class="eyebrow">${esc(sec.heading)}</span>
<p class="meta" style="max-width:44rem">${esc(sec.blurb)}</p>
<ul class="grid">${cards}</ul>`;
    })
    .join('');

  const voteTotal = theme.voteSlugs.reduce((n, s) => n + (guestbook.votes[s] ?? 0), 0);
  const voteRows = theme.voteSlugs
    .map(s => {
      const e = bySlug.get(s);
      if (!e) return '';
      const n = guestbook.votes[s] ?? 0;
      const pct = voteTotal ? Math.round((n / voteTotal) * 100) : 0;
      return `<li style="display:flex;flex-wrap:wrap;align-items:center;gap:.35rem .7rem;padding:.35rem 0">
<form class="vote" method="post" action="/commons/themes/${esc(slug)}">
<input type="hidden" name="action" value="vote"><input type="hidden" name="item" value="${esc(s)}">
<button class="vote-btn" type="submit">+1</button></form>
<a href="${entryPath(e)}" style="text-decoration:none;flex:1 1 10rem;min-width:0">${esc(e.title)}</a>
<span class="meta" style="margin-left:auto;white-space:nowrap">${n ? `${n} vote${n === 1 ? '' : 's'} · ${pct}%` : 'no votes yet'}</span>
</li>`;
    })
    .join('');

  const notes = guestbook.notes
    .map(
      n => `<li><div class="who">${esc(n.name)} · ${esc(n.created_at.slice(0, 10))}</div>
<p class="txt">${esc(n.note)}</p></li>`,
    )
    .join('');

  const posted = url.searchParams.get('posted');
  const examples = theme.examples
    .map(
      x => `<li class="card"><div class="k">${esc(x.place)}</div>
<h3><a href="${esc(x.url)}" rel="noopener">${esc(x.name)}</a></h3><p>${esc(x.note)}</p></li>`,
    )
    .join('');

  const trail: [string, string][] = [
    ['The Civic Commons', '/commons'],
    [theme.title, `/commons/themes/${slug}`],
  ];

  const body = `
${breadcrumbs(trail)}
<span class="eyebrow" style="margin-top:.4rem">${esc(theme.eyebrow)}</span>
<h1>${esc(theme.title)}</h1>
${theme.intro.map(p => `<p class="lede" style="font-size:1.08rem">${esc(p)}</p>`).join('')}
${sections}
${examples ? `<span class="eyebrow">Out in the world</span><ul class="grid">${examples}</ul>` : ''}

<span class="eyebrow" id="vote">${esc(theme.votePrompt)}</span>
<div class="card" style="max-width:34rem"><ul style="list-style:none;margin:0;padding:0">${voteRows}</ul></div>

<span class="eyebrow" id="notes">Notes from visitors</span>
<p class="meta" style="max-width:44rem">${esc(theme.notesPrompt)}</p>
${posted === 'note' ? `<p class="meta" style="color:var(--accent-ink)"><strong>Thanks — your note is up. 🧡</strong></p>` : ''}
${posted === 'vote' ? `<p class="meta" style="color:var(--accent-ink)"><strong>Counted. 🧡</strong></p>` : ''}
${notes ? `<ul class="notes">${notes}</ul>` : `<p class="meta">No notes yet — the wall is fresh paint. Leave the first one.</p>`}
<form class="note-form" method="post" action="/commons/themes/${esc(slug)}" style="margin-top:1rem">
<input type="hidden" name="action" value="note">
<input type="text" name="name" placeholder="Your name (shown with your note)" maxlength="40" required>
<textarea name="note" rows="3" placeholder="Your note…" maxlength="280" required></textarea>
<input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
<div><button class="cta" type="submit">Leave a note</button></div>
</form>

${theme.related?.length ? `<div class="attach"><p><strong>Keep going:</strong> ${theme.related
    .map(r => `<a href="${esc(r.href)}">${esc(r.label)}</a>`)
    .join(' · ')}</p></div>` : ''}`;

  return html(
    page(
      {
        title: `${theme.title} · The Civic Commons`,
        description: theme.description,
        path: `/commons/themes/${slug}`,
        jsonLd: [
          breadcrumbLd(trail),
          {
            '@context': 'https://schema.org', '@type': 'CollectionPage',
            name: theme.title, description: theme.description,
            url: `${SITE}/commons/themes/${slug}`,
          },
        ],
      },
      body,
      footer,
    ),
    posted ? 'no-store' : CACHE_SHORT,
  );
}

async function handleGuestbookPost(req: Request, slug: string): Promise<Response> {
  if (!THEMES[slug]) return notFound();
  const form = await req.formData();
  const action = String(form.get('action') ?? '');
  const ip =
    req.headers.get('x-real-ip') ??
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() ?? 'unknown';
  const ipHash = await sha256(`rb-commons·${ip}`);

  const payload =
    action === 'vote'
      ? { action, page: slug, item: String(form.get('item') ?? ''), ip_hash: ipHash }
      : {
          action: 'note', page: slug, ip_hash: ipHash,
          name: String(form.get('name') ?? '').slice(0, 40),
          note: String(form.get('note') ?? '').slice(0, 280),
          website: String(form.get('website') ?? ''), // honeypot travels along
        };

  await fetch(GUESTBOOK_ORIGIN, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  return new Response(null, {
    status: 303,
    headers: {
      location: `/commons/themes/${slug}?posted=${action === 'vote' ? 'vote' : 'note'}#${action === 'vote' ? 'vote' : 'notes'}`,
    },
  });
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

// --- Sitemap & llms.txt ----------------------------------------------------

async function sitemap(): Promise<Response> {
  const { all } = await commonsData();
  // Story page-worthiness needs body length, which the slim fetch omits.
  const fullStories = await fetchBySlugs(all.filter(e => e.kind === 'story').map(e => e.slug));
  const storyPages = new Set(
    fullStories.filter(e => e.kind === 'story' && hasOwnPage(e)).map(e => e.slug),
  );
  const staticPages = [
    '/commons', '/commons/guides', '/commons/search', '/commons/map', '/commons/stories', '/commons/reading-room', '/commons/license',
    ...Object.keys(SHELVES).map(p => `/commons/${p}`),
    ...Object.keys(THEMES).map(t => `/commons/themes/${t}`),
  ];
  const urls = [
    ...staticPages.map(p => `<url><loc>${SITE}${p}</loc></url>`),
    ...all
      .filter(e => (e.kind === 'story' ? storyPages.has(e.slug) : hasOwnPage(e)))
      .map(
        e =>
          `<url><loc>${SITE}${entryPath(e)}</loc>${e.updated_at ? `<lastmod>${e.updated_at.slice(0, 10)}</lastmod>` : ''}</url>`,
      ),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
    { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': CACHE_LONG } },
  );
}

async function llmsTxt(): Promise<Response> {
  const { all, refs } = await commonsData();
  const byKind = new Map<string, Entry[]>();
  for (const e of all.filter(hasOwnPage)) {
    if (!byKind.has(e.kind)) byKind.set(e.kind, []);
    byKind.get(e.kind)!.push(e);
  }
  const lines = [
    '# The Civic Commons',
    '',
    `> A shared library of practices, tools and stories for building community where you live, stewarded by the Relational Technology Project: ${all.length} community-building practices, remixable neighborhood tools, first-hand stories and references — contributed by neighbors, connected by stewards (${refs.length} confirmed connections), licensed for remix with attribution under the Reciprocal Commons License ([RCL-1.0](${SITE}/commons/license)).`,
    '',
    `Guides ([index](${SITE}/commons/guides)): [Community-Building on Your Block](${SITE}/commons/themes/on-your-block), [Civic Media for Your Neighborhood](${SITE}/commons/themes/civic-media), [Building Power with Your Neighbors](${SITE}/commons/themes/organizing), [Civic Tech at Neighborhood Scale](${SITE}/commons/themes/neighborhood-civic-tech). Map of the whole commons: [Map & timeline](${SITE}/commons/map).`,
    '',
    `The whole commons is also mirrored to git — one markdown file per entry plus machine-readable commons.json and connections.json: ${MIRROR_REPO}`,
    '',
    ...[...byKind].flatMap(([kind, entries]) => [
      `## ${kindLabel(kind, true)}`,
      '',
      ...entries.map(
        e => `- [${e.title}](${SITE}${entryPath(e)})${e.summary ? `: ${truncate(e.summary.replace(/\s+/g, ' '), 120)}` : ''}`,
      ),
      '',
    ]),
  ];
  return new Response(lines.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': CACHE_LONG },
  });
}
