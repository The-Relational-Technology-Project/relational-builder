/**
 * Supabase Edge Function: site-domains — a community's own address for a
 * community-hosted site.
 *
 * The community owns the domain and keeps its DNS wherever they bought it.
 * This function does three things for them: looks a domain up before they
 * commit to anything, registers the hostname with the hosting front (the
 * Vercel project that answers for relationalbuilder.org), and reads their
 * DNS back so the Builder can say exactly what is still missing.
 *
 * POST JSON (Builder session required, Authorization: Bearer <token>):
 *   { action: 'lookup', domain }       → what's at this name today: is it
 *                                        registered, who runs its DNS, does it
 *                                        carry email or a site already
 *   { action: 'add', slug, domain }    → connect an owned site to the domain
 *   { action: 'status', slug }         → the site's domain (or null), the
 *                                        records it needs, and how each one
 *                                        looks from the outside right now
 *   { action: 'remove', slug }         → disconnect
 *
 * A bare domain and its www twin travel together: the one the builder typed
 * is the address, the other redirects to it. Other subdomains stand alone.
 *
 * Secrets: VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID (the hosting
 * front). Without them lookup still works and the rest answers 503.
 *
 * See docs/CUSTOM-DOMAINS.md. Deploy with --no-verify-jwt.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_DOMAINS_PER_BUILDER = 5;
/** A half-finished claim stops blocking the name's real owner after this */
const STALE_PENDING_MS = 48 * 3600_000;

/** Names that are ours or a platform's, never a community's to point here */
const BLOCKED_SUFFIXES = [
  'relationalbuilder.org', 'vercel.app', 'vercel-dns.com',
  'supabase.co', 'netlify.app', 'github.io', 'pages.dev', 'localhost',
];
/** The Builder's own second address: its bare name and www are ours */
const BLOCKED_HOSTS = new Set(['relationalbuilder.xyz', 'www.relationalbuilder.xyz']);

/** Two-part endings where the registrable name is three labels long. Not the
 *  whole public suffix list: the common ones, so `elmstreet.co.uk` reads as a
 *  bare domain and not as a subdomain of `co.uk`. */
const TWO_PART_ENDINGS = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'edu.au', 'id.au',
  'co.nz', 'org.nz', 'net.nz', 'ac.nz', 'school.nz', 'kiwi.nz',
  'co.za', 'org.za', 'com.br', 'org.br', 'com.mx', 'org.mx', 'com.ar', 'com.co',
  'co.jp', 'or.jp', 'ne.jp', 'co.kr', 'or.kr', 'co.in', 'org.in', 'net.in',
  'co.il', 'org.il', 'com.sg', 'org.sg', 'com.hk', 'org.hk', 'com.tw', 'org.tw',
  'com.tr', 'org.tr', 'com.ph', 'org.ph', 'com.my', 'org.my', 'co.id', 'or.id',
  'com.ng', 'org.ng', 'co.ke', 'or.ke', 'com.gh', 'org.gh', 'com.pk', 'org.pk',
  'com.ua', 'org.ua', 'com.pl', 'org.pl', 'com.es', 'org.es', 'com.pt', 'org.pt',
]);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

// ── Names ──────────────────────────────────────────────────────────────

/** Whatever a person pastes (a URL, capitals, a trailing slash) → a bare
 *  hostname, or null when it can't be one. */
