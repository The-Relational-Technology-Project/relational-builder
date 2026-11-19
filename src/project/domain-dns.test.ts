import { describe, it, expect } from 'vitest';
import {
  detectProvider, diagnose, nameIdeas, namecheapSearchUrl, providerSteps, readLookup,
  type DnsFacts, type DnsRecord, type Lookup,
} from './domain-dns';

const facts = (over: Partial<DnsFacts> = {}): DnsFacts => ({
  registered: true, nameservers: [], mx: [], names: {}, ...over,
});

const lookup = (domain: string, f: DnsFacts, over: Partial<Lookup> = {}): Lookup => {
  const registrable = domain.split('.').slice(-2).join('.');
  return { domain, also: null, registrable, facts: f, taken: false, ...over };
};

const A: DnsRecord = { type: 'A', host: '@', value: '216.150.1.1', name: 'elmstreet.place', purpose: 'address', ok: false };
const CNAME: DnsRecord = { type: 'CNAME', host: 'www', value: 'abc.vercel-dns-016.com', name: 'www.elmstreet.place', purpose: 'twin', ok: false };

describe('detectProvider', () => {
  it('names the provider from its nameservers', () => {
    expect(detectProvider(['dns1.registrar-servers.com', 'dns2.registrar-servers.com']).id).toBe('namecheap');
    expect(detectProvider(['ns53.domaincontrol.com']).id).toBe('godaddy');
    expect(detectProvider(['amy.ns.cloudflare.com']).id).toBe('cloudflare');
    expect(detectProvider(['ns1.vercel-dns.com']).id).toBe('vercel');
    expect(detectProvider(['ns-cloud-a1.googledomains.com']).name).toBe('Squarespace');
    expect(detectProvider(['curitiba.ns.porkbun.com']).id).toBe('porkbun');
  });

  it('can still say a name it has no written steps for', () => {
    expect(detectProvider(['ns1.hover.com'])).toEqual({ id: 'other', name: 'Hover' });
  });

  it('admits when it cannot tell', () => {
    expect(detectProvider(['ns1.somebody-elses-dns.example'])).toEqual({ id: 'other', name: null });
    expect(detectProvider([])).toEqual({ id: 'other', name: null });
  });
});

describe('readLookup', () => {
  it('an unregistered name is available', () => {
    const r = readLookup(lookup('elmstreet.place', facts({ registered: false })));
    expect(r.situation).toBe('available');
    expect(r.isMain).toBe(true);
  });

  it('a new Namecheap domain is fresh even though the parking page answers', () => {
    const r = readLookup(lookup('www.elmstreet.place', facts({
      nameservers: ['dns1.registrar-servers.com'],
      names: { 'www.elmstreet.place': { a: ['192.64.119.20'], cname: 'parkingpage.namecheap.com' } },
    })));
    expect(r.situation).toBe('fresh');
    expect(r.provider.name).toBe('Namecheap');
  });

  it('a domain with a real site and email is in use, and says so about the email', () => {
    const r = readLookup(lookup('groupproject.group', facts({
      mx: ['aspmx.l.google.com'],
      names: { 'groupproject.group': { a: ['198.185.159.144'], cname: null } },
    })));
    expect(r.situation).toBe('in_use');
    expect(r.hasEmail).toBe(true);
  });

  it('an unused subdomain of a busy domain is fresh, and not the main address', () => {
    const r = readLookup(lookup('library.groupproject.group', facts({
      mx: ['aspmx.l.google.com'],
      names: { 'library.groupproject.group': { a: [], cname: null } },
    })));
    expect(r.situation).toBe('fresh');
    expect(r.isMain).toBe(false);
  });

  it('live on someone else\'s site wins over everything', () => {
    expect(readLookup(lookup('elmstreet.place', facts(), { taken: true })).situation).toBe('taken');
  });
});

