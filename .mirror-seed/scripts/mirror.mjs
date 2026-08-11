#!/usr/bin/env node
/**
 * Mirror the RT Commons into this repository.
 *
 *   node scripts/mirror.mjs
 *
 * Reads the same public shelves Relational Builder reads (anon keys, no
 * account needed) and regenerates:
 *
 *   content/<kind>/<slug>.md   one file per canonical entry — YAML
 *                              frontmatter, full body, connections as
 *                              relative links (GitHub and Obsidian both
 *                              render them)
 *   commons.json               every entry in one machine-readable file
 *   connections.json           the steward-confirmed reference graph
 *
 * Output is deterministic: same database state → byte-identical tree, so
 * `git diff` after a run shows exactly what changed in the commons and
 * nothing else. That's the whole design — the nightly workflow commits
 * only when the commons actually moved. Nothing here carries an
 * "exported at" timestamp for the same reason.
 *
 * The database is canonical. This repo is a faithful mirror plus a place
 * to suggest changes (see CONTRIBUTING.md); edits merged here don't flow
 * back automatically — a steward applies them upstream and the next
 * mirror run commits them for real.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// --- The public shelves (same fallbacks Relational Builder ships with) -----

const COMMONS_URL = process.env.COMMONS_SUPABASE_URL ?? 'https://odowkowcinyoxejyzhwl.supabase.co';
const COMMONS_ANON =
  process.env.COMMONS_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc';

const BUILDER_URL = process.env.BUILDER_SUPABASE_URL ?? 'https://texakzqqenzpxawktbgx.supabase.co';
const BUILDER_ANON =
  process.env.BUILDER_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleGFrenFxZW56cHhhd2t0Ymd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDczMDQsImV4cCI6MjA5ODUyMzMwNH0.NnNhDvYMPsDfC5T4QkExUtSrflG5VP76gkFY-KxiV8M';

/** Studio gallery images are stored site-relative; only that origin resolves them. */
const STUDIO_SITE_ORIGIN = 'https://studio.relationaltechproject.org';

const WEB = 'https://relationalbuilder.org';
const NR_REPO = 'https://github.com/The-Relational-Technology-Project/neighboring-recipes/blob/main';

const PAGE_SIZE = 500;

/**
 * Entries that also exist as hand-written files in Neighboring Recipes.
 * The database entry is canonical; the NR file is the curated cookbook
 * publication of the same practice, listed as a source.
 *
 * Regenerate when NR grows: intersect NR file basenames with commons slugs.
 */