function normalizeDomain(input: unknown): string | null {
  let raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return null;
  raw = raw.replace(/^[a-z]+:\/\//, '').replace(/[/?#].*$/, '').replace(/:\d+$/, '').replace(/\.$/, '');
  let host: string;
  try {
    host = new URL(`http://${raw}`).hostname; // punycodes international names
  } catch {
    return null;
  }
  if (host.length > 253 || !host.includes('.')) return null;
  const labels = host.split('.');
  if (labels.some(l => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(l))) return null;
  if (/^\d+$/.test(labels[labels.length - 1])) return null; // an IP address
  return host;
}

function isBlocked(domain: string): boolean {
  return BLOCKED_HOSTS.has(domain) || BLOCKED_SUFFIXES.some(s => domain === s || domain.endsWith(`.${s}`));
}

/** The name a person registers: `elmstreet.place` for `library.elmstreet.place`. */
function registrableOf(domain: string): string {
  const labels = domain.split('.');
  const take = TWO_PART_ENDINGS.has(labels.slice(-2).join('.')) ? 3 : 2;
  return labels.slice(-take).join('.');
}

/** The www/bare twin that should redirect to `domain`, if it has one. */
function twinOf(domain: string, registrable: string): string | null {
  if (domain === registrable) return `www.${registrable}`;
  if (domain === `www.${registrable}`) return registrable;
  return null;
}

/** A record's host field the way registrars ask for it: `@`, `www`, `library`. */
function hostLabel(name: string, registrable: string): string {
  return name === registrable ? '@' : name.slice(0, -(registrable.length + 1));
}

// ── DNS, read from the outside ─────────────────────────────────────────

const RR = { A: 1, NS: 2, CNAME: 5, MX: 15 } as const;

async function doh(name: string, type: keyof typeof RR): Promise<{ nx: boolean; byType: Record<number, string[]> }> {
  try {
    const res = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`,
      { signal: AbortSignal.timeout(6000) },
    );
    const body = res.ok ? await res.json() : {};
    const byType: Record<number, string[]> = {};
    for (const a of (body.Answer ?? []) as { type: number; data: string }[]) {
      (byType[a.type] ??= []).push(String(a.data).toLowerCase().replace(/\.$/, ''));
    }
    return { nx: body.Status === 3, byType };
  } catch {
    return { nx: false, byType: {} };
  }
}

interface NameFacts {
  /** Addresses the name resolves to right now */
  a: string[];
  /** What it's an alias of, if it is one */
  cname: string | null;
}

interface DnsFacts {
  /** False when the registrable name doesn't exist in DNS at all */
  registered: boolean;
  nameservers: string[];
  /** Mail servers on the registrable name: email is in use */
  mx: string[];
  names: Record<string, NameFacts>;
}

async function nameFacts(name: string): Promise<NameFacts> {
  const res = await doh(name, 'A');
  return { a: res.byType[RR.A] ?? [], cname: res.byType[RR.CNAME]?.[0] ?? null };
}

async function readDns(domain: string, registrable: string, also: string | null): Promise<DnsFacts> {
  // A subdomain can be its own zone with its own DNS host; the nearest
  // nameservers are the ones whose settings page the builder needs
  const zoneNames: string[] = [];
  for (let n = domain; n.length >= registrable.length; n = n.slice(n.indexOf('.') + 1)) {
    zoneNames.push(n);
    if (n === registrable) break;
  }
  const names = [domain, ...(also ? [also] : [])];
  const [zones, mx, ...facts] = await Promise.all([
    Promise.all(zoneNames.map(n => doh(n, 'NS'))),
    doh(registrable, 'MX'),
    ...names.map(nameFacts),
  ]);
  const nearest = zones.find(z => (z.byType[RR.NS] ?? []).length > 0);
  const apex = zones[zones.length - 1];
  return {
    registered: !apex.nx,
    nameservers: nearest?.byType[RR.NS] ?? [],
    // MX data is "10 mail.example.org"; keep the host
    mx: (mx.byType[RR.MX] ?? []).map(m => m.split(/\s+/).pop() ?? m).filter(Boolean),
    names: Object.fromEntries(names.map((n, i) => [n, facts[i]])),
  };
}

// ── The hosting front (Vercel) ─────────────────────────────────────────

interface Front {
  token: string;
  project: string;
  team: string;
}

function front(): Front | null {
  const token = Deno.env.get('VERCEL_TOKEN') ?? '';
  const project = Deno.env.get('VERCEL_PROJECT_ID') ?? '';
  if (!token || !project) return null;
  return { token, project, team: Deno.env.get('VERCEL_TEAM_ID') ?? '' };
}

async function vercel(f: Front, method: string, path: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const url = new URL(`https://api.vercel.com${path}`);
  if (f.team) url.searchParams.set('teamId', f.team);
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data: data as Record<string, unknown> };
}

function vercelError(data: Record<string, unknown>): { code: string; message: string } {
  const err = (data.error ?? {}) as { code?: string; message?: string };
  return { code: String(err.code ?? ''), message: String(err.message ?? '') };
}

/** Register a hostname with the front. Already there (ours from an earlier
 *  try) counts as done. */
async function attach(f: Front, name: string, redirectTo?: string): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const res = await vercel(f, 'POST', `/v10/projects/${f.project}/domains`, {
    name,
    ...(redirectTo ? { redirect: redirectTo, redirectStatusCode: 308 } : {}),
  });
  if (res.ok) return { ok: true };
  const err = vercelError(res.data);
  if (res.status === 409 || err.code === 'domain_already_in_use') {
    const mine = await vercel(f, 'GET', `/v9/projects/${f.project}/domains/${name}`);
    if (mine.ok) return { ok: true };
  }
  return { ok: false, ...err };
}

