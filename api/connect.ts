/**
 * Vercel edge proxy for connection intros: /connect/respond → the Supabase
 * connect function.
 *
 * Why this exists (same story as api/site.ts): Supabase's gateway sanitizes
 * text/html GET responses on *.supabase.co — the accept/decline pages would
 * arrive as plain text and render as raw source. We send x-rb-raw so the
 * function disguises HTML as text/x-rb-html, then restore the real content
 * type here on our own domain. Bonus: the links in the emails read as
 * relationalbuilder.org/connect/respond instead of a raw supabase.co URL.
 */

export const config = { runtime: 'edge' };

const ORIGIN = 'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/connect';

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const res = await fetch(`${ORIGIN}${url.search}`, {
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
  headers.set('cache-control', 'no-store');

  return new Response(res.body, { status: res.status, headers });
}
