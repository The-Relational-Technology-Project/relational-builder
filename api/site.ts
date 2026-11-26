/**
 * Vercel edge proxy for Community Hosting: /s/{slug}/... and /b/{handle}/...
 * → the Supabase site function. The proxying itself (and why it's needed)
 * lives in _site-proxy.ts, shared with the custom-domain door (middleware.ts).
 */

import { proxySite } from './_site-proxy';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';
  const profile = url.searchParams.get('b') === '1';
  const home = homeRedirect(path, profile, url.searchParams);
  if (home) return new Response(null, { status: 308, headers: { location: home } });
  return proxySite(req, { path, profile });
}

/**
 * A site's home is `/s/{slug}/`, with the slash. Pages reference their files
 * relatively (`./assets/porch.js`), so at `/s/{slug}` a browser asks for
 * `/s/assets/porch.js`: a different site's address, a 404, and every photo
 * on the page missing while the page itself renders. People type and share
 * the address without the slash all the time, so send them to the real one.
 * Returns the address to redirect to, or null when the path is fine.
 */
export function homeRedirect(path: string, profile: boolean, params: URLSearchParams): string | null {
  if (!path || path.includes('/')) return null;
  const rest = new URLSearchParams(params);
  rest.delete('path');
  rest.delete('b');
  const query = rest.toString();
  return `/${profile ? 'b' : 's'}/${encodeURIComponent(path)}/${query ? `?${query}` : ''}`;
}