const NR_SOURCES = {
  'appreciative-inquiry': 'recipes/04-gathering-design/appreciative-inquiry.md',
  'art-of-hosting': 'recipes/04-gathering-design/art-of-hosting.md',
  'block-party': 'recipes/01-knowing-your-neighbors/block-party.md',
  'block-stewards': 'recipes/01-knowing-your-neighbors/block-stewards.md',
  'circles-usa': 'recipes/05-bridging-difference/circles-usa.md',
  'civic-saturday': 'recipes/05-bridging-difference/civic-saturday.md',
  'cohousing': 'recipes/12-shared-land-and-home/cohousing.md',
  'community-acupuncture': 'recipes/08-healing-and-conflict/community-acupuncture.md',
  'community-agreements': 'recipes/04-gathering-design/community-agreements.md',
  'community-built-playspace': 'recipes/06-placemaking/community-built-playspace.md',
  'community-fridge': 'recipes/03-mutual-aid/community-fridge.md',
  'community-garden': 'recipes/06-placemaking/community-garden.md',
  'community-land-trusts': 'recipes/12-shared-land-and-home/community-land-trusts.md',
  'community-lore': 'frameworks/community-lore.md',
  'creative-interventions': 'recipes/08-healing-and-conflict/creative-interventions.md',
  'death-cafe': 'recipes/02-small-groups-for-support/death-cafe.md',
  'deep-canvassing': 'recipes/05-bridging-difference/deep-canvassing.md',
  'dinner-party-grief': 'recipes/02-small-groups-for-support/dinner-party-grief.md',
  'free-store': 'recipes/03-mutual-aid/free-store.md',
  'front-porch-forum': 'recipes/01-knowing-your-neighbors/front-porch-forum.md',
  'good-neighbor-agreement': 'recipes/01-knowing-your-neighbors/good-neighbor-agreement.md',
  'interfaith-bridge': 'recipes/05-bridging-difference/interfaith-bridge.md',
  'intersection-repair': 'recipes/06-placemaking/intersection-repair.md',
  'janes-walk': 'recipes/01-knowing-your-neighbors/janes-walk.md',
  'little-free-pantry': 'recipes/03-mutual-aid/little-free-pantry.md',
  'map-your-neighborhood': 'recipes/07-resilience/map-your-neighborhood.md',
  'meal-train': 'recipes/02-small-groups-for-support/meal-train.md',
  'mens-council': 'recipes/02-small-groups-for-support/mens-council.md',
  'microgrant-gathering': 'recipes/11-civic-rhythms/microgrant-gathering.md',
  'microsolidarity-crew': 'recipes/02-small-groups-for-support/microsolidarity-crew.md',
  'minimal-viable-structure': 'frameworks/minimal-viable-structure.md',
  'mutual-aid-pod': 'recipes/02-small-groups-for-support/mutual-aid-pod.md',
  'nap-ministry': 'recipes/08-healing-and-conflict/nap-ministry.md',
  'open-space': 'recipes/04-gathering-design/open-space.md',
  'participation-tactics': 'recipes/04-gathering-design/participation-tactics.md',
  'participatory-budgeting': 'recipes/11-civic-rhythms/participatory-budgeting.md',
  'peacemaking-circles': 'recipes/08-healing-and-conflict/peacemaking-circles.md',
  'placemaking': 'recipes/06-placemaking/placemaking.md',
  'playworks': 'recipes/10-play-and-joy/playworks.md',
  'porch-conversations': 'recipes/01-knowing-your-neighbors/porch-conversations.md',
  'reciprocity-game': 'recipes/02-small-groups-for-support/reciprocity-game.md',
  'reinvent-the-potluck': 'recipes/04-gathering-design/reinvent-the-potluck.md',
  'relational-organizing': 'recipes/05-bridging-difference/relational-organizing.md',
  'repair-cafe': 'recipes/03-mutual-aid/repair-cafe.md',
  'resilience-hub': 'recipes/07-resilience/resilience-hub.md',
  'skillshare': 'recipes/03-mutual-aid/skillshare.md',
  'sunday-assembly': 'recipes/11-civic-rhythms/sunday-assembly.md',
  'talking-circle': 'recipes/04-gathering-design/talking-circle.md',
  'tool-library': 'recipes/03-mutual-aid/tool-library.md',
  'topic-index': 'frameworks/topic-index.md',
  'welcome-wagon': 'recipes/01-knowing-your-neighbors/welcome-wagon.md',
  'world-cafe': 'recipes/04-gathering-design/world-cafe.md',
  // Same practice, drifted slug — the commons entry is still the canonical text.
  'babysitting-co-op': 'recipes/02-small-groups-for-support/babysitting-coop.md',
  'barbershop-and-beauty-salon-as-community-anchor': 'recipes/06-placemaking/barbershop-anchor.md',
  'bridge-meadows-intergenerational-housing': 'recipes/09-intergenerational/bridge-meadows.md',
  'buy-nothing-group': 'recipes/03-mutual-aid/buy-nothing.md',
  'come-out-play': 'recipes/10-play-and-joy/come-out-and-play.md',
  'community-land-trust': 'recipes/12-shared-land-and-home/community-land-trusts.md',
  'community-safety-response': 'recipes/07-resilience/community-safety.md',
  'high-agency-in-community-building': 'frameworks/high-agency.md',
  'improv-games-for-community-building': 'recipes/10-play-and-joy/improv-games.md',
  'neighborhood-association': 'recipes/11-civic-rhythms/neighborhood-associations.md',
  'playworks-intentional-school-recess': 'recipes/10-play-and-joy/playworks.md',
  'story-sharing-potluck-supper': 'recipes/01-knowing-your-neighbors/story-sharing-potluck.md',
  'the-5-cs-of-community': 'frameworks/5-cs-of-community.md',
  'the-abundant-community': 'frameworks/abundant-community.md',
  'the-longest-table': 'recipes/01-knowing-your-neighbors/longest-table.md',
  'time-banking': 'recipes/03-mutual-aid/timebanking.md',
  'transition-town': 'recipes/11-civic-rhythms/transition-network.md',
  'village-movement-aging-in-community': 'recipes/09-intergenerational/village-movement.md',
  'warmingcooling-center': 'recipes/07-resilience/warming-cooling-center.md',
};

