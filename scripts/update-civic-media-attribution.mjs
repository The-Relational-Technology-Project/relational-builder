#!/usr/bin/env node
/**
 * Re-attribute the Civic Media Cookbook shelf in the RT Commons, verified
 * line-by-line against the published Cookbook ("Producing Civic Media",
 * News Futures 2026, newsfutures.org/library/civic-media-cookbook).
 *
 * What it changes:
 *  - The ten recipes: attribution.name becomes the practitioners behind the
 *    projects each recipe "builds from" (per the Cookbook's own lists and
 *    Appendix 2 credits); the Cookbook + curators move to attribution.source.
 *  - Connection Infrastructure: restores the two source projects the seed
 *    dropped (Community Newsroom, Swapping Stories) in body + metadata.
 *  - Cooking Techniques: credits each technique's originators, with Peggy
 *    Holman's Cookbook chapter as the source. The chapter's other two
 *    techniques (World Café, Appreciative Inquiry) already live in the
 *    commons as Neighboring Recipes (rtp-canonical shelf) — duplicating
 *    them under civic-media would collide in the slug-only detail lookup —
 *    so their originators are credited on those existing rows instead.
 *  - The 50 field-guide stories: adds the Cookbook field guide as
 *    attribution.source (practitioners stay the primary credit), and fixes
 *    "El Timpano" → "El Tímpano".
 *  - Sets source_url to the Cookbook page on cookbook-attributed rows.
 *  Patterns and worksheets stay credited to the curators — their own work.
 *
 * Applies via the Supabase Management API (SQL over
 * POST /v1/projects/{ref}/database/query). Dry-run prints the SQL;
 * pass --apply to execute.
 *
 *   SUPABASE_ACCESS_TOKEN=... node scripts/update-civic-media-attribution.mjs [--apply]
 */

const PROJECT_REF = process.env.COMMONS_PROJECT_REF ?? 'odowkowcinyoxejyzhwl';
const COOKBOOK_URL = 'https://www.newsfutures.org/library/civic-media-cookbook';

const COOKBOOK_SOURCE =
  'Civic Media Cookbook (2026) — Jihii Jolly & Jennifer Brandel, with the News Futures Working Group';
const TECHNIQUES_SOURCE = "Civic Media Cookbook (2026), 'Cooking Techniques' by Peggy Holman";
const FIELD_GUIDE_SOURCE = 'Civic Media Cookbook (2026), Appendix 2: Field Guide';

// Primary creators per recipe: the practitioners behind each recipe's
// "Building from" projects, in the Cookbook's order, deduped, matched to
// the Appendix 2 field-guide credits. (The Wall of Wrigley Field and
// story circles are anonymous/traditional, so they appear as lineage in
// the body rather than named creators — except where a recipe leans on
// story circles directly, credited as "story-circle traditions".)
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
    "People's Supper, Resolve Philly, jesikah maria ross, Radio Ambulante, Black Student Union (Queens University), Greater Govanhill & The Ferret, Judy Thibault Klevins & story-circle traditions",
  'crisis-activation':
    'Rachel Falcone & Michael Premo, Boulder Reporting Lab & Filipino Young Leaders Program',
  'making-invisible-visible':
    'Sonja Neill-Turner, Public Source, News Ambassadors / Latino News Network & Zakia Moulaoui Guery',
  'navigation-networks':
    'Graham Media Group, Filipino Young Leaders Program, The Trace & Microcosm Publishing',
  'place-as-canvas':
    'Andrew Losowsky & Lyra Monteiro, Development Research Institute (NYU), Oakland Lowdown & El Tímpano',
  'priority-setting':
    'Oakland Lowdown & Oakland North, LAist, Arizona Luminaria, Tellervo Kalleinen & Oliver Kochta-Kalleinen',
};

// The Cookbook's Cooking Techniques chapter (by Peggy Holman) describes four
// techniques. Two live on the civic-media shelf; the other two live on the
// Neighboring Recipes shelf. Credit each technique's originators.
const CIVIC_MEDIA_TECHNIQUES = {
  'open-space': 'Harrison Owen',
  'dialogue-circles': 'Various talking-circle traditions',
};
const NEIGHBORING_TECHNIQUES = {
  'world-cafe': 'Juanita Brown & David Isaacs',
  'appreciative-inquiry': 'David Cooperrider & Suresh Srivastva',
  'open-space-technology': 'Harrison Owen',
};

