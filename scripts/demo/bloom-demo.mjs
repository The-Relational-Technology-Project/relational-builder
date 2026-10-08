#!/usr/bin/env node
/**
 * BLOOM Studio demo helper — two test accounts and the state between runs.
 *
 *   node scripts/demo/bloom-demo.mjs setup    # accounts, profiles, BLOOM admin seat
 *   node scripts/demo/bloom-demo.mjs reset    # Mission host back to "not a member yet"
 *   node scripts/demo/bloom-demo.mjs status   # what the loop currently looks like
 *   node scripts/demo/bloom-demo.mjs link <email> [origin]
 *                                             # a one-time sign-in URL (service key only)
 *
 * Data goes through the Supabase Management API (SUPABASE_ACCESS_TOKEN +
 * SUPABASE_PROJECT_REF — the sandbox default, see CLAUDE.md). Creating auth
 * users and minting sign-in links need the Builder project's service role
 * key (BUILDER_SUPABASE_URL + BUILDER_SERVICE_ROLE_KEY); without it, `setup`
 * still approves the emails and the sign-in gate creates each user the first
 * time they sign in by email.
 *
 * The accounts are plus-addresses on the steward's inbox, so the magic-link
 * codes arrive somewhere a demo can read them:
 *   joshuanesbit+missionhost@gmail.com  — "Mission host", a civic host member
 *   joshuanesbit+bloomadmin@gmail.com   — "BLOOM admin", a Studio Admin
 */

const STUDIO = 'bloom';
const STUDIO_LABEL = 'Bloom Studio';
export const ACCOUNTS = {
  host: {
    email: 'joshuanesbit+missionhost@gmail.com',
    display_name: 'Mission host (demo)',
    full_name: 'Mission Neighbors (demo host)',
    neighborhood: 'Mission District, San Francisco',
    neighborhood_description: 'A demo civic host: a neighborhood group in the Mission working through a public question with its neighbors.',
  },
  admin: {
    email: 'joshuanesbit+bloomadmin@gmail.com',
    display_name: 'BLOOM admin (demo)',
    full_name: 'BLOOM Project (demo admin)',
    neighborhood: 'BLOOM Project',
    neighborhood_description: 'A demo Studio Admin seat for BLOOM Project.',
  },
};

const mgmtToken = process.env.SUPABASE_ACCESS_TOKEN;
const mgmtRef = process.env.SUPABASE_PROJECT_REF;
const url = process.env.BUILDER_SUPABASE_URL;
const key = process.env.BUILDER_SERVICE_ROLE_KEY;
const haveService = Boolean(url && key);

if (!mgmtToken || !mgmtRef) {
  console.error('Needs SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF (Management API).');
  process.exit(1);
}

export async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${mgmtRef}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${mgmtToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`SQL → ${res.status}: ${await res.text()}`);
  return res.json();
}
const lit = v => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

