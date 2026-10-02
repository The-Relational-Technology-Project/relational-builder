#!/usr/bin/env node
/**
 * Draft a Beautiful Trouble shelf for the RT Commons from the toolbox at
 * https://beautifultrouble.org/toolbox/, as a seed file for
 * seed-commons-shelf.mjs. Writes JSON only — nothing touches a database.
 *
 * The toolbox is a client-side app backed by a public JSON API: one index
 * (toolbox-lite.json, every tool's title/type/snapshot/tags, plus curated
 * sets) and one file per tool with the full write-up. We read the index,
 * fetch each tool politely (sequential, small delay), and map it onto the
 * commons kinds. The index also carries Beautiful Solutions (bsol-*), the
 * sister project on solidarity economies; it rides along, tagged as such.
 *
 *   node scripts/scrape-beautiful-trouble.mjs [out.json] [--no-solutions]
 *
 * Behind an HTTP proxy on Node 22, run with NODE_USE_ENV_PROXY=1.
 *
 * Content is CC BY-NC-SA 4.0 — every item carries that license, its author,
 * and a link back to its toolbox page. Non-commercial, share-alike: keep it
 * that way anywhere these items travel.
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.beautifultrouble.org/v2/en';
const SITE = 'https://beautifultrouble.org/toolbox';
const ASSETS = 'https://assets.beautifultrouble.org';
const LICENSE = 'CC BY-NC-SA 4.0';
const SHELF = 'beautiful-trouble';

const args = process.argv.slice(2);
const out = args.find(a => a.endsWith('.json')) ?? `scripts/seed/${SHELF}-commons.json`;
const includeSolutions = !args.includes('--no-solutions');

// Beautiful Trouble type → commons kind. The commons has no "principle" or
// "theory", so those are the judgment calls; the original type always rides
// along (tag bt-type:<type>, metadata.bt_type) so the shelf can show it.
const KIND_FOR_TYPE = {
  methodology: 'methodology',
  tactic: 'recipe',
  principle: 'framework',
  theory: 'reference',
  story: 'story',
  'bsol-value': 'framework',
  'bsol-principle': 'framework',
  'bsol-question': 'framework',
  'bsol-solution': 'recipe',
  'bsol-story': 'story',
};

// The toolbox's own "Organizing 101" set leads the shelf, in its curated order
const LEAD_SET = 'organizing-101';

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function getJson(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 3) throw new Error(`${url} → ${err.message}`);
      await sleep(1000 * attempt);
    }
  }
}

/** Toolbox-relative links (/tool/slug) → absolute toolbox URLs */
function absolutize(md) {
  return String(md ?? '')
    .replace(/\]\(\/tool\//g, `](${SITE}/tool/`)
    .trim();
}

function section(heading, text) {
  const t = absolutize(text);
  return t ? `\n\n## ${heading}\n\n${t}` : '';
}

function bodyFor(tool) {
  let body = absolutize(tool.write_up);
  const when = [tool.when, tool.where].filter(Boolean).join(', ');
  if (when) body = `*${when}*\n\n${body}`;
  body += section('Why it worked', tool.why_it_worked);
  body += section('How to use', tool.how_to_use);
  body += section('Potential risks', tool.potential_risks);
  return body.trim() || null;
}

/** related / key_tools come grouped by type: { story: [{ tool, title }], … } */
function slugsIn(grouped) {
  if (!grouped || typeof grouped !== 'object') return [];
  return Object.values(grouped).flat().map(r => r?.tool).filter(Boolean);
}

const index = await getJson(`${API}/toolbox-lite.json`);
const lead = index.sets?.[LEAD_SET] ?? [];
const leadRank = new Map(lead.map((slug, i) => [slug, i]));

const slugs = Object.keys(index.tools)
  .filter(slug => KIND_FOR_TYPE[index.tools[slug].type])
  .filter(slug => includeSolutions || !index.tools[slug].type.startsWith('bsol-'))
  .sort((a, b) => {
    const ra = leadRank.get(a) ?? Infinity;
    const rb = leadRank.get(b) ?? Infinity;
    if (ra !== rb) return ra - rb;
    const ta = index.tools[a];
    const tb = index.tools[b];
    return ta.type.localeCompare(tb.type) || ta.title.localeCompare(tb.title);
  });

// Which curated sets each tool belongs to
const setsFor = new Map();
for (const [set, members] of Object.entries(index.sets ?? {})) {
  for (const slug of members) setsFor.set(slug, [...(setsFor.get(slug) ?? []), set]);
}

console.error(`Fetching ${slugs.length} tools from the Beautiful Trouble toolbox…`);
const items = [];
const failed = [];
for (const [i, slug] of slugs.entries()) {
  const lite = index.tools[slug];
  let tool = lite;
  try {
    tool = { ...lite, ...(await getJson(`${API}/${slug}.json`)) };
  } catch (err) {
    failed.push(slug);
    console.error(`  ${slug}: ${err.message} (keeping the index snapshot)`);
  }
  const solutions = lite.type.startsWith('bsol-');
  const author = typeof tool.byline === 'string' && tool.byline.trim() ? tool.byline.trim() : null;
  const sets = setsFor.get(slug) ?? [];
  items.push({
    // bsol- slugs are already namespaced; the rest get bt- so they can't
    // collide with another shelf's slugs (the detail lookup is slug-only)
    slug: solutions ? slug : `bt-${slug}`,
    kind: KIND_FOR_TYPE[lite.type],
    title: String(tool.title).trim(),
    summary: absolutize(tool.snapshot) || null,
    body: bodyFor(tool),
    attribution: {
      name: solutions ? 'Beautiful Solutions (Beautiful Trouble)' : 'Beautiful Trouble',
      ...(author ? { author } : {}),
      source: 'Beautiful Trouble toolbox',
      license: LICENSE,
    },
    source_url: `${SITE}/tool/${slug}`,
    tags: [
      SHELF,
      ...(solutions ? ['beautiful-solutions'] : []),
      ...(lite.tags ?? []),
      `bt-type:${lite.type}`,
      ...sets.map(s => `set:${s}`),
      ...(lite.regions ?? []).map(r => `region:${r}`),
    ],
    image_urls: tool.image ? [`${ASSETS}/tile-${tool.image}`] : [],
    metadata: {
      bt_type: lite.type,
      ...(tool.when ? { when: tool.when } : {}),
      ...(tool.where ? { where: tool.where } : {}),
      related: [...new Set([...slugsIn(tool.key_tools), ...slugsIn(tool.related)])],
      learn_more: Array.isArray(tool.learn_more)
        ? tool.learn_more.filter(l => l?.link).map(l => ({ title: l.title, link: l.link }))
        : [],
    },
    license: LICENSE,
    sort_order: (i + 1) * 10,
  });
  if ((i + 1) % 50 === 0) console.error(`  ${i + 1}/${slugs.length}`);
  await sleep(150);
}

const seed = {
  studio: {
    slug: SHELF,
    display_name: 'Beautiful Trouble',
    home_url: `${SITE}/`,
    steward_email: 'humans@relationaltechproject.org',
    notes:
      'The Beautiful Trouble toolbox: tactics, principles, theories, methodologies, and stories of creative action, written by hundreds of organizers worldwide, plus Beautiful Solutions, its companion on solidarity economies. Shared under CC BY-NC-SA 4.0; each item links back to its toolbox page.',
  },
  items,
};
writeFileSync(out, JSON.stringify(seed, null, 2) + '\n');
console.error(`Wrote ${items.length} items to ${out}${failed.length ? ` (${failed.length} from snapshot only)` : ''}.`);
