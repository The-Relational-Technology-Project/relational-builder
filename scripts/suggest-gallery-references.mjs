#!/usr/bin/env node
/**
 * Suggest gallery connections by reading what entries already say about each
 * other: scan every entry's free text (body, summary, story text, and the
 * civic-media `metadata.building_from` lists) for other entries' titles, and
 * write the matches to the Builder backend's gallery_references table as
 * status 'suggested'. The steward confirms or removes them in the Steward
 * page's Connections tab — nothing reaches "confirmed" without a human eye.
 *
 *   BUILDER_SUPABASE_URL=https://xyz.supabase.co \
 *   BUILDER_SERVICE_ROLE_KEY=... \
 *   node scripts/suggest-gallery-references.mjs [--dry-run]
 *
 * Reads come from the public shelves (KB tools + stories, commons items)
 * with their anon keys; only the write needs the service role. Re-running is
 * safe: (from, to) pairs are unique and duplicates are ignored.
 */

const BUILDER_URL = process.env.BUILDER_SUPABASE_URL;
const BUILDER_KEY = process.env.BUILDER_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!BUILDER_URL || (!BUILDER_KEY && !DRY_RUN)) {
  console.error(
    'Usage: BUILDER_SUPABASE_URL=... BUILDER_SERVICE_ROLE_KEY=... ' +
      'node scripts/suggest-gallery-references.mjs [--dry-run]',
  );
  process.exit(1);
}

// The public read-only backends (same fallbacks the app itself ships with)
const KB_URL = process.env.VITE_SUPABASE_URL ?? 'https://ivrvpbqidysrwqrthpcp.supabase.co';
const KB_ANON =
  process.env.VITE_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2cnZwYnFpZHlzcndxcnRocGNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4NzQ4NDQsImV4cCI6MjA3NTQ1MDg0NH0.fBKxzaiUspapVYq7xT60EHHVgWR-DcolUW2Cy90GHHc';
const COMMONS_URL = process.env.VITE_COMMONS_SUPABASE_URL ?? 'https://odowkowcinyoxejyzhwl.supabase.co';
const COMMONS_ANON =
  process.env.VITE_COMMONS_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc';

async function rest(base, key, path) {
  const res = await fetch(`${base}/rest/v1${path}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- Load every entry as { source, id, title, kind, text } ---
// text = what the entry says (searched for OTHER entries' titles);
// title = what other entries might say about IT.

const [tools, stories, commonsItems] = await Promise.all([
  rest(KB_URL, KB_ANON, '/tools?select=id,name,description,summary,tool_category'),
  rest(KB_URL, KB_ANON, '/stories?select=id,title,story_text,full_story_text,attribution'),
  rest(
    COMMONS_URL, COMMONS_ANON,
    '/commons_items?select=id,slug,kind,title,summary,body,metadata,source_studio_slug&status=eq.canonical',
  ),
]);

// Tech-for-building rows (GitHub, Supabase, Lovable…) are AI build context,
// not gallery cards — connections to them are true but pure noise. Same
// override the gallery applies: the Process Guide is relational tech.
const galleryTools = tools.filter(
  t => t.tool_category !== 'tech_for_building' ||
    t.name.trim().toLowerCase() === 'relational tech process guide',
);

const entries = [
  ...galleryTools.map(t => ({
    source: 'kb_tool',
    id: t.id,
    title: t.name,
    kind: 'tool',
    text: [t.description, t.summary].filter(Boolean).join('\n'),
  })),
  ...stories.map(s => ({
    source: 'kb_story',
    id: s.id,
    title: s.title,
    kind: 'story',
    text: [s.story_text, s.full_story_text].filter(Boolean).join('\n'),
  })),
  ...commonsItems.map(c => ({
    source: 'commons',
    id: c.slug,
    title: c.title,
    kind: c.kind,
    text: [
      c.summary,
      c.body,
      // The civic-media recipes name their source projects here
      Array.isArray(c.metadata?.building_from) ? c.metadata.building_from.join('\n') : null,
    ].filter(Boolean).join('\n'),
  })),
];

console.log(
  `Scanning ${entries.length} entries ` +
    `(${galleryTools.length} tools, ${stories.length} stories, ${commonsItems.length} commons items)…`,
);

// --- Match titles in text ---
// Titles shorter than this match too promiscuously ("Home", "Notes")
const MIN_TITLE_LENGTH = 6;
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const suggestions = [];
for (const target of entries) {
  const title = (target.title ?? '').trim();
  if (title.length < MIN_TITLE_LENGTH) continue;
  // Whole-words, case-insensitive: "People's Supper" matches mid-sentence,
  // "Commons" alone doesn't match "Commons Gallery"
  const re = new RegExp(`(^|\\W)${escapeRe(title)}($|\\W)`, 'i');
  for (const source of entries) {
    if (source === target) continue;
    if (source.source === target.source && source.id === target.id) continue;
    // An entry whose own title contains the target's title (or vice versa)
    // isn't a reference — it's a family of same-named things
    const sourceTitle = (source.title ?? '').toLowerCase();
    if (sourceTitle.includes(title.toLowerCase()) || title.toLowerCase().includes(sourceTitle)) continue;
    if (!re.test(source.text)) continue;
    suggestions.push({
      from_source: source.source,
      from_id: String(source.id),
      from_title: source.title,
      from_kind: source.kind,
      to_source: target.source,
      to_id: String(target.id),
      to_title: title,
      to_kind: target.kind,
      relation: 'mentions',
      status: 'suggested',
      created_by: 'suggest-gallery-references',
    });
  }
}

// Same-titled entries (a KB story republished in the commons) can produce
// the same (from, to) pair twice in one scan — keep the first
const seen = new Set();
const deduped = suggestions.filter(s => {
  const key = `${s.from_source}:${s.from_id}→${s.to_source}:${s.to_id}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

console.log(`Found ${deduped.length} suggested connections.`);
for (const s of deduped) {
  console.log(`  ${s.from_title} (${s.from_kind}) → ${s.to_title} (${s.to_kind})`);
}

if (DRY_RUN) {
  console.log('Dry run — nothing written.');
  process.exit(0);
}
if (deduped.length === 0) process.exit(0);

// --- Write, ignoring pairs that already exist (suggested OR confirmed) ---
const res = await fetch(
  `${BUILDER_URL}/rest/v1/gallery_references?on_conflict=from_source,from_id,to_source,to_id`,
  {
    method: 'POST',
    headers: {
      apikey: BUILDER_KEY,
      Authorization: `Bearer ${BUILDER_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=ignore-duplicates',
    },
    body: JSON.stringify(deduped),
  },
);
if (!res.ok) {
  console.error(`Write failed → ${res.status}: ${await res.text()}`);
  process.exit(1);
}
console.log('Written. Review them in the Steward page → Connections tab.');