/**
 * Every markdown file in Neighboring Recipes, by basename. Entry bodies
 * synced from NR carry NR-internal relative links; these let the mirror
 * rewrite them to targets that exist (see rewriteBodyLinks). Regenerate
 * from an NR checkout when it grows.
 */
const NR_FILES = {
  'CONTRIBUTING': 'CONTRIBUTING.md',
  'LICENSE': 'LICENSE.md',
  'README': 'README.md',
  'TEMPLATE': 'TEMPLATE.md',
  '10-principles': 'frameworks/10-principles.md',
  '5-cs-of-community': 'frameworks/5-cs-of-community.md',
  'abundant-community': 'frameworks/abundant-community.md',
  'community-lore': 'frameworks/community-lore.md',
  'high-agency': 'frameworks/high-agency.md',
  'minimal-viable-structure': 'frameworks/minimal-viable-structure.md',
  'structural-thinking': 'frameworks/structural-thinking.md',
  'topic-index': 'frameworks/topic-index.md',
  'block-party': 'recipes/01-knowing-your-neighbors/block-party.md',
  'block-stewards': 'recipes/01-knowing-your-neighbors/block-stewards.md',
  'front-porch-forum': 'recipes/01-knowing-your-neighbors/front-porch-forum.md',
  'good-neighbor-agreement': 'recipes/01-knowing-your-neighbors/good-neighbor-agreement.md',
  'janes-walk': 'recipes/01-knowing-your-neighbors/janes-walk.md',
  'longest-table': 'recipes/01-knowing-your-neighbors/longest-table.md',
  'porch-conversations': 'recipes/01-knowing-your-neighbors/porch-conversations.md',
  'story-sharing-potluck': 'recipes/01-knowing-your-neighbors/story-sharing-potluck.md',
  'welcome-wagon': 'recipes/01-knowing-your-neighbors/welcome-wagon.md',
  'babysitting-coop': 'recipes/02-small-groups-for-support/babysitting-coop.md',
  'death-cafe': 'recipes/02-small-groups-for-support/death-cafe.md',
  'dinner-party-grief': 'recipes/02-small-groups-for-support/dinner-party-grief.md',
  'meal-train': 'recipes/02-small-groups-for-support/meal-train.md',
  'mens-council': 'recipes/02-small-groups-for-support/mens-council.md',
  'microsolidarity-crew': 'recipes/02-small-groups-for-support/microsolidarity-crew.md',
  'mutual-aid-pod': 'recipes/02-small-groups-for-support/mutual-aid-pod.md',
  'reciprocity-game': 'recipes/02-small-groups-for-support/reciprocity-game.md',
  'buy-nothing': 'recipes/03-mutual-aid/buy-nothing.md',
  'community-fridge': 'recipes/03-mutual-aid/community-fridge.md',
  'free-store': 'recipes/03-mutual-aid/free-store.md',
  'little-free-pantry': 'recipes/03-mutual-aid/little-free-pantry.md',
  'repair-cafe': 'recipes/03-mutual-aid/repair-cafe.md',
  'skillshare': 'recipes/03-mutual-aid/skillshare.md',
  'timebanking': 'recipes/03-mutual-aid/timebanking.md',
  'tool-library': 'recipes/03-mutual-aid/tool-library.md',
  'appreciative-inquiry': 'recipes/04-gathering-design/appreciative-inquiry.md',
  'art-of-hosting': 'recipes/04-gathering-design/art-of-hosting.md',
  'community-agreements': 'recipes/04-gathering-design/community-agreements.md',
  'open-space': 'recipes/04-gathering-design/open-space.md',
  'participation-tactics': 'recipes/04-gathering-design/participation-tactics.md',
  'reinvent-the-potluck': 'recipes/04-gathering-design/reinvent-the-potluck.md',
  'talking-circle': 'recipes/04-gathering-design/talking-circle.md',
  'world-cafe': 'recipes/04-gathering-design/world-cafe.md',
  'circles-usa': 'recipes/05-bridging-difference/circles-usa.md',
  'civic-saturday': 'recipes/05-bridging-difference/civic-saturday.md',
  'deep-canvassing': 'recipes/05-bridging-difference/deep-canvassing.md',
  'interfaith-bridge': 'recipes/05-bridging-difference/interfaith-bridge.md',
  'relational-organizing': 'recipes/05-bridging-difference/relational-organizing.md',
  'barbershop-anchor': 'recipes/06-placemaking/barbershop-anchor.md',
  'community-built-playspace': 'recipes/06-placemaking/community-built-playspace.md',
  'community-garden': 'recipes/06-placemaking/community-garden.md',
  'intersection-repair': 'recipes/06-placemaking/intersection-repair.md',
  'placemaking': 'recipes/06-placemaking/placemaking.md',
  'community-safety': 'recipes/07-resilience/community-safety.md',
  'map-your-neighborhood': 'recipes/07-resilience/map-your-neighborhood.md',
  'resilience-hub': 'recipes/07-resilience/resilience-hub.md',
  'warming-cooling-center': 'recipes/07-resilience/warming-cooling-center.md',
  'community-acupuncture': 'recipes/08-healing-and-conflict/community-acupuncture.md',
  'creative-interventions': 'recipes/08-healing-and-conflict/creative-interventions.md',
  'nap-ministry': 'recipes/08-healing-and-conflict/nap-ministry.md',
  'peacemaking-circles': 'recipes/08-healing-and-conflict/peacemaking-circles.md',
  'trauma-informed': 'recipes/08-healing-and-conflict/trauma-informed.md',
  'bridge-meadows': 'recipes/09-intergenerational/bridge-meadows.md',
  'village-movement': 'recipes/09-intergenerational/village-movement.md',
  'come-out-and-play': 'recipes/10-play-and-joy/come-out-and-play.md',
  'improv-games': 'recipes/10-play-and-joy/improv-games.md',
  'playworks': 'recipes/10-play-and-joy/playworks.md',
  'microgrant-gathering': 'recipes/11-civic-rhythms/microgrant-gathering.md',
  'neighborhood-associations': 'recipes/11-civic-rhythms/neighborhood-associations.md',
  'participatory-budgeting': 'recipes/11-civic-rhythms/participatory-budgeting.md',
  'sunday-assembly': 'recipes/11-civic-rhythms/sunday-assembly.md',
  'transition-network': 'recipes/11-civic-rhythms/transition-network.md',
  'cohousing': 'recipes/12-shared-land-and-home/cohousing.md',
  'community-land-trusts': 'recipes/12-shared-land-and-home/community-land-trusts.md',
};

