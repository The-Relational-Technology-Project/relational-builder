/**
 * Vercel edge proxy for Community Hosting: /s/{slug}/... → the Supabase
 * site function.
 *
 * Why this exists: Supabase's gateway sanitizes text/html GET responses on
 * *.supabase.co (anti-phishing) — pages arrive as text/plain with a sandbox
 * CSP and render as source code. We send x-rb-raw so the site function
 * disguises HTML as text/x-rb-html (which passes through untouched), then
 * restore the real content type here on our own domain.
 */

export const config = { runtime: 'edge' };

const ORIGIN = 'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/site';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.searchParams.get('path') ?? '';

  const res = await fetch(`${ORIGIN}/${path}`, {
    method: req.method,
    headers: {
      'x-rb-raw': '1',
      ...(req.headers.get('content-type')
        ? { 'content-type': req.headers.get('content-type') as string }
        : {}),
    },
    body: req.method === 'POST' ? await req.text() : undefined,
  });

  const headers = new Headers();
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
