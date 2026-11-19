/**
 * Reading a domain's DNS the way a patient friend would: who runs it, what's
 * there now, what's still missing, and where to click to fix it.
 *
 * Pure functions over the facts the `site-domains` function reads from the
 * outside (see src/project/site-domains.ts for the calls). The Builder uses
 * them to turn "add an A record" into steps written for the person's own
 * provider, and "it isn't working" into the one row that's wrong.
 *
 * See docs/CUSTOM-DOMAINS.md.
 */

export interface NameFacts {
  a: string[];
  cname: string | null;
}

export interface DnsFacts {
  registered: boolean;
  nameservers: string[];
  mx: string[];
  names: Record<string, NameFacts>;
}

export interface DnsRecord {
  type: 'A' | 'CNAME' | 'TXT';
  host: string;
  value: string;
  name: string;
  purpose: 'address' | 'twin' | 'proof';
  ok: boolean;
}

// ── Who runs this domain's DNS ─────────────────────────────────────────

export type ProviderId = 'namecheap' | 'squarespace' | 'godaddy' | 'cloudflare' | 'porkbun' | 'vercel' | 'other';

export interface Provider {
  id: ProviderId;
  /** The name a person knows it by; null when we can't tell */
  name: string | null;
}

/** Nameserver → provider. The six with written steps first, then names we
 *  can at least say out loud ("your DNS is at Hover"). */
const PROVIDERS: { id: ProviderId; name: string; match: RegExp }[] = [
  { id: 'namecheap', name: 'Namecheap', match: /(^|\.)registrar-servers\.com$|(^|\.)namecheaphosting\.com$/ },
  { id: 'squarespace', name: 'Squarespace', match: /(^|\.)squarespacedns\.com$|(^|\.)googledomains\.com$/ },
  { id: 'godaddy', name: 'GoDaddy', match: /(^|\.)domaincontrol\.com$/ },
  { id: 'cloudflare', name: 'Cloudflare', match: /(^|\.)ns\.cloudflare\.com$/ },
  { id: 'porkbun', name: 'Porkbun', match: /(^|\.)porkbun\.com$/ },
  { id: 'vercel', name: 'Vercel', match: /(^|\.)vercel-dns\.com$/ },
  { id: 'other', name: 'Hover', match: /(^|\.)hover\.com$/ },
  { id: 'other', name: 'Name.com', match: /(^|\.)name\.com$/ },
  { id: 'other', name: 'Gandi', match: /(^|\.)gandi\.net$/ },
  { id: 'other', name: 'IONOS', match: /(^|\.)ui-dns\.(com|org|de|biz)$/ },
  { id: 'other', name: 'Wix', match: /(^|\.)wixdns\.net$/ },
  { id: 'other', name: 'Hostinger', match: /(^|\.)dns-parking\.com$/ },
  { id: 'other', name: 'DreamHost', match: /(^|\.)dreamhost\.com$/ },
  { id: 'other', name: 'Bluehost', match: /(^|\.)bluehost\.com$/ },
  { id: 'other', name: 'Dynadot', match: /(^|\.)dynadot\.com$/ },
  { id: 'other', name: 'Spaceship', match: /(^|\.)spaceship\.net$/ },
];

export function detectProvider(nameservers: string[]): Provider {
  for (const ns of nameservers) {
    const hit = PROVIDERS.find(p => p.match.test(ns.toLowerCase()));
    if (hit) return { id: hit.id, name: hit.name };
  }
  return { id: 'other', name: null };
}

// ── What's at the name today ───────────────────────────────────────────

/** The placeholder page a registrar puts up on a domain nobody has used yet. */
function isParking(facts: NameFacts): boolean {
  if (facts.cname && /parkingpage\.namecheap\.com$|(^|\.)pixie\.porkbun\.com$|parked|parking/.test(facts.cname)) return true;
  // Namecheap's "URL Redirect Record" and GoDaddy's "Parked" answer from these
  return facts.a.length > 0 && facts.a.every(ip =>
    /^192\.64\.119\.|^162\.255\.119\.|^198\.54\.117\.|^34\.102\.136\.180$|^3\.33\.130\.190$|^15\.197\.148\.33$/.test(ip));
}

function isEmpty(facts: NameFacts | undefined): boolean {
  return !facts || (facts.a.length === 0 && !facts.cname);
}

export type Situation =
  /** Nobody has registered it: go get it */
  | 'available'
  /** Live on another builder's site */
  | 'taken'
  /** Registered, nothing of note on it: connect it */
  | 'fresh'
  /** A site already answers here: connecting replaces it */
  | 'in_use';

export interface Lookup {
  domain: string;
  also: string | null;
  registrable: string;
  facts: DnsFacts;
  taken: boolean;
}

export interface Reading {
  situation: Situation;
  provider: Provider;
  /** The domain carries email: say out loud that it keeps working */
  hasEmail: boolean;
  /** The typed name is the bare domain (or its www), not another subdomain */
  isMain: boolean;
}

