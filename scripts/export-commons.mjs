#!/usr/bin/env node
/**
 * Export the whole RT Commons to disk — no account, no keys, no build step.
 *
 *   node scripts/export-commons.mjs [--out DIR] [--format json|vault|both]
 *
 * Everything it reads is already public: the same anon keys the app ships
 * with, against the same tables the Builder reads on every message. So a
 * person who has only cloned this repo can run it and get the same export a
 * steward would.
 *
 * Two shapes, because two audiences:
 *
 *   commons.json   one file, every entry with its full body and metadata,
 *                  plus provenance and counts. For scripts, other apps,
 *                  re-import, diffing two exports over time.
 *
 *   vault/         one Markdown note per entry, YAML frontmatter, foldered
 *                  by kind, wikilinked by lineage. Point Obsidian (or
 *                  Logseq, or anything that reads a folder of Markdown) at
 *                  it and the commons opens as a graph.
 *
 * Deliberately NOT exported: people's own material — Builder projects,
 * profiles, memberships, and build plans (which carry chat excerpts). The
 * commons is the shared library, not the workspace.
 */

import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

// --- Arguments -------------------------------------------------------------

const args = process.argv.slice(2);
const argValue = name => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};

const OUT_DIR = argValue('--out') ?? 'commons-export';
const FORMAT = argValue('--format') ?? 'both';
if (!['json', 'vault', 'both'].includes(FORMAT)) {
  console.error(`Unknown --format "${FORMAT}" (expected json, vault, or both)`);
  process.exit(1);
}
const WANT_JSON = FORMAT === 'json' || FORMAT === 'both';
const WANT_VAULT = FORMAT === 'vault' || FORMAT === 'both';

// --- The public shelves (same fallbacks the app itself ships with) ---------

const COMMONS_URL = process.env.VITE_COMMONS_SUPABASE_URL ?? 'https://odowkowcinyoxejyzhwl.supabase.co';
const COMMONS_ANON =
  process.env.VITE_COMMONS_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc';

/** Studio gallery images are stored site-relative; only that origin resolves them. */
const STUDIO_SITE_ORIGIN = 'https://studio.relationaltechproject.org';

/** The watcher's stream of published builder repos — lineage, not library. */
const FEED_URL = 'https://updates.relationaltechproject.org/feed.json';

const PAGE_SIZE = 500;

// --- Fetch -----------------------------------------------------------------

/** Read a table page by page so the export doesn't silently stop at a limit. */
async function fetchAll(path) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const res = await fetch(`${COMMONS_URL}/rest/v1/${path}`, {
      headers: {
        apikey: COMMONS_ANON,
        Authorization: `Bearer ${COMMONS_ANON}`,
        Range: `${from}-${from + PAGE_SIZE - 1}`,
      },
    });
    if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** The feed is a nice-to-have; a network hiccup shouldn't sink the export. */
async function fetchFeed() {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items ?? []);
  } catch (err) {
    console.warn(`  ! network feed unavailable (${err.message}) — skipping it`);
    return null;
  }
}

// --- Normalize -------------------------------------------------------------

const qualifyAsset = url => (url?.startsWith('/') ? `${STUDIO_SITE_ORIGIN}${url}` : url);

/**
 * `search_vector` is Postgres's internal index and `created_by`/`updated_by`
 * are account ids — neither belongs in a public export.
 */
const DROPPED_COLUMNS = new Set(['search_vector', 'created_by', 'updated_by']);

function normalize(row) {
  const item = {};
  for (const [key, value] of Object.entries(row)) {
    if (!DROPPED_COLUMNS.has(key)) item[key] = value;
  }
  item.image_urls = (row.image_urls ?? []).map(qualifyAsset);
  item.source_url = qualifyAsset(row.source_url) ?? null;
  return item;
}

// --- Markdown / YAML helpers ----------------------------------------------

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