async function detach(f: Front, name: string): Promise<void> {
  await vercel(f, 'DELETE', `/v9/projects/${f.project}/domains/${name}`).catch(() => {});
}

interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  /** The host field as a registrar wants it: @, www, library, _vercel */
  host: string;
  value: string;
  /** The full name the record lives at */
  name: string;
  /** What it's for, so the UI can say it in a sentence */
  purpose: 'address' | 'twin' | 'proof';
  /** True once the outside world sees it */
  ok: boolean;
}

/**
 * What a name needs and how it looks right now, straight from the front:
 * its own recommended values (they can differ per project), whether it has
 * accepted the DNS, and any proof-of-ownership record it wants first (a
 * domain that sits in someone else's Vercel account).
 */
async function recordsFor(f: Front, name: string, registrable: string, purpose: 'address' | 'twin'): Promise<DnsRecord[]> {
  const [cfg, dom] = await Promise.all([
    vercel(f, 'GET', `/v6/domains/${name}/config?projectIdOrName=${f.project}`),
    vercel(f, 'GET', `/v9/projects/${f.project}/domains/${name}`),
  ]);
  const records: DnsRecord[] = [];
  // Ask the front to look again; it only re-checks proof records on request
  let verified = dom.data.verified !== false;
  if (!verified) {
    const again = await vercel(f, 'POST', `/v9/projects/${f.project}/domains/${name}/verify`);
    verified = again.ok && again.data.verified === true;
  }
  if (!verified) {
    for (const v of (dom.data.verification ?? []) as { type: string; domain: string; value: string }[]) {
      if (String(v.type).toUpperCase() !== 'TXT') continue;
      const at = String(v.domain).toLowerCase();
      records.push({ type: 'TXT', host: hostLabel(at, registrable), value: String(v.value), name: at, purpose: 'proof', ok: false });
    }
  }
  const ok = cfg.ok && cfg.data.misconfigured === false && verified;
  const best = <T,>(list: unknown): T | undefined =>
    (Array.isArray(list) ? [...list].sort((a, b) => Number(a.rank) - Number(b.rank))[0]?.value : undefined) as T | undefined;
  if (name === registrable) {
    const ips = best<string[]>(cfg.data.recommendedIPv4) ?? ['76.76.21.21'];
    records.push({ type: 'A', host: '@', value: ips[0], name, purpose, ok });
  } else {
    const cname = String(best<string>(cfg.data.recommendedCNAME) ?? 'cname.vercel-dns.com').replace(/\.$/, '');
    records.push({ type: 'CNAME', host: hostLabel(name, registrable), value: cname, name, purpose, ok });
  }
  return records;
}

