#!/usr/bin/env node
/**
 * Re-attribute the ten Civic Media Cookbook recipes in the RT Commons.
 *
 * The Cookbook curators (Jihii Jolly & Jennifer Brandel, with the News
 * Futures Working Group) currently sit in attribution.name on every recipe,
 * so all ten cards read as their work. Each recipe distills real projects
 * (metadata.building_from), whose practitioners are credited on the matching
 * field-example stories — this script moves those practitioners into
 * attribution.name (the primary card line) and credits the Cookbook in
 * attribution.source (the secondary line). Patterns, worksheets, and the
 * cheat sheets stay attributed to the curators: those are their own work.
 *
 * commons_items is RLS-gated, so this runs with the commons service role
 * key — steward hands only. Dry-run by default; pass --apply to write.
 *
 *   COMMONS_SUPABASE_URL=https://odowkowcinyoxejyzhwl.supabase.co \
 *   COMMONS_SERVICE_ROLE_KEY=... \
 *   node scripts/update-civic-media-attribution.mjs [--apply]
 */

const COOKBOOK_SOURCE =
  'Civic Media Cookbook (2026) — Jihii Jolly & Jennifer Brandel, with the News Futures Working Group';

// Primary creators per recipe: the practitioners behind the projects each
// recipe builds from, in building_from order, deduped. Names match the
// attribution on the corresponding field-example stories in the commons.
const RECIPES = {
  'care-webs':
    'Filipino Young Leaders Program, Graham Media Group, Neighborland & CapRadio',
  'community-research-teams':
    'Bureau Local, LAist, Oakland Lowdown, CapRadio & Development Research Institute (NYU)',
  'community-support-spaces':
    'Rachel Falcone & Michael Premo, CapRadio & story-circle traditions',
  'community-stewarded-stories':
    'Prison Journalism Project, Radio Ambulante, Public Source, India Currents, June Jordan & Reynolds Journalism Institute',
  'connection-infrastructure':
    "People's Supper, Resolve Philly, jesikah maria ross, Radio Ambulante & Black Student Union (Queens University)",
  'crisis-activation':
    'Rachel Falcone & Michael Premo, Boulder Reporting Lab & Filipino Young Leaders Program',
  'making-invisible-visible':
    'Sonja Neill-Turner, Public Source, News Ambassadors & Zakia Moulaoui Guery',
  'navigation-networks':
    'Graham Media Group, Filipino Young Leaders Program, The Trace & Microcosm Publishing',
  'place-as-canvas':
    'Andrew Losowsky & Lyra Monteiro, Development Research Institute (NYU), Oakland Lowdown & El Tímpano',
  'priority-setting':
    'Oakland Lowdown & Oakland North, LAist, Arizona Luminaria, Tellervo Kalleinen & Oliver Kochta-Kalleinen',
};

const url = process.env.COMMONS_SUPABASE_URL;
const key = process.env.COMMONS_SERVICE_ROLE_KEY;
const apply = process.argv.includes('--apply');

if (!url || !key) {
  console.error(
    'Usage: COMMONS_SUPABASE_URL=... COMMONS_SERVICE_ROLE_KEY=... ' +
      'node scripts/update-civic-media-attribution.mjs [--apply]',
  );
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
};

async function rest(path, init = {}) {
  const res = await fetch(`${url}/rest/v1${path}`, { ...init, headers: { ...headers, ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${await res.text()}`);
  return res;
}

let changed = 0;
for (const [slug, name] of Object.entries(RECIPES)) {
  const rows = await (await rest(
    `/commons_items?slug=eq.${encodeURIComponent(slug)}&source_studio_slug=eq.civic-media&select=slug,attribution`,
  )).json();
  if (rows.length !== 1) {
    console.error(`✗ ${slug}: expected 1 row, found ${rows.length} — skipping`);
    continue;
  }
  const attribution = { ...rows[0].attribution, name, source: COOKBOOK_SOURCE };
  console.log(`${apply ? '→' : '(dry-run)'} ${slug}`);
  console.log(`    name:   ${name}`);
  console.log(`    source: ${COOKBOOK_SOURCE}`);
  if (apply) {
    await rest(`/commons_items?slug=eq.${encodeURIComponent(slug)}&source_studio_slug=eq.civic-media`, {
      method: 'PATCH',
      body: JSON.stringify({ attribution }),
    });
    changed += 1;
  }
}

console.log(apply ? `\nUpdated ${changed} recipes.` : '\nDry run — pass --apply to write.');