describe('diagnose', () => {
  const namecheap = { id: 'namecheap' as const, name: 'Namecheap' };
  const other = { id: 'other' as const, name: null };

  it('says nothing about a record that is fine', () => {
    expect(diagnose({ ...A, ok: true }, facts(), other)).toBeNull();
  });

  it('names Namecheap\'s parking row as the thing to delete', () => {
    const msg = diagnose(CNAME, facts({ names: { 'www.elmstreet.place': { a: ['192.64.119.20'], cname: 'parkingpage.namecheap.com' } } }), namecheap);
    expect(msg).toMatch(/parking page is still there/);
    expect(msg).toMatch(/parkingpage\.namecheap\.com/);
  });

  it('is patient when nothing has shown up yet', () => {
    expect(diagnose(A, facts({ names: { 'elmstreet.place': { a: [], cname: null } } }), other)).toMatch(/Not seen yet/);
    expect(diagnose(A, facts(), other)).toMatch(/Not seen yet/);
  });

  it('points at the extra A record beside the right one', () => {
    const msg = diagnose(A, facts({ names: { 'elmstreet.place': { a: ['216.150.1.1', '203.0.113.9'], cname: null } } }), other);
    expect(msg).toBe('There\'s an extra A record (203.0.113.9). Delete it so only 216.150.1.1 is left.');
  });

  it('says where a wrong record points now', () => {
    expect(diagnose(A, facts({ names: { 'elmstreet.place': { a: ['203.0.113.9'], cname: null } } }), other))
      .toMatch(/points to 203\.0\.113\.9 right now\. Change it to 216\.150\.1\.1/);
    expect(diagnose(CNAME, facts({ names: { 'www.elmstreet.place': { a: ['203.0.113.9'], cname: 'old.example.net' } } }), other))
      .toMatch(/points to old\.example\.net right now/);
  });

  it('catches an A record where the CNAME belongs', () => {
    expect(diagnose(CNAME, facts({ names: { 'www.elmstreet.place': { a: ['203.0.113.9'], cname: null } } }), other))
      .toMatch(/A record \(203\.0\.113\.9\) where the CNAME should be/);
  });

  it('spots Cloudflare\'s orange cloud', () => {
    const msg = diagnose(A, facts({ names: { 'elmstreet.place': { a: ['104.21.5.9', '172.67.1.2'], cname: null } } }), { id: 'cloudflare', name: 'Cloudflare' });
    expect(msg).toMatch(/DNS only/);
  });

  it('once the record matches, the wait is for the secure connection', () => {
    expect(diagnose(A, facts({ names: { 'elmstreet.place': { a: ['216.150.1.1'], cname: null } } }), other))
      .toMatch(/looks right/);
  });

  it('puts the proof record first', () => {
    const proof: DnsRecord = { type: 'TXT', host: '_vercel', value: 'vc-domain-verify=x', name: '_vercel.elmstreet.place', purpose: 'proof', ok: false };
    expect(diagnose(proof, facts(), other)).toMatch(/add it first/);
  });
});

describe('providerSteps', () => {
  it('links straight to Namecheap\'s Advanced DNS and warns about the placeholder rows', () => {
    const s = providerSteps({ id: 'namecheap', name: 'Namecheap' }, 'elmstreet.place');
    expect(s.openUrl).toBe('https://ap.www.namecheap.com/domains/domaincontrolpanel/elmstreet.place/advancedns');
    expect(s.watchFor.join(' ')).toMatch(/parkingpage\.namecheap\.com/);
  });

  it('has a plain version for everyone else, naming the provider when it can', () => {
    expect(providerSteps({ id: 'other', name: 'Hover' }, 'x.org').steps[0]).toMatch(/Hover/);
    expect(providerSteps({ id: 'other', name: null }, 'x.org').openUrl).toBeNull();
  });
});

describe('nameIdeas', () => {
  it('leads with the place when there is one', () => {
    const ideas = nameIdeas('Community Events Lending Library', 'New Haven, Connecticut');
    expect(ideas[0]).toBe('newhavenlibrary.place');
    expect(ideas.length).toBeGreaterThan(2);
    expect(new Set(ideas).size).toBe(ideas.length);
  });

  it('works from the name alone, dropping filler words', () => {
    expect(nameIdeas('The Elm Street Tool Library')[0]).toBe('streetlibrary.place');
  });

  it('gives nothing rather than nonsense for an empty name', () => {
    expect(nameIdeas('')).toEqual([]);
  });
});

describe('namecheapSearchUrl', () => {
  it('carries the name', () => {
    expect(namecheapSearchUrl('elmstreet.place')).toBe('https://www.namecheap.com/domains/registration/results/?domain=elmstreet.place');
  });
});