/** NR basename → the commons slug for the same practice, where they drifted. */
const NR_ALIAS = {
  'babysitting-coop': 'babysitting-co-op',
  'barbershop-anchor': 'barbershop-and-beauty-salon-as-community-anchor',
  'bridge-meadows': 'bridge-meadows-intergenerational-housing',
  'buy-nothing': 'buy-nothing-group',
  'come-out-and-play': 'come-out-play',
  'community-safety': 'community-safety-response',
  'high-agency': 'high-agency-in-community-building',
  'improv-games': 'improv-games-for-community-building',
  'neighborhood-associations': 'neighborhood-association',
  'story-sharing-potluck': 'story-sharing-potluck-supper',
  '5-cs-of-community': 'the-5-cs-of-community',
  'abundant-community': 'the-abundant-community',
  'longest-table': 'the-longest-table',
  'timebanking': 'time-banking',
  'transition-network': 'transition-town',
  'village-movement': 'village-movement-aging-in-community',
  'warming-cooling-center': 'warmingcooling-center',
};

// --- Fetch -----------------------------------------------------------------

async function fetchAll(base, key, path) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
      },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

// --- Normalize -------------------------------------------------------------

const qualifyAsset = url => (url?.startsWith('/') ? `${STUDIO_SITE_ORIGIN}${url}` : url);