async function authAdmin(path, init = {}) {
  const res = await fetch(`${url}/auth/v1${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

async function userId(email) {
  const rows = await sql(`select id from auth.users where lower(email) = ${lit(email.toLowerCase())} limit 1`);
  return rows[0]?.id ?? null;
}

async function ensureUser(account) {
  let id = await userId(account.email);
  if (!id && haveService) {
    const created = await authAdmin('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ email: account.email, email_confirm: true }),
    });
    id = created.id;
    console.log(`created auth user ${account.email}`);
  }
  if (!id) {
    console.log(`${account.email}: no auth user yet — the sign-in gate creates it at first sign-in`);
    return null;
  }
  await sql(`
    insert into public.profiles (id, email, display_name, full_name, neighborhood, neighborhood_description, profile_completed, terms_accepted_at)
    values (${lit(id)}, ${lit(account.email)}, ${lit(account.display_name)}, ${lit(account.full_name)}, ${lit(account.neighborhood)}, ${lit(account.neighborhood_description)}, true, now())
    on conflict (id) do update set
      display_name = excluded.display_name,
      full_name = excluded.full_name,
      neighborhood = excluded.neighborhood,
      neighborhood_description = excluded.neighborhood_description,
      profile_completed = true,
      terms_accepted_at = coalesce(public.profiles.terms_accepted_at, now())
  `);
  return id;
}

async function setup() {
  for (const account of Object.values(ACCOUNTS)) {
    // Approved for sign-in and for community (no-key) builds
    await sql(`
      insert into public.community_members (email, note, weekly_token_budget)
      values (${lit(account.email)}, 'BLOOM Studio demo account', 5000000)
      on conflict (email) do update set note = excluded.note
    `);
    await ensureUser(account);
  }
  const adminId = await userId(ACCOUNTS.admin.email);
  if (adminId) {
    await sql(`
      insert into public.studio_memberships (user_id, studio_slug, studio_label, display_name, role, status)
      values (${lit(adminId)}, ${lit(STUDIO)}, ${lit(STUDIO_LABEL)}, ${lit(ACCOUNTS.admin.display_name)}, 'admin', 'approved')
      on conflict (user_id, studio_slug) do update set role = 'admin', status = 'approved'
    `);
    console.log(`${ACCOUNTS.admin.email} seated as ${STUDIO_LABEL} admin`);
  } else {
    console.log(`BLOOM admin seat waits for the account: run setup again after ${ACCOUNTS.admin.email} signs in once`);
  }
  await reset();
}

/** The Mission host back to the start of the loop: not a member, nothing offered */
async function reset() {
  const hostId = await userId(ACCOUNTS.host.email);
  if (!hostId) {
    console.log('reset: no Mission host account yet, nothing to clear');
    return;
  }
  const offers = await sql(`
    delete from public.studio_library_items
    where studio_slug = ${lit(STUDIO)} and created_by = ${lit(hostId)}
    returning title
  `);
  const projects = await sql(`
    delete from public.projects
    where owner_id = ${lit(hostId)}
      and (lineage ->> 'studioSlug' = ${lit(STUDIO)}
        or exists (select 1 from public.studio_library_items li
                   where li.studio_slug = ${lit(STUDIO)} and li.id::text = projects.lineage ->> 'studioItemId'))
    returning name
  `);
  const sites = await sql(`
    delete from public.community_sites
    where lower(owner_email) = ${lit(ACCOUNTS.host.email.toLowerCase())}
    returning slug
  `);
  await sql(`delete from public.studio_memberships where user_id = ${lit(hostId)} and studio_slug = ${lit(STUDIO)}`);
  console.log(
    `reset: Mission host is no longer a ${STUDIO_LABEL} member; removed ${offers.length} offer(s), ` +
      `${projects.length} studio project(s), ${sites.length} published site(s)`,
  );
}

async function status() {
  const members = await sql(`
    select p.email, m.role, m.status, m.joined_at
    from public.studio_memberships m left join public.profiles p on p.id = m.user_id
    where m.studio_slug = ${lit(STUDIO)} order by m.joined_at
  `);
  const shelf = await sql(`
    select kind, title, status, visibility, attribution, tags,
           (select title from public.studio_library_items x where x.id = i.remix_of) as remix_of
    from public.studio_library_items i where studio_slug = ${lit(STUDIO)} order by sort_order, created_at
  `);
  console.log(`\n${STUDIO_LABEL} members:`);
  for (const m of members) console.log(`  ${m.email ?? '?'}  ${m.role}/${m.status}`);
  console.log(`\n${STUDIO_LABEL} shelf (${shelf.length}):`);
  for (const i of shelf) {
    const draft = (i.tags ?? []).includes('draft-for-bloom-review') ? ' [draft]' : '';
    console.log(`  ${i.status === 'pending' ? '⏳' : '✓ '} ${i.kind.padEnd(9)} ${i.title}${i.remix_of ? `  ← ${i.remix_of}` : ''}${draft}`);
  }
}

/** A one-time sign-in URL for headless or scripted runs — service key only */
async function link(email, origin = 'http://localhost:5199') {
  if (!haveService) throw new Error('link needs BUILDER_SUPABASE_URL and BUILDER_SERVICE_ROLE_KEY');
  const out = await authAdmin('/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type: 'magiclink', email }),
  });
  const hash = out.hashed_token ?? out.properties?.hashed_token;
  if (!hash) throw new Error('no hashed_token in response');
  return `${origin.replace(/\/$/, '')}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink`;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*\//, ''));
if (isMain) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'setup') await setup();
    else if (cmd === 'reset') await reset();
    else if (cmd === 'status') await status();
    else if (cmd === 'link') console.log(await link(rest[0] ?? ACCOUNTS.host.email, rest[1]));
    else {
      console.error('Usage: node scripts/demo/bloom-demo.mjs setup | reset | status | link <email> [origin]');
      process.exit(1);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
