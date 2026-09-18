/**
 * Vercel edge proxy for Community Hosting: /s/{slug}/... → the Supabase
 * site function.
 *
 * Why this exists: Supabase's gateway sanitizes text/html GET responses on
 * *.supabase.co (anti-phishing) — pages arrive as text/plain with a sandbox
 * CSP and render as source code. We send x-rb-raw so the site function
 * disguises HTML as text/x-rb-html (which passes through untouched), then
 * restore the real content type here on our own domain.
 *
 * The gateway also keys on the URL: any path ending in .html/.htm gets the
 * same treatment whatever the content type says, so a second page
 * (about.html) rendered as source while index.html was fine. We ask
 * upstream for an extension-free path and carry the real one in x-rb-path.
 */

export const config = { runtime: 'edge' };

const ORIGIN = 'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/site';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';
  const upstreamPath = path.replace(/\.html?$/i, '.rbpage');

  const res = await fetch(`${ORIGIN}/${upstreamPath}`, {
    method: req.method,
    headers: {
      'x-rb-raw': '1',
      'x-rb-path': encodeURI(path),
      ...(req.headers.get('content-type')
        ? { 'content-type': req.headers.get('content-type') as string }
        : {}),
      // Private sites: the unlock cookie must reach the site function
      ...(req.headers.get('cookie') ? { cookie: req.headers.get('cookie') as string } : {}),
    },
    body: req.method === 'POST' ? await req.text() : undefined,
  });

  const headers = new Headers();
  // ...and its Set-Cookie must reach the browser (fetch folds repeated
  // Set-Cookie headers; getSetCookie keeps them separate where available)
  const setCookies =
    (res.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ??
    (res.headers.get('set-cookie') ? [res.headers.get('set-cookie') as string] : []);
  for (const cookie of setCookies) headers.append('set-cookie', cookie);
  const upstreamType = res.headers.get('content-type') ?? 'text/plain';
  headers.set(
    'content-type',
    upstreamType.startsWith('text/x-rb-html') ? 'text/html; charset=utf-8' : upstreamType,
  );
  const cache = res.headers.get('cache-control');
  if (cache) headers.set('cache-control', cache);
  headers.set('x-hosted-by', 'Relational Builder Community Hosting');

  return new Response(res.body, { status: res.status, headers });
}
