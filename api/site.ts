/**
 * Vercel edge proxy for Community Hosting: /s/{slug}/... and /b/{handle}/...
 * → the Supabase site function. The proxying itself (and why it's needed)
 * lives in _site-proxy.ts, shared with the custom-domain door (middleware.ts).
 */

import { proxySite } from './_site-proxy';

export const config = { runtime: 'edge' };

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  return proxySite(req, {
    path: url.searchParams.get('path') ?? '',
    profile: url.searchParams.get('b') === '1',
  });
}