/** Is the site actually answering there (DNS right and the certificate issued)? */
async function serving(domain: string): Promise<boolean> {
  try {
    const res = await fetch(`https://${domain}/`, { method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(7000) });
    return Boolean(res.headers.get('x-hosted-by'));
  } catch {
    return false;
  }
}

// ── The handler ────────────────────────────────────────────────────────

interface DomainRow {
  id: string;
  site_id: string;
  domain: string;
  also: string | null;
  status: string;
  created_at: string;
}

async function describe(f: Front, row: DomainRow): Promise<Record<string, unknown>> {
  const registrable = registrableOf(row.domain);
  const [own, twin, facts, live] = await Promise.all([
    recordsFor(f, row.domain, registrable, 'address'),
    row.also ? recordsFor(f, row.also, registrable, 'twin') : Promise.resolve([]),
    readDns(row.domain, registrable, row.also),
    serving(row.domain),
  ]);
  const records = [...own, ...twin];
  const status = live ? 'live' : 'pending';
  if (status !== row.status) {
    await fetch(rest(`/site_domains?id=eq.${row.id}`), {
      method: 'PATCH',
      headers: svc(),
      body: JSON.stringify({ status, ...(live ? { verified_at: new Date().toISOString() } : {}) }),
    }).catch(() => {});
  }
  return { domain: row.domain, also: row.also, registrable, status, records, facts };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const userRes = await fetch(`${Deno.env.get('SUPABASE_URL') ?? ''}/auth/v1/user`, {
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in to give your site its own address' }, 401);
    const email = String((await userRes.json()).email ?? '').toLowerCase();
    if (!email) return json({ error: 'Sign in to give your site its own address' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    // ---- Look a name up before committing to anything ----
    if (action === 'lookup') {
      const domain = normalizeDomain(body.domain);
      if (!domain) return json({ error: 'That doesn\'t look like a web address. Try something like elmstreet.place' }, 400);
      if (isBlocked(domain)) return json({ error: 'That address can\'t be used here. Try a domain your community owns' }, 400);
      const registrable = registrableOf(domain);
      const also = twinOf(domain, registrable);
      const [facts, takenRes] = await Promise.all([
        readDns(domain, registrable, also),
        fetch(rest(`/site_domains?or=(domain.eq.${domain},also.eq.${domain})&select=status,community_sites(owner_email)`), { headers: svc() }),
      ]);
      const taken: { status: string; community_sites: { owner_email: string } | null }[] = takenRes.ok ? await takenRes.json() : [];
      return json({
        ok: true,
        domain,
        also,
        registrable,
        facts,
        // Live on someone else's site: it can't be claimed from here
        taken: taken.some(t => t.status === 'live' && t.community_sites?.owner_email !== email),
      });
    }

    if (action !== 'add' && action !== 'status' && action !== 'remove') {
      return json({ error: 'Unknown action' }, 400);
    }

    // ---- Everything else is about one of the builder's own sites ----
    const slug = String(body.slug ?? '').toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!slug) return json({ error: 'Which site?' }, 400);
    const siteRes = await fetch(
      rest(`/community_sites?slug=eq.${slug}&kind=eq.site&select=id,owner_email`),
      { headers: svc() },
    );
    const found: { id: string; owner_email: string }[] = siteRes.ok ? await siteRes.json() : [];
    if (found.length === 0 || found[0].owner_email !== email) {
      return json({ error: 'No site of yours with that name' }, 404);
    }
    const siteId = found[0].id;

    const rowRes = await fetch(rest(`/site_domains?site_id=eq.${siteId}&select=id,site_id,domain,also,status,created_at`), { headers: svc() });
    const existing: DomainRow | undefined = rowRes.ok ? (await rowRes.json())[0] : undefined;

    if (action === 'status' && !existing) return json({ ok: true, domain: null });

    const f = front();
    if (!f) return json({ error: 'Custom addresses aren\'t switched on for this hosting yet' }, 503);

    if (action === 'status') {
      return json({ ok: true, ...(await describe(f, existing as DomainRow)) });
    }

    if (action === 'remove') {
      if (!existing) return json({ ok: true, domain: null });
      await Promise.all([detach(f, existing.domain), existing.also ? detach(f, existing.also) : Promise.resolve()]);
      await fetch(rest(`/site_domains?id=eq.${existing.id}`), { method: 'DELETE', headers: svc() });
      return json({ ok: true, domain: null });
    }

    // ---- add ----
    const domain = normalizeDomain(body.domain);
    if (!domain) return json({ error: 'That doesn\'t look like a web address. Try something like elmstreet.place' }, 400);
    if (isBlocked(domain)) return json({ error: 'That address can\'t be used here. Try a domain your community owns' }, 400);
    if (existing && existing.domain === domain) return json({ ok: true, ...(await describe(f, existing)) });
    if (existing) return json({ error: `This site already uses ${existing.domain}. Disconnect that address first.` }, 409);

    const registrable = registrableOf(domain);
    const also = twinOf(domain, registrable);
    const names = [domain, ...(also ? [also] : [])];

    // Someone else's claim on any of these names?
    const clashRes = await fetch(
      rest(`/site_domains?or=(domain.in.(${names.join(',')}),also.in.(${names.join(',')}))&select=id,domain,also,status,created_at,community_sites(owner_email)`),
      { headers: svc() },
    );
    const clashes: (DomainRow & { community_sites: { owner_email: string } | null })[] = clashRes.ok ? await clashRes.json() : [];
    for (const clash of clashes) {
      const theirs = clash.community_sites?.owner_email !== email;
      const stale = clash.status !== 'live' && Date.now() - Date.parse(clash.created_at) > STALE_PENDING_MS;
      if (theirs && !stale) {
        return json({
          error: clash.status === 'live'
            ? 'That address is already live on another site'
            : 'Someone else started connecting that address recently. If it\'s yours, try again in a couple of days or reply to your invite email and a human will help.',
        }, 409);
      }
      if (!theirs) return json({ error: `That address is connected to another of your sites. Disconnect it there first.` }, 409);
      // A stale claim by someone who never finished: release it
      await fetch(rest(`/site_domains?id=eq.${clash.id}`), { method: 'DELETE', headers: svc() });
    }

    const mineRes = await fetch(
      rest(`/site_domains?select=id,community_sites!inner(owner_email)&community_sites.owner_email=eq.${encodeURIComponent(email)}`),
      { headers: svc() },
    );
    const mine = mineRes.ok ? await mineRes.json() : [];
    if (mine.length >= MAX_DOMAINS_PER_BUILDER) {
      return json({ error: `Community hosting includes ${MAX_DOMAINS_PER_BUILDER} custom addresses per builder. Reach out to RTP if you need more.` }, 403);
    }

    const first = await attach(f, domain);
    if (!first.ok) {
      // The front's own reason, verbatim: it knows things we don't
      return json({ error: `The hosting service wouldn't take that address: ${first.message || first.code || 'no reason given'}` }, 422);
    }
    if (also) {
      const second = await attach(f, also, domain);
      if (!second.ok) {
        await detach(f, domain);
        return json({ error: `The hosting service wouldn't take ${also}: ${second.message || second.code || 'no reason given'}` }, 422);
      }
    }

    const insRes = await fetch(rest('/site_domains'), {
      method: 'POST',
      headers: { ...svc(), Prefer: 'return=representation' },
      body: JSON.stringify({ site_id: siteId, domain, also }),
    });
    if (!insRes.ok) {
      await Promise.all(names.map(n => detach(f, n)));
      return json({ error: 'Could not save the address. Nothing was changed.' }, 500);
    }
    const row: DomainRow = (await insRes.json())[0];
    return json({ ok: true, ...(await describe(f, row)) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
