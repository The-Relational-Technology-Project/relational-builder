import { builderClient } from '@/cloud/builder-client';
import type { DnsFacts, DnsRecord, Lookup } from './domain-dns';

/**
 * A community-hosted site's own address: the calls behind "Use your own
 * address" (the `site-domains` function). The reading of what comes back
 * lives in domain-dns.ts.
 */

export interface SiteDomain {
  /** The address people use */
  domain: string;
  /** Its www/bare twin, which redirects to it */
  also: string | null;
  registrable: string;
  status: 'pending' | 'live';
  /** What to add at the domain's DNS provider, each with how it looks now */
  records: DnsRecord[];
  facts: DnsFacts;
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!builderClient) throw new Error('Community hosting needs the cloud backend configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to give your site its own address');

  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/site-domains`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((result as { error?: string }).error ?? `Request failed (${res.status})`);
  return result as Record<string, unknown>;
}

function asDomain(result: Record<string, unknown>): SiteDomain | null {
  return result.domain ? (result as unknown as SiteDomain) : null;
}

/** What's at this name today, before committing to anything. */
export async function lookupDomain(domain: string): Promise<Lookup> {
  return (await call({ action: 'lookup', domain })) as unknown as Lookup;
}

/** The site's own address and how its DNS looks right now, or null. */
export async function getSiteDomain(slug: string): Promise<SiteDomain | null> {
  return asDomain(await call({ action: 'status', slug }));
}

export async function addSiteDomain(slug: string, domain: string): Promise<SiteDomain> {
  const added = asDomain(await call({ action: 'add', slug, domain }));
  if (!added) throw new Error('Could not connect that address');
  return added;
}

export async function removeSiteDomain(slug: string): Promise<void> {
  await call({ action: 'remove', slug });
}