// Connection Infrastructure builds from eight projects in the Cookbook;
// the seed dropped these two.
const CONNECTION_BUILDING_FROM = [
  "People's Supper", 'Sound OFF', 'Lunch & Listens', 'Radio Ambulante Listening Clubs',
  'Barbershop Talk', 'Community Newsroom', 'Story Circles', 'Swapping Stories',
];

const q = s => `$q$${s}$q$`; // dollar-quote; payloads contain no `$q$`
const jb = v => `${q(JSON.stringify(v))}::jsonb`;

const statements = [];

for (const [slug, name] of Object.entries(RECIPES)) {
  statements.push(
    `UPDATE commons_items SET attribution = attribution || ${jb({ name, source: COOKBOOK_SOURCE })}\n` +
    `WHERE source_studio_slug = 'civic-media' AND kind = 'recipe' AND slug = ${q(slug)};`,
  );
}

statements.push(
  `UPDATE commons_items SET\n` +
  `  metadata = jsonb_set(metadata, '{building_from}', ${jb(CONNECTION_BUILDING_FROM)}),\n` +
  `  body = replace(body, E'- Barbershop Talk\\n- Story Circles',\n` +
  `                 E'- Barbershop Talk\\n- Community Newsroom\\n- Story Circles\\n- Swapping Stories')\n` +
  `WHERE source_studio_slug = 'civic-media' AND slug = 'connection-infrastructure'\n` +
  `  AND body NOT LIKE '%Community Newsroom%';`,
);

for (const [slug, name] of Object.entries(CIVIC_MEDIA_TECHNIQUES)) {
  statements.push(
    `UPDATE commons_items SET attribution = attribution || ${jb({ name, source: TECHNIQUES_SOURCE })}\n` +
    `WHERE source_studio_slug = 'civic-media' AND slug = ${q(slug)};`,
  );
}

// Originator credit only — no attribution.source, so these keep their
// Neighboring Recipes shelf identity.
for (const [slug, name] of Object.entries(NEIGHBORING_TECHNIQUES)) {
  statements.push(
    `UPDATE commons_items SET attribution = attribution || ${jb({ name })}\n` +
    `WHERE source_studio_slug = 'rtp-canonical' AND slug = ${q(slug)};`,
  );
}

// Field-guide stories: practitioners stay primary; the Cookbook's field
// guide becomes the source line. Fix the El Tímpano accent while here.
statements.push(
  `UPDATE commons_items SET attribution = attribution || ${jb({ source: FIELD_GUIDE_SOURCE })}\n` +
  `WHERE source_studio_slug = 'civic-media' AND kind = 'story';`,
  `UPDATE commons_items SET attribution = attribution || ${jb({ name: 'El Tímpano' })}\n` +
  `WHERE source_studio_slug = 'civic-media' AND slug = 'memories-of-the-market';`,
  `UPDATE commons_items SET source_url = ${q(COOKBOOK_URL)}\n` +
  `WHERE source_studio_slug = 'civic-media' AND source_url IS NULL\n` +
  `  AND attribution->>'source' LIKE 'Civic Media Cookbook%';`,
);

statements.push(
  `SELECT kind, count(*) AS n, count(*) FILTER (WHERE attribution->>'source' LIKE 'Civic Media Cookbook%') AS cookbook_sourced\n` +
  `FROM commons_items WHERE source_studio_slug = 'civic-media' GROUP BY kind ORDER BY kind;`,
);

const sql = statements.join('\n\n');
const apply = process.argv.includes('--apply');

if (!apply) {
  console.log(sql);
  console.log('\n-- Dry run: pass --apply to execute via the Management API.');
  process.exit(0);
}

const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN is required to apply.');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
});
if (!res.ok) {
  console.error(`Management API query failed (${res.status}): ${await res.text()}`);
  process.exit(1);
}
console.log('Applied. Post-update counts by kind:');
console.log(JSON.stringify(await res.json(), null, 2));
