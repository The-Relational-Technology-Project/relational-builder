import type { FileEntry } from './virtual-fs';
import type { DnsInstruction } from './deploy-netlify';
import { isBinaryFilePath } from './app-icon';

/**
 * Deploy a static site to Bunny (bunny.net, Slovenia): a Storage Zone in
 * Falkenstein, Germany holds the files, a Pull Zone serves them over the
 * Bunny CDN restricted to its European region. The first EU publish target
 * (docs/REGIONAL-MODE.md).
 *
 * Browser-side, like the Netlify and Vercel adapters: every endpoint used
 * here answers CORS preflights with `*` (checked Nov 2026). Two keys:
 *   - the ACCOUNT key (dash.bunny.net → Account → API) creates zones
 *   - the STORAGE ZONE password (returned at creation) uploads files
 * The storage password is remembered per site so a republish is an upload,
 * not a new zone.
 *
 * Bunny's API: https://bunny.net/docs/reference/bunnynet-api-overview and
 * https://bunny.net/docs/reference/storage-api
 */

const API = 'https://api.bunny.net';
/** Falkenstein (DE) — the main region for every zone this adapter creates */
const STORAGE_REGION = 'DE';
const STORAGE_HOST = 'https://storage.bunnycdn.com';

/** What a site needs remembered between publishes */
export interface BunnySite {
  storageZoneId: number;
  storageZoneName: string;
  /** Upload key for that zone only (not the account key) */
  storagePassword: string;
  pullZoneId: number;
  /** The public hostname, e.g. my-app-1234.b-cdn.net */
  hostname: string;
  customDomain?: string;
}

export interface BunnyDeployResult {
  siteUrl: string;
  adminUrl: string;
  site: BunnySite;
  dnsInstructions?: DnsInstruction[];
}

function zoneSlug(name: string): string {
  const base = name.replace(/[^a-z0-9-]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
  // Zone names are global across Bunny; a short suffix keeps "la-remise" from colliding
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${(base || 'community-app').slice(0, 40)}-${suffix}`;
}

async function api<T>(path: string, accountKey: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      AccessKey: accountKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = '';
    try {
      const body = (await res.json()) as { Message?: string; message?: string; ErrorKey?: string };
      detail = body.Message ?? body.message ?? body.ErrorKey ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    if (res.status === 401) throw new Error('Bunny rejected the account API key. Copy it from dash.bunny.net → Account → API.');
    throw new Error(`Bunny ${init.method ?? 'GET'} ${path} failed (${res.status})${detail ? `: ${detail}` : ''}`);
  }
  // Some endpoints answer 204 with no body
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

interface StorageZoneModel { Id: number; Name: string; Password: string }
interface PullZoneModel { Id: number; Name: string; Hostnames?: { Value: string }[] }

/** Content types the storage API should serve files with — it only infers a few itself */
function contentTypeFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
    css: 'text/css; charset=utf-8', js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
    json: 'application/json', webmanifest: 'application/manifest+json', xml: 'application/xml',
    svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
    webp: 'image/webp', ico: 'image/x-icon', txt: 'text/plain; charset=utf-8', md: 'text/markdown; charset=utf-8',
    woff: 'font/woff', woff2: 'font/woff2', pdf: 'application/pdf', csv: 'text/csv; charset=utf-8',
  };
  return map[ext] ?? 'application/octet-stream';
}

/** Binary files (icons, images) ride the VFS as bare base64, flagged by path — same as the Vercel adapter */
function bodyFor(path: string, content: string): Blob | string {
  if (!isBinaryFilePath(path)) return content;
  const bytes = Uint8Array.from(atob(content), c => c.charCodeAt(0));
  return new Blob([bytes], { type: contentTypeFor(path) });
}

async function uploadAll(site: BunnySite, files: FileEntry[]): Promise<void> {
  // A handful at a time: the storage API is happy with parallel PUTs, and
  // sites here are small (tens of files)
  const queue = [...files];
  const worker = async () => {
    while (queue.length) {
      const f = queue.shift()!;
      const rel = f.path.replace(/^\/+/, '');
      const res = await fetch(`${STORAGE_HOST}/${site.storageZoneName}/${rel}`, {
        method: 'PUT',
        headers: { AccessKey: site.storagePassword, 'Content-Type': contentTypeFor(rel) },
        body: bodyFor(rel, f.content),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error('Bunny refused the upload key for this storage zone. If you deleted the zone in the Bunny dashboard, publish under a new name.');
        throw new Error(`Upload of ${rel} failed (${res.status})`);
      }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
}

/**
 * Publish (or republish) a static site. Pass the remembered `existing` site
 * to upload into the same zone; otherwise a storage zone + pull zone pair is
 * created first. Returns what to remember for next time.
 */
export async function deployToBunny(
  files: FileEntry[],
  siteName: string,
  accountKey: string,
  existing?: BunnySite,
  customDomain?: string,
): Promise<BunnyDeployResult> {
  let site = existing;

  if (!site) {
    const name = zoneSlug(siteName);
    const storage = await api<StorageZoneModel>('/storagezone', accountKey, {
      method: 'POST',
      body: JSON.stringify({ Name: name, Region: STORAGE_REGION, ZoneTier: 0 }),
    });
    const pull = await api<PullZoneModel>('/pullzone', accountKey, {
      method: 'POST',
      body: JSON.stringify({
        Name: name,
        OriginType: 2,
        StorageZoneId: storage.Id,
        Type: 1,
        // Serve from Bunny's European edge only: traffic stays in the EU
        // pricing region, and visitors' requests land on EU servers
        EnableGeoZoneEU: true,
        EnableGeoZoneUS: false,
        EnableGeoZoneASIA: false,
        EnableGeoZoneSA: false,
        EnableGeoZoneAF: false,
      }),
    });
    const hostname = pull.Hostnames?.[0]?.Value ?? `${name}.b-cdn.net`;
    site = {
      storageZoneId: storage.Id,
      storageZoneName: storage.Name,
      storagePassword: storage.Password,
      pullZoneId: pull.Id,
      hostname,
    };
  }

  await uploadAll(site, files);

  const result: BunnyDeployResult = {
    siteUrl: `https://${site.hostname}`,
    adminUrl: `https://dash.bunny.net/cdn/${site.pullZoneId}`,
    site,
  };

  // Custom hostname: attach it, ask for a free Let's Encrypt certificate
  // (Bunny issues it once the CNAME resolves), hand back the DNS record
  const domain = customDomain?.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  if (domain && domain !== site.customDomain) {
    await api(`/pullzone/${site.pullZoneId}/addHostname`, accountKey, {
      method: 'POST',
      body: JSON.stringify({ Hostname: domain }),
    }).catch(() => {});
    await api(`/pullzone/loadFreeCertificate?hostname=${encodeURIComponent(domain)}`, accountKey).catch(() => {});
    result.site = { ...site, customDomain: domain };
  }
  if (domain) {
    const isApex = domain.split('.').length === 2;
    result.dnsInstructions = isApex
      ? [{ type: 'ALIAS', host: '@', value: site.hostname }]
      : [{ type: 'CNAME', host: domain.split('.')[0], value: site.hostname }];
  }

  return result;
}
