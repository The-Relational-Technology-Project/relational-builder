/**
 * The custom-domain door for Community Hosting.
 *
 * A community points a domain it owns at this project. Any request arriving
 * on a hostname that isn't one of the Builder's own is for a hosted site:
 * the hostname names it, and the `site` function resolves it
 * (site_domains). Middleware, not a vercel.json rewrite, because rewrites
 * run after the filesystem: `/` on a community's domain would serve the
 * Builder's own index.html.
 *
 * See docs/CUSTOM-DOMAINS.md.
 */

import { proxySite } from './api/_site-proxy.js';

/** Hostnames that are the Builder itself (plus every *.vercel.app deploy). */
const OWN_HOSTS = /^(?:(?:www\.)?relationalbuilder\.(?:org|xyz)|[^.]+\.vercel\.app|localhost|127\.0\.0\.1)$/;

// No path matcher: on a community's domain every path is theirs. (Host
// conditions in the matcher are a Next.js feature; here the check is the
// first line of the function.)
export const config = { runtime: 'nodejs' };

export default async function middleware(req: Request): Promise<Response | undefined> {
  const url = new URL(req.url);
  const host = (req.headers.get('x-forwarded-host') ?? url.host).toLowerCase().replace(/:\d+$/, '');
  if (OWN_HOSTS.test(host)) return undefined;

  let path = url.pathname;
  try {
    path = decodeURI(path);
  } catch {
    // A malformed escape: pass the path through as it came
  }
  return proxySite(req, { path: path.replace(/^\/+/, ''), host });
}
