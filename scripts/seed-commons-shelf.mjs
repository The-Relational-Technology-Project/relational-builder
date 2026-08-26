#!/usr/bin/env node
/**
 * Seed (or re-seed) a shelf in the RT Commons (commons_items in the RTP
 * website Supabase project) from a JSON draft file.
 *
 * Unlike seed-studio-library.mjs (which targets the Builder backend's
 * studio_library_items), this writes to the global commons: it upserts a
 * commons_studios row for the shelf, then upserts every item keyed on
 * (slug, kind). Re-running is safe — existing rows are updated in place.
 *
 * Applies via the Supabase Management API (SQL over
 * POST /v1/projects/{ref}/database/query). Dry-run prints the SQL;
 * pass --apply to execute.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/seed-commons-shelf.mjs scripts/seed/<shelf>.json [--apply]
 *
 * JSON shape:
 *   {
 *     "studio": { "slug": "...", "display_name": "...", "home_url": null, "notes": "..." },
 *     "items": [ { "slug", "kind", "title", "summary", "body", "attribution": {},
 *                  "source_url", "tags": [], "image_urls": [], "metadata": {},
 *                  "license", "sort_order" } ]
 *   }
 */

import { readFileSync } from 'node:fs';

const PROJECT_REF = process.env.COMMONS_PROJECT_REF ?? 'odowkowcinyoxejyzhwl';
const KINDS = new Set(['methodology', 'framework', 'recipe', 'reference', 'tool', 'story', 'prompt']);

const file = process.argv.find(a => a.endsWith('.json'));
if (!file) {
  console.error('Usage: node scripts/seed-commons-shelf.mjs <seed.json> [--apply]');
  process.exit(1);
}

const seed = JSON.parse(readFileSync(file, 'utf8'));
const studio = seed.studio ?? {};
const slug = String(studio.slug ?? '').trim().toLowerCase();
const items = Array.isArray(seed.items) ? seed.items : [];
if (!slug || items.length === 0) {
  console.error('Seed file needs studio.slug and a non-empty items array');
  process.exit(1);
}

const q = s => `'${String(s).replace(/'/g, "''")}'`;
const qn = s => (s === null || s === undefined ? 'NULL' : q(s));
const jb = v => `${q(JSON.stringify(v ?? {}))}::jsonb`;
const arr = a =>
  Array.isArray(a) && a.length ? `ARRAY[${a.map(q).join(',')}]::text[]` : `ARRAY[]::text[]`;

const problems = [];
const seen = new Set();
for (const [i, it] of items.entries()) {
  if (!KINDS.has(it.kind)) problems.push(`item ${i} ("${it.title}"): invalid kind "${it.kind}"`);
  if (!it.slug || !it.title) problems.push(`item ${i}: needs slug and title`);
  const key = `${it.slug}`;
  // The Builder's detail lookup is slug-only, so slugs must be unique
  // across the whole table, not just per (slug, kind).
  if (seen.has(key)) problems.push(`duplicate slug in seed: ${key}`);
  seen.add(key);
}
if (problems.length) {
  console.error('Seed file problems:\n  ' + problems.join('\n  '));
  process.exit(1);
}

const statements = [];

statements.push(
  `INSERT INTO commons_studios (slug, display_name, home_url, publish_key_hash, steward_email, notes)\n` +
    `VALUES (${q(slug)}, ${q(studio.display_name ?? slug)}, ${qn(studio.home_url)}, 'managed-by-seed-commons-shelf', ` +
    `${q(studio.steward_email ?? 'humans@relationaltechproject.org')}, ${qn(studio.notes)})\n` +
    `ON CONFLICT (slug) DO UPDATE SET display_name = EXCLUDED.display_name, home_url = EXCLUDED.home_url, notes = EXCLUDED.notes;`,
);

for (const [i, it] of items.entries()) {
  const sort = Number.isFinite(it.sort_order) ? it.sort_order : (i + 1) * 10;
  statements.push(
    `INSERT INTO commons_items (slug, kind, title, summary, body, attribution, source_studio_slug, source_url, tags, image_urls, metadata, license, status, sort_order, published_at)\n` +
      `VALUES (${q(it.slug)}, ${q(it.kind)}, ${q(it.title)}, ${qn(it.summary)}, ${qn(it.body)}, ${jb(it.attribution)}, ` +
      `${q(slug)}, ${qn(it.source_url)}, ${arr(it.tags)}, ${arr(it.image_urls)}, ${jb(it.metadata)}, ${qn(it.license)}, 'canonical', ${sort}, now())\n` +
      `ON CONFLICT (slug, kind) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, body = EXCLUDED.body, ` +
      `attribution = EXCLUDED.attribution, source_studio_slug = EXCLUDED.source_studio_slug, source_url = EXCLUDED.source_url, ` +
      `tags = EXCLUDED.tags, image_urls = EXCLUDED.image_urls, metadata = EXCLUDED.metadata, license = EXCLUDED.license, sort_order = EXCLUDED.sort_order, updated_at = now();`,
  );
}

statements.push(
  `SELECT kind, count(*) AS n FROM commons_items WHERE source_studio_slug = ${q(slug)} GROUP BY kind ORDER BY kind;`,
);

const sql = statements.join('\n\n');
const apply = process.argv.includes('--apply');

if (!apply) {
  console.log(sql);
  console.error(`\n-- Dry run: ${items.length} items for shelf "${slug}". Pass --apply to execute via the Management API.`);
  process.exit(0);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is required to apply.');
  process.exit(1);
}

async function query(sqlText) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sqlText }),
  });
  if (!res.ok) throw new Error(`Management API query failed (${res.status}): ${await res.text()}`);
  return res.json();
}

// Preflight: the Builder's detail view fetches by slug alone, so a slug
// already used by ANOTHER shelf would collide in that lookup.
const collisions = await query(
  `SELECT slug, kind, source_studio_slug FROM commons_items WHERE slug IN (${[...seen].map(q).join(',')}) AND (source_studio_slug IS DISTINCT FROM ${q(slug)});`,
);
if (Array.isArray(collisions) && collisions.length) {
  console.error('Aborting — these slugs already exist on other shelves:');
  for (const c of collisions) console.error(`  ${c.slug} (${c.kind}, shelf: ${c.source_studio_slug})`);
  process.exit(1);
}

const result = await query(sql);
console.log(`Applied shelf "${slug}". Post-seed counts by kind:`);
console.log(JSON.stringify(result, null, 2));