/**
 * `search_vector` is Postgres's internal index and `created_by`/`updated_by`
 * are account ids — neither belongs in a public mirror.
 */
const DROPPED_COLUMNS = new Set(['search_vector', 'created_by', 'updated_by']);

function normalize(row) {
  const item = {};
  for (const [key, value] of Object.entries(row).sort(([a], [b]) => a.localeCompare(b))) {
    if (!DROPPED_COLUMNS.has(key)) item[key] = value;
  }
  item.image_urls = (row.image_urls ?? []).map(qualifyAsset);
  item.source_url = qualifyAsset(row.source_url) ?? null;
  return item;
}

// --- Markdown / YAML helpers -----------------------------------------------

/** JSON's string escaping is valid YAML double-quoted scalar escaping. */
const yamlString = value => JSON.stringify(String(value));
const yamlList = values => `[${values.map(yamlString).join(', ')}]`;

/** Obsidian tags allow letters, digits, _, -, / and nothing else. */
const asTag = raw =>
  String(raw)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_/-]/gu, '')
    .replace(/^-+|-+$/g, '');

/** Same preference order the website uses to resolve a bare slug. */
const KIND_PREFERENCE = ['recipe', 'tool', 'framework', 'methodology', 'prompt', 'story', 'reference'];

// --- Entry files -----------------------------------------------------------

const fileFor = item => `content/${item.kind}/${item.slug}.md`;
/** Relative link from one entry file to another (both live in content/<kind>/). */
const linkTo = (from, to) => `../${to.kind}/${to.slug}.md`;

function frontmatter(item, extra) {
  const lines = ['---'];
  const add = (key, value) => lines.push(`${key}: ${value}`);

  add('title', yamlString(item.title ?? item.slug));
  add('slug', yamlString(item.slug));
  add('kind', yamlString(item.kind));
  if (item.source_studio_slug) add('studio', yamlString(item.source_studio_slug));
  if (item.license) add('license', yamlString(item.license));

  const tags = [
    `commons/${asTag(item.kind)}`,
    ...(item.source_studio_slug ? [`studio/${asTag(item.source_studio_slug)}`] : []),
    ...(item.tags ?? []).map(asTag).filter(Boolean),
  ];
  add('tags', yamlList([...new Set(tags)]));
  if (item.tags?.length) add('topics', yamlList(item.tags));

  const attribution = item.attribution ?? {};
  if (attribution.name) add('author', yamlString(attribution.name));
  if (attribution.neighborhood) add('neighborhood', yamlString(attribution.neighborhood));
  if (attribution.source) add('attribution_source', yamlString(attribution.source));
  if (attribution.source_repo) add('source_repo', yamlString(attribution.source_repo));
  if (item.source_url) add('source_url', yamlString(item.source_url));
  if (NR_SOURCES[item.slug] && item.kind !== 'reference') {
    add('neighboring_recipes', yamlString(`${NR_REPO}/${NR_SOURCES[item.slug]}`));
  }
  if (extra.parent) add('parent', yamlString(linkTo(item, extra.parent)));
  add('web', yamlString(`${WEB}/commons/e/${item.slug}`));

  if (item.created_at) add('created', yamlString(item.created_at.slice(0, 10)));
  if (item.updated_at) add('updated', yamlString(item.updated_at.slice(0, 10)));
  add('rtp_id', yamlString(item.id));

  lines.push('---', '');
  return lines.join('\n');
}

const RELATION_LABEL = {
  mentions: ['Mentions', 'Mentioned in'],
  used_in: ['Used in', 'Uses'],
  paired_with: ['Paired with', 'Paired with'],
  related: ['Related to', 'Related to'],
};

/**
 * Bodies synced from Neighboring Recipes carry NR-internal relative links
 * (`../01-knowing-your-neighbors/block-party.md`) that don't resolve in this
 * repo's layout. Point each at the commons entry when the practice lives
 * here, at the NR file when it only lives there, and unlink it (keeping the
 * text) when it resolves nowhere — no broken links in the mirror.
 */