/** Filenames that survive macOS, Windows and Linux alike. */
function safeFilename(title, fallback) {
  const cleaned = String(title ?? '')
    .replace(/[\\/:*?"<>|#^[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
    .replace(/\.+$/, '');
  return cleaned || fallback;
}

/** Wikilink targets can't carry the characters Obsidian uses for syntax. */
const linkSafe = name => name.replace(/[[\]|#^]/g, '');

const KIND_FOLDERS = {
  recipe: 'Recipes',
  reference: 'References',
  story: 'Stories',
  tool: 'Tools',
  framework: 'Frameworks',
  prompt: 'Prompts',
  methodology: 'Methodologies',
  program: 'Programs',
};

const folderFor = kind => KIND_FOLDERS[kind] ?? 'Other';

// --- Vault note ------------------------------------------------------------

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
  // The tags above are flattened for Obsidian; keep the originals readable.
  if (item.tags?.length) add('topics', yamlList(item.tags));

  const attribution = item.attribution ?? {};
  if (attribution.name) add('author', yamlString(attribution.name));
  if (attribution.neighborhood) add('neighborhood', yamlString(attribution.neighborhood));
  if (attribution.source) add('attribution_source', yamlString(attribution.source));
  if (attribution.source_repo) add('source_repo', yamlString(attribution.source_repo));
  if (item.source_url) add('source_url', yamlString(item.source_url));
  if (extra.parentLink) add('parent', yamlString(`[[${extra.parentLink}]]`));

  if (item.created_at) add('created', yamlString(item.created_at));
  if (item.updated_at) add('updated', yamlString(item.updated_at));
  add('rtp_id', yamlString(item.id));
  add('exported', yamlString(extra.exportedAt));

  lines.push('---', '');
  return lines.join('\n');
}

function noteBody(item, extra) {
  const out = [`# ${item.title ?? item.slug}`, ''];

  if (item.summary) out.push(`> ${item.summary.replace(/\n+/g, ' ')}`, '');

  for (const url of item.image_urls ?? []) out.push(`![](${url})`, '');

  if (item.body) out.push(item.body.trim(), '');

  if (extra.parentLink || extra.childLinks.length) {
    // Not "Lineage" — some synced bodies already carry a heading by that name.
    out.push('## Related in the commons', '');
    if (extra.parentLink) out.push(`- Part of [[${extra.parentLink}]]`);
    for (const child of extra.childLinks) out.push(`- Includes [[${child}]]`);
    out.push('');
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
      out.push(`- **${key.replace(/_/g, ' ')}:** ${rendered}`);
    }
    out.push('');
  }

  const credit = [item.attribution?.name, item.attribution?.neighborhood, item.attribution?.source]
    .filter(Boolean)
    .join(' — ');
  const footer = [];
  if (credit) footer.push(`Contributed by ${credit}.`);
  if (item.source_url) footer.push(`[Source](${item.source_url})`);
  if (item.license) footer.push(`Licensed ${item.license}.`);
  if (footer.length) out.push('---', '', `*${footer.join(' ')}*`, '');

  return out.join('\n');
}

// --- Index notes -----------------------------------------------------------

function groupedIndex(heading, intro, groups) {
  const out = [`# ${heading}`, '', intro, ''];
  for (const [name, entries] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    out.push(`## ${name} (${entries.length})`, '');
    for (const link of [...entries].sort()) out.push(`- [[${link}]]`);
    out.push('');
  }
  return out.join('\n');
}

function buildIndexes(notes, exportedAt) {
  const byKind = new Map();
  const byStudio = new Map();
  const byTag = new Map();

  for (const note of notes) {
    const push = (map, key) => {
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(note.link);
    };
    push(byKind, folderFor(note.item.kind));
    push(byStudio, note.item.source_studio_slug ?? 'unattributed');
    for (const tag of note.item.tags ?? []) push(byTag, tag);
  }

  const home = [
    '# The RT Commons',
    '',
    `${notes.length} entries from the Relational Technology Project's shared library,`,
    `exported ${exportedAt.slice(0, 10)}.`,
    '',
    'Every note is one commons entry: its full text, who contributed it, what',
    'it descends from. Start anywhere — the graph view shows how the lineage',
    'links connect.',
    '',
    '## Shelves',
    '',
    ...[...byKind]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([name, entries]) => `- **${name}** — ${entries.length} entries`),
    '',
    '## Indexes',
    '',
    '- [[By kind]]',
    '- [[By studio]]',
    '- [[By tag]]',
    '',
    '---',
    '',
    '*Exported from Relational Builder with `scripts/export-commons.mjs`.*',
    '',
  ].join('\n');

  return [
    { path: 'The RT Commons.md', content: home },
    {
      path: join('Indexes', 'By kind.md'),
      content: groupedIndex('By kind', 'Every entry, grouped by what kind of thing it is.', byKind),
    },
    {
      path: join('Indexes', 'By studio.md'),
      content: groupedIndex('By studio', 'Which shelf each entry came from.', byStudio),
    },
    {
      path: join('Indexes', 'By tag.md'),
      content: groupedIndex('By tag', 'Entries by topic tag, most-used first.', byTag),
    },
  ];
}

// --- Vault writer ----------------------------------------------------------

async function writeVault(items, dir, exportedAt) {
  // Resolve every note's filename first, so lineage links can point at them.
  // Titles repeat across the commons, and so do slugs — a prompt and the tool
  // it belongs to often share both — so fall back to a counter if a title and
  // its slug are *both* already taken.
  const used = new Set();
  const notes = items.map(item => {
    const base = safeFilename(item.title, item.slug);
    let name = base;
    for (let n = 1; used.has(name.toLowerCase()); n++) {
      name = n === 1 ? `${base} (${item.slug})` : `${base} (${item.slug}-${n})`;
    }
    used.add(name.toLowerCase());
    return { item, name, link: linkSafe(name) };
  });

  // Since slugs collide, one parent_slug can name several notes. Resolve to
  // the first that isn't the note itself — that's what the self-referential
  // rows (a prompt whose parent_slug is its own slug) are actually pointing at.
  const bySlug = new Map();
  for (const note of notes) {
    if (!bySlug.has(note.item.slug)) bySlug.set(note.item.slug, []);
    bySlug.get(note.item.slug).push(note);
  }
  const parentOf = note =>
    (bySlug.get(note.item.parent_slug) ?? []).find(other => other.item.id !== note.item.id) ?? null;

  const children = new Map();
  for (const note of notes) {
    const parent = parentOf(note);
    if (!parent) continue;
    if (!children.has(parent.item.id)) children.set(parent.item.id, []);
    children.get(parent.item.id).push(note.link);
  }

  for (const note of notes) {
    const extra = {
      exportedAt,
      parentLink: parentOf(note)?.link ?? null,
      childLinks: (children.get(note.item.id) ?? []).sort(),
    };
    const folder = join(dir, folderFor(note.item.kind));
    await mkdir(folder, { recursive: true });
    await writeFile(
      join(folder, `${note.name}.md`),
      frontmatter(note.item, extra) + noteBody(note.item, extra),
    );
  }

  await mkdir(join(dir, 'Indexes'), { recursive: true });
  for (const index of buildIndexes(notes, exportedAt)) {
    await writeFile(join(dir, index.path), index.content);
  }

  return notes.length;
}

// --- Export README ---------------------------------------------------------

function exportReadme(counts, exportedAt, feedCount) {
  const kinds = [...counts.byKind].sort((a, b) => b[1] - a[1]);
  return [
    '# RT Commons export',
    '',
    `Exported ${exportedAt} from the Relational Technology Project's commons.`,
    '',
    `**${counts.total} entries**`,
    '',
    ...kinds.map(([kind, n]) => `- ${n} × ${kind}`),
    '',
    '## What is in here',
    '',
    '- `commons.json` — every entry with its full body, metadata, attribution',
    '  and lineage, plus the provenance block describing this export.',
    '- `vault/` — the same entries as Markdown notes with YAML frontmatter,',
    '  foldered by kind and wikilinked by lineage. Open the folder as an',
    '  Obsidian vault (Obsidian → Open folder as vault) and it works as-is:',
    '  tags, graph view, backlinks, search. Logseq and other Markdown tools',
    '  read it too.',
    ...(feedCount === null
      ? ['- `network-feed.json` — skipped; the feed was unreachable at export time.']
      : [
          `- \`network-feed.json\` — ${feedCount} recent events from the watcher: builder`,
          '  repos published with `.reltech.yml` lineage. A stream, not a library,',
          '  so it stays raw rather than becoming notes.',
        ]),
    '',
    '## What is deliberately not in here',
    '',
    "People's own material: Builder projects, profiles, studio memberships,",
    'and build plans (which carry chat excerpts). The commons is the shared',
    'library, not anyone’s workspace.',
    '',
    '## Attribution and licensing',
    '',
    'Most entries carry `RCL-1.0` (the Relational Commons License); some carry',
    'no license field yet. Per-entry attribution travels with the entry — in',
    "`commons.json` under `attribution`, and in each note's frontmatter and",
    'footer. Keep the credit attached when you reuse or republish an entry.',
    '',
    '## Re-running',
    '',
    'From a clone of the Relational Builder repo:',
    '',
    '```',
    'node scripts/export-commons.mjs',
    '```',
    '',
    'No account or API key needed — it reads the same public shelves the app',
    'reads. Re-running overwrites this folder with a fresh export.',
    '',
  ].join('\n');
}

// --- Run -------------------------------------------------------------------

const exportedAt = new Date().toISOString();

console.log('Reading the commons…');
const [rawItems, feed] = await Promise.all([
  fetchAll('commons_items?select=*&status=eq.canonical&order=kind.asc,title.asc'),
  fetchFeed(),
]);

const items = rawItems.map(normalize);
const byKind = new Map();
for (const item of items) byKind.set(item.kind, (byKind.get(item.kind) ?? 0) + 1);
const counts = { total: items.length, byKind };

console.log(`  ${items.length} entries (${[...byKind].map(([k, n]) => `${n} ${k}`).join(', ')})`);

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

if (WANT_JSON) {
  await writeFile(
    join(OUT_DIR, 'commons.json'),
    JSON.stringify(
      {
        exported_at: exportedAt,
        source: {
          name: 'RT Commons',
          project: COMMONS_URL,
          table: 'commons_items',
          filter: "status = 'canonical'",
          exporter: 'relational-builder/scripts/export-commons.mjs',
        },
        license_note:
          'Per-entry licensing lives in each entry’s `license` field (mostly RCL-1.0). ' +
          'Attribution travels with the entry — keep it attached when reusing.',
        counts: { total: counts.total, by_kind: Object.fromEntries(byKind) },
        items,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`  wrote ${join(OUT_DIR, 'commons.json')}`);

  if (feed) {
    await writeFile(join(OUT_DIR, 'network-feed.json'), JSON.stringify(feed, null, 2) + '\n');
    console.log(`  wrote ${join(OUT_DIR, 'network-feed.json')} (${feed.length} events)`);
  }
}

if (WANT_VAULT) {
  const written = await writeVault(items, join(OUT_DIR, 'vault'), exportedAt);
  console.log(`  wrote ${join(OUT_DIR, 'vault')} (${written} notes + 4 index notes)`);
}

await writeFile(join(OUT_DIR, 'README.md'), exportReadme(counts, exportedAt, feed ? feed.length : null));

console.log(`\nDone → ${OUT_DIR}/`);
if (WANT_VAULT) console.log(`Open ${join(OUT_DIR, 'vault')} in Obsidian with "Open folder as vault".`);
