#!/usr/bin/env node
/**
 * Draft an Organizing studio library from the Beautiful Trouble toolbox
 * (https://beautifultrouble.org/toolbox/), as a seed file for
 * seed-studio-library.mjs. Writes JSON only — nothing touches a database.
 *
 * The toolbox is a client-side app backed by a public JSON API: one index
 * (toolbox-lite.json, every tool's title/type/snapshot/tags, plus curated
 * sets) and one file per tool with the full write-up. We read the index,
 * fetch each tool politely (sequential, small delay), and map it onto the
 * studio library's kinds.
 *
 *   node scripts/scrape-beautiful-trouble.mjs [out.json] [--include-solutions]
 *
 * Behind an HTTP proxy on Node 22, run with NODE_USE_ENV_PROXY=1.
 *
 * Content is CC BY-NC-SA 4.0 — every item carries that attribution and links
 * back to its toolbox page. Non-commercial, share-alike: keep it that way
 * anywhere these items travel.
 */

import { writeFileSync } from 'node:fs';

const API = 'https://api.beautifultrouble.org/v2/en';
const SITE = 'https://beautifultrouble.org/toolbox';
const LICENSE = 'CC BY-NC-SA 4.0';

const args = process.argv.slice(2);
const out = args.find(a => a.endsWith('.json')) ?? 'scripts/seed/organizing-studio-library.json';
// Beautiful Solutions (bsol-*) is a sister project with its own framing;
// left out by default so the shelf reads as one voice.
const includeSolutions = args.includes('--include-solutions');

// Beautiful Trouble type → studio library kind. The original type always
// rides along as a tag (bt-<type>), so the mapping can be revisited.
const KIND_FOR_TYPE = {
  principle: 'principle',
  story: 'story',
  tactic: 'recipe',
  methodology: 'recipe',
  theory: 'example',
  'bsol-principle': 'principle',
  'bsol-value': 'principle',
  'bsol-story': 'story',
  'bsol-solution': 'example',
  'bsol-question': 'prompt',
};

// The studio library only puts the first 16 principles and 24 other items
// into the AI's context, by sort_order — so the toolbox's own "Organizing
// 101" set goes first, in its curated order.
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
  if (tool.type === 'story' || tool.type === 'bsol-story') {
    const when = [tool.when, tool.where].filter(Boolean).join(', ');
    if (when) body = `*${when}*\n\n${body}`;
    body += section('Why it worked', tool.why_it_worked);
  }
  body += section('How to use', tool.how_to_use);
  body += section('Potential risks', tool.potential_risks);
  return body.trim() || null;
}

const index = await getJson(`${API}/toolbox-lite.json`);
const lead = index.sets?.[LEAD_SET] ?? [];
const leadRank = new Map(lead.map((slug, i) => [slug, i]));

const slugs = Object.keys(index.tools)
  .filter(slug => includeSolutions || !index.tools[slug].type.startsWith('bsol-'))
  .filter(slug => KIND_FOR_TYPE[index.tools[slug].type])
  .sort((a, b) => {
    const ra = leadRank.get(a) ?? Infinity;
    const rb = leadRank.get(b) ?? Infinity;
    if (ra !== rb) return ra - rb;
    const ta = index.tools[a];
    const tb = index.tools[b];
    return ta.type.localeCompare(tb.type) || ta.title.localeCompare(tb.title);
  });

// Which curated sets each tool belongs to, as tags
const setsFor = new Map();
for (const [set, members] of Object.entries(index.sets ?? {})) {
  for (const slug of members) setsFor.set(slug, [...(setsFor.get(slug) ?? []), `set:${set}`]);
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
  const byline = typeof tool.byline === 'string' && tool.byline.trim() ? ` · ${tool.byline.trim()}` : '';
  items.push({
    kind: KIND_FOR_TYPE[lite.type],
    title: String(tool.title).trim(),
    summary: absolutize(tool.snapshot) || null,
    body: bodyFor(tool),
    url: `${SITE}/tool/${slug}`,
    attribution: `Beautiful Trouble${byline} · ${LICENSE}`,
    tags: ['beautiful-trouble', `bt-${lite.type}`, ...(lite.tags ?? []), ...(setsFor.get(slug) ?? [])],
    sort_order: (i + 1) * 10,
  });
  if ((i + 1) % 25 === 0) console.error(`  ${i + 1}/${slugs.length}`);
  await sleep(150);
}

writeFileSync(out, JSON.stringify({ studio_slug: 'organizing', items }, null, 2) + '\n');
console.error(`Wrote ${items.length} items to ${out}${failed.length ? ` (${failed.length} from snapshot only)` : ''}.`);