function rewriteBodyLinks(body, item, resolve) {
  return body.replace(
    /\[([^\]]+)\]\((?!https?:|mailto:|#)([^)\s]+?\.md)(#[^)]*)?\)/g,
    (whole, text, link, anchor) => {
      const base = link.split('/').pop().replace(/\.md$/, '');
      const target = resolve(base, item.id) ?? resolve(NR_ALIAS[base] ?? '', item.id);
      if (target) return `[${text}](${linkTo(item, target)})`;
      if (NR_FILES[base]) return `[${text}](${NR_REPO}/${NR_FILES[base]}${anchor ?? ''})`;
      return text;
    },
  );
}

function noteBody(item, extra) {
  const out = [`# ${item.title ?? item.slug}`, ''];

  if (item.summary) out.push(`> ${item.summary.replace(/\n+/g, ' ')}`, '');

  for (const url of item.image_urls ?? []) out.push(`![](${url})`, '');

  if (item.body) out.push(rewriteBodyLinks(item.body.trim(), item, extra.resolve), '');

  const related = [];
  if (extra.parent) related.push(`- Grew from [${extra.parent.title}](${linkTo(item, extra.parent)})`);
  for (const child of extra.children) {
    related.push(`- Grew into [${child.title}](${linkTo(item, child)})`);
  }
  for (const { other, relation, dir } of extra.refs) {
    const label = (RELATION_LABEL[relation] ?? [relation, relation])[dir === 'out' ? 0 : 1];
    related.push(`- ${label}: [${other.title}](${linkTo(item, other)})`);
  }
  if (related.length) {
    // Not "Lineage" — some synced bodies already carry a heading by that name.
    out.push('## Related in the commons', '', ...related, '');
  }

  const metadata = Object.entries(item.metadata ?? {}).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  );
  if (metadata.length) {
    out.push('## Details', '');
    for (const [key, value] of metadata) {
      const rendered = Array.isArray(value)
        ? value.join(', ')
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);
      // Metadata synced from NR (adjacent recipes etc.) carries the same
      // NR-relative links the bodies do.
      out.push(`- **${key.replace(/_/g, ' ')}:** ${rewriteBodyLinks(rendered, item, extra.resolve)}`);
    }
    out.push('');
  }

  const credit = [item.attribution?.name, item.attribution?.neighborhood, item.attribution?.source]
    .filter(Boolean)
    .join(' — ');
  const footer = [];
  if (credit) footer.push(`Contributed by ${credit}.`);
  if (item.source_url) footer.push(`[Source](${item.source_url})`);
  if (NR_SOURCES[item.slug] && item.kind !== 'reference') {
    footer.push(`Also published in [Neighboring Recipes](${NR_REPO}/${NR_SOURCES[item.slug]}).`);
  }
  if (item.license === 'RCL-1.0') {
    footer.push(`Licensed [RCL-1.0](${WEB}/commons/license).`);
  } else if (item.license) {
    footer.push(`Licensed ${item.license}.`);
  }
  footer.push(`[On the web](${WEB}/commons/e/${item.slug}).`);
  out.push('---', '', `*${footer.join(' ')}*`, '');

  return out.join('\n');
}

// --- Run -------------------------------------------------------------------

console.log('Reading the commons…');
const [rawItems, refs] = await Promise.all([
  fetchAll(COMMONS_URL, COMMONS_ANON, 'commons_items?select=*&status=eq.canonical&order=kind.asc,slug.asc'),
  fetchAll(
    BUILDER_URL, BUILDER_ANON,
    'gallery_references?select=from_source,from_id,from_title,from_kind,to_source,to_id,to_title,to_kind,relation' +
      '&status=eq.confirmed&from_source=eq.commons&to_source=eq.commons&order=from_id.asc,to_id.asc,relation.asc',
  ),
]);

const items = rawItems
  .map(normalize)
  .sort((a, b) => a.kind.localeCompare(b.kind) || a.slug.localeCompare(b.slug));