export function readLookup(lookup: Lookup): Reading {
  const { facts, domain, registrable } = lookup;
  const provider = detectProvider(facts.nameservers);
  const isMain = domain === registrable || domain === `www.${registrable}`;
  const hasEmail = facts.mx.length > 0;
  let situation: Situation;
  if (lookup.taken) situation = 'taken';
  else if (!facts.registered) situation = 'available';
  else {
    const here = facts.names[domain];
    situation = isEmpty(here) || isParking(here) ? 'fresh' : 'in_use';
  }
  return { situation, provider, hasEmail, isMain };
}

// ── What's still wrong with one record ─────────────────────────────────

const CLOUDFLARE_EDGE = /^104\.(1[6-9]|2\d|3[01])\.|^172\.(6[4-9]|7[01])\.|^188\.114\./;

/**
 * One sentence about a record that isn't right yet: the specific thing to
 * change, in the words of the provider's own settings page where we know
 * them. Null when the record is fine.
 */
export function diagnose(record: DnsRecord, facts: DnsFacts, provider: Provider): string | null {
  if (record.ok) return null;
  if (record.purpose === 'proof') {
    return 'Not seen yet. This one proves the domain is yours, so add it first.';
  }
  const here = facts.names[record.name] ?? { a: [], cname: null };

  if (provider.id === 'cloudflare' && here.a.length > 0 && here.a.every(ip => CLOUDFLARE_EDGE.test(ip))) {
    return 'Cloudflare is standing in front of this record. Edit it and switch Proxy status to "DNS only" (the grey cloud).';
  }
  if (isParking(here)) {
    const what = here.cname ?? here.a[0];
    return provider.id === 'namecheap'
      ? `Namecheap's parking page is still there. Delete the row that points to ${what}, then add this one.`
      : `The registrar's placeholder page is still there (${what}). Delete that row, then add this one.`;
  }
  if (isEmpty(here)) {
    return 'Not seen yet. New records usually show up within a few minutes, sometimes up to an hour.';
  }

  if (record.type === 'A') {
    if (here.cname) return `This name is an alias of ${here.cname} right now. Delete that row and add the A record.`;
    const extras = here.a.filter(ip => ip !== record.value);
    if (here.a.includes(record.value) && extras.length > 0) {
      return `There's an extra A record (${extras.join(', ')}). Delete it so only ${record.value} is left.`;
    }
    if (extras.length > 0) return `It points to ${extras.join(', ')} right now. Change it to ${record.value}.`;
  } else {
    if (!here.cname) return `It has an A record (${here.a.join(', ')}) where the CNAME should be. Delete that row and add the CNAME.`;
    if (here.cname !== record.value) return `It points to ${here.cname} right now. Change it to ${record.value}.`;
  }
  return 'This looks right. Setting up the secure connection, usually a minute or two.';
}

// ── Where to click ─────────────────────────────────────────────────────

export interface ProviderSteps {
  /** A link straight to the settings page, when the provider has a stable one */
  openUrl: string | null;
  openLabel: string;
  /** Getting to the right screen */
  steps: string[];
  /** The stumbles this provider is known for */
  watchFor: string[];
}

/**
 * How to reach the DNS records for `registrable` at this provider. Written
 * from each provider's own menus; the generic version covers everyone else.
 */
