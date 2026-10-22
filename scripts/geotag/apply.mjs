#!/usr/bin/env node
/**
 * Write the geocoded locations into the databases.
 *
 * Reads scripts/geotag/locations.json (from geocode.mjs) and sets:
 *   - commons_items.metadata.location on the RT Commons (the RTP website's
 *     Supabase project), keyed by slug;
 *   - studio_library_items.location on the Builder backend, keyed by id.
 *     (An event's inspiration shelf takes the event's own place; see
 *     event_codes.location, set from the Steward page.)
 *
 * Runs through the Supabase Management API's query endpoint, the same door
 * the deploy notes in CLAUDE.md use, so it needs:
 *   SUPABASE_ACCESS_TOKEN   a personal access token that reaches both projects
 *   COMMONS_PROJECT_REF     the commons project (default: the RTP website's)
 *   SUPABASE_PROJECT_REF    the Builder backend
 *
 *   node scripts/geotag/apply.mjs            # write everything in locations.json
 *   node scripts/geotag/apply.mjs --dry-run  # count what would change, write nothing
 *
 * An item whose entry is null has its location REMOVED, so places.json is
 * the whole truth: edit it, geocode, apply. Other metadata keys are left
 * alone (the commons' metadata is shared with other writers).
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const locations = JSON.parse(readFileSync(join(here, 'locations.json'), 'utf8'));
const dryRun = process.argv.includes('--dry-run');

const token = process.env.SUPABASE_ACCESS_TOKEN;
const commonsRef = process.env.COMMONS_PROJECT_REF ?? 'odowkowcinyoxejyzhwl';
const builderRef = process.env.SUPABASE_PROJECT_REF;
if (!token) { console.error('SUPABASE_ACCESS_TOKEN is required'); process.exit(1); }
if (!builderRef) { console.error('SUPABASE_PROJECT_REF (the Builder backend) is required'); process.exit(1); }

async function query(ref, sql) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) throw new Error(`${ref}: ${res.status} ${await res.text()}`);
  return res.json();
}

/** One VALUES list the SQL can join against: (key, location-or-null) */
function valuesFor(section) {
  return Object.entries(locations[section] ?? {})
    .map(([key, loc]) => `(${lit(key)}, ${loc ? `${lit(JSON.stringify(loc))}::jsonb` : 'null::jsonb'})`)
    .join(',\n');
}
const lit = s => `'${String(s).replace(/'/g, "''")}'`;

const counts = {};
for (const section of ['commons', 'studio_items']) {
  const all = Object.values(locations[section] ?? {});
  counts[section] = { placed: all.filter(Boolean).length, cleared: all.filter(l => !l).length };
}
console.log(dryRun ? 'dry run —' : 'applying —', JSON.stringify(counts));
if (dryRun) process.exit(0);

// Commons: by slug. A slug can carry two rows (a Studio prompt and its
// tool share one); both get the place.
const commonsSql = `
with v(slug, loc) as (values ${valuesFor('commons')})
update public.commons_items c
set metadata = case
  when v.loc is null then (coalesce(c.metadata, '{}'::jsonb) - 'location')
  else jsonb_set(coalesce(c.metadata, '{}'::jsonb), '{location}', v.loc, true)
end,
updated_at = now()
from v
where c.slug = v.slug
returning c.slug`;
const commonsRows = await query(commonsRef, commonsSql);
console.log(`commons_items: ${commonsRows.length} rows updated`);

const studioSql = `
with v(id, loc) as (values ${valuesFor('studio_items')})
update public.studio_library_items s
set location = v.loc, updated_at = now()
from v
where s.id = v.id::uuid
returning s.id`;
const studioRows = await query(builderRef, studioSql);
console.log(`studio_library_items: ${studioRows.length} rows updated`);