const byKind = new Map();
for (const item of items) byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
console.log(`  ${items.length} entries (${[...byKind].map(([k, n]) => `${n} ${k}`).join(', ')})`);
console.log(`  ${refs.length} confirmed connections`);

// Slugs collide across kinds; resolve a bare slug the way the website does.
const bySlug = new Map();
for (const item of items) {
  if (!bySlug.has(item.slug)) bySlug.set(item.slug, []);
  bySlug.get(item.slug).push(item);
}
const resolveSlug = (slug, notId = null) => {
  const candidates = (bySlug.get(slug) ?? []).filter(item => item.id !== notId);
  if (!candidates.length) return null;
  return [...candidates].sort(
    (a, b) => KIND_PREFERENCE.indexOf(a.kind) - KIND_PREFERENCE.indexOf(b.kind),
  )[0];
};

// Lineage: parent resolves to the first entry that isn't the item itself
// (self-referential parent_slug rows point at their sibling of another kind).
const childrenOf = new Map();
for (const item of items) {
  if (!item.parent_slug) continue;
  const parent = resolveSlug(item.parent_slug, item.id);
  if (!parent) continue;
  if (!childrenOf.has(parent.id)) childrenOf.set(parent.id, []);
  childrenOf.get(parent.id).push(item);
}

// Confirmed references per entry, both directions, deduped.
const refsOf = new Map();
for (const ref of refs) {
  for (const [slug, otherSlug, dir] of [
    [ref.from_id, ref.to_id, 'out'],
    [ref.to_id, ref.from_id, 'in'],
  ]) {
    for (const item of bySlug.get(slug) ?? []) {
      const other = resolveSlug(otherSlug, item.id);
      if (!other) continue;
      if (!refsOf.has(item.id)) refsOf.set(item.id, new Map());
      const key = `${other.kind}/${other.slug}`;
      if (!refsOf.get(item.id).has(key)) {
        refsOf.get(item.id).set(key, { other, relation: ref.relation, dir });
      }
    }
  }
}

await rm(join(ROOT, 'content'), { recursive: true, force: true });

for (const item of items) {
  const extra = {
    resolve: resolveSlug,
    parent: item.parent_slug ? resolveSlug(item.parent_slug, item.id) : null,
    children: (childrenOf.get(item.id) ?? []).sort((a, b) => a.slug.localeCompare(b.slug)),
    refs: [...(refsOf.get(item.id)?.values() ?? [])].sort((a, b) =>
      a.other.slug.localeCompare(b.other.slug),
    ),
  };
  const path = join(ROOT, fileFor(item));
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, frontmatter(item, extra) + noteBody(item, extra));
}
console.log(`  wrote content/ (${items.length} files)`);

const asOf = items.reduce(
  (max, item) => ((item.updated_at ?? '') > max ? item.updated_at : max),
  '',
);

await writeFile(
  join(ROOT, 'commons.json'),
  JSON.stringify(
    {
      source: {
        name: 'RT Commons',
        project: COMMONS_URL,
        table: 'commons_items',
        filter: "status = 'canonical'",
        mirror: 'relational-commons/scripts/mirror.mjs',
        canonical: 'The database is canonical; this file mirrors it.',
      },
      license_note:
        'Per-entry licensing lives in each entry’s `license` field (mostly RCL-1.0 — ' +
        'https://relationalbuilder.org/commons/license). Attribution travels with the ' +
        'entry — keep it attached when reusing.',
      data_as_of: asOf,
      counts: { total: items.length, by_kind: Object.fromEntries(byKind) },
      items,
    },
    null,
    2,
  ) + '\n',
);
console.log('  wrote commons.json');

await writeFile(
  join(ROOT, 'connections.json'),
  JSON.stringify(
    {
      source: {
        name: 'RT Commons cross-references',
        project: BUILDER_URL,
        table: 'gallery_references',
        filter: "status = 'confirmed' and commons↔commons",
      },
      count: refs.length,
      references: refs,
    },
    null,
    2,
  ) + '\n',
);
console.log('  wrote connections.json');

console.log('\nDone. `git status` shows what moved in the commons.');