export function providerSteps(provider: Provider, registrable: string): ProviderSteps {
  switch (provider.id) {
    case 'namecheap':
      return {
        openUrl: `https://ap.www.namecheap.com/domains/domaincontrolpanel/${registrable}/advancedns`,
        openLabel: 'Open Namecheap',
        steps: [
          'Sign in to Namecheap, open Domain List, and click Manage next to your domain.',
          'Open the Advanced DNS tab and find Host Records.',
          'Click Add New Record for each row below. Leave TTL on Automatic.',
        ],
        watchFor: [
          'A new Namecheap domain comes with two placeholder rows: a "CNAME Record" for www pointing to parkingpage.namecheap.com and a "URL Redirect Record" for @. Delete both (the trash icon).',
        ],
      };
    case 'squarespace':
      return {
        openUrl: 'https://account.squarespace.com/domains',
        openLabel: 'Open Squarespace Domains',
        steps: [
          'Sign in to Squarespace, open Domains, and click your domain.',
          'Open DNS, then DNS Settings, and scroll to Custom records.',
          'Click Add record for each row below.',
        ],
        watchFor: [
          'If the domain was showing a Squarespace site, delete the "Squarespace Defaults" preset on the same page first, or the two will fight.',
        ],
      };
    case 'godaddy':
      return {
        openUrl: `https://dcc.godaddy.com/control/portfolio/${registrable}/settings?tab=dns`,
        openLabel: 'Open GoDaddy DNS',
        steps: [
          'Sign in to GoDaddy, open My Products, and click DNS next to your domain.',
          'Click Add New Record for each row below.',
        ],
        watchFor: [
          'A new GoDaddy domain has an A record for @ that says "Parked", and often a CNAME for www. Edit or delete those so only the rows below are left.',
        ],
      };
    case 'cloudflare':
      return {
        openUrl: 'https://dash.cloudflare.com/?to=/:account/:zone/dns/records',
        openLabel: 'Open Cloudflare DNS',
        steps: [
          'Sign in to Cloudflare, pick your domain, and open DNS, then Records.',
          'Click Add record for each row below.',
        ],
        watchFor: [
          'Set Proxy status to "DNS only" (the grey cloud) on these rows. With the orange cloud on, the secure connection can\'t be set up.',
        ],
      };
    case 'porkbun':
      return {
        openUrl: 'https://porkbun.com/account/domainsSpeedy',
        openLabel: 'Open Porkbun',
        steps: [
          'Sign in to Porkbun, open Domain Management, and click DNS next to your domain.',
          'Add each row below. For the @ row, leave the Host field empty.',
        ],
        watchFor: [
          'A new Porkbun domain has placeholder ALIAS and CNAME rows pointing to pixie.porkbun.com. Delete them (the trash icon).',
        ],
      };
    case 'vercel':
      return {
        openUrl: 'https://vercel.com/dashboard/domains',
        openLabel: 'Open Vercel Domains',
        steps: [
          'Sign in to Vercel, open Domains, and click your domain.',
          'Under DNS Records, add each row below.',
        ],
        watchFor: [
          'If the domain is attached to one of your Vercel projects, remove it from that project first (Project, Settings, Domains), or Vercel keeps sending it there.',
        ],
      };
    default:
      return {
        openUrl: null,
        openLabel: '',
        steps: [
          provider.name
            ? `Sign in at ${provider.name}, where this domain's settings live.`
            : 'Sign in wherever you bought the domain (or wherever its settings live now).',
          'Find the page called DNS, DNS records, or Advanced DNS.',
          'Add each row below. If a field asks for TTL, leave it on the default.',
        ],
        watchFor: [
          'If there are already rows for the same Host with a different value (often a placeholder page), delete those.',
        ],
      };
  }
}

// ── Finding a name ─────────────────────────────────────────────────────

export interface Ending {
  tld: string;
  /** One line a neighbor could act on. Prices are rough and move around. */
  hint: string;
}

/**
 * Endings worth a look for a neighborhood tool, cheapest-to-keep first.
 * The first year is often a couple of dollars anywhere; what matters is the
 * renewal, and that varies by registrar and by the week.
 */
export const ENDINGS: Ending[] = [
  { tld: 'org', hint: 'Familiar and steady. Around $11 a year.' },
  { tld: 'xyz', hint: 'Usually the cheapest odd one to keep. Around $13 a year.' },
  { tld: 'place', hint: 'Says where you are. Deals come and go, so compare.' },
  { tld: 'club', hint: 'A couple of dollars to start, under $20 a year after.' },
  { tld: 'town', hint: 'Local feel. Often $30 or more a year after the first.' },
  { tld: 'city', hint: 'Local feel. Often close to $30 a year after the first.' },
  { tld: 'garden', hint: 'A couple of dollars to start, closer to $30 a year after.' },
  { tld: 'fun', hint: 'A couple of dollars to start, closer to $30 a year after.' },
];

const FILLER = new Set([
  'a', 'an', 'and', 'app', 'for', 'in', 'my', 'of', 'on', 'our', 'site', 'the', 'to', 'tool', 'with', 'your',
]);

/**
 * A few names to try, built from what the site is called and where it is.
 * Short beats complete: two words joined, the place leading when we know it.
 */
export function nameIdeas(siteName: string, placeName?: string | null): string[] {
  const words = (s: string) =>
    s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9\s-]/g, '').split(/[\s-]+/).filter(w => w && !FILLER.has(w));
  const site = words(siteName);
  const place = words((placeName ?? '').split(',')[0]);
  const siteOnly = site.filter(w => !place.includes(w));

  const bases: string[] = [];
  const push = (parts: string[]) => {
    const base = parts.join('');
    if (base.length >= 4 && base.length <= 24 && !bases.includes(base)) bases.push(base);
  };
  const tail = siteOnly.slice(-2);
  if (place.length) push([...place.slice(0, 2), ...siteOnly.slice(-1)]);
  push(tail);
  push(site.slice(0, 2));
  push(siteOnly.slice(-1));

  const endings = ['place', 'xyz', 'org', 'club', 'town'];
  const ideas: string[] = [];
  bases.slice(0, 3).forEach((base, i) => {
    // Spread the endings across the bases so the list isn't one word five ways
    for (const tld of [endings[i % endings.length], endings[(i + 1) % endings.length]]) {
      ideas.push(`${base}.${tld}`);
    }
  });
  return ideas.slice(0, 5);
}

/** Namecheap's search, with the name already typed in. */
export function namecheapSearchUrl(domain: string): string {
  return `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`;
}
