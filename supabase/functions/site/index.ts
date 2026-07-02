/**
 * Supabase Edge Function: site — serves Community Hosting sites.
 *
 * GET /site/{slug}/            → index.html
 * GET /site/{slug}/{filepath}  → that file with its content type
 *
 * Views of index.html increment the site's daily counter (simple,
 * privacy-friendly analytics — no cookies, no per-visitor tracking).
 *
 * Fronted by a rewrite on the builder domain so sites get clean URLs:
 *   https://relational-builder.vercel.app/s/{slug}/
 *
 * Deploy: supabase functions deploy site --no-verify-jwt
 */

const CACHE_TTL_SECONDS = 60;

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Path arrives as /site/{slug}/{...filepath} (direct) — the domain
    // rewrite maps /s/{slug}/... onto the same shape
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const siteIdx = segments.indexOf('site');
    const slug = segments[siteIdx + 1] ?? '';
    let filePath = segments.slice(siteIdx + 2).join('/');
    if (!slug) return new Response('Site not specified', { status: 400 });
    if (!filePath) filePath = 'index.html';

    const siteRes = await fetch(
      rest(`/community_sites?slug=eq.${encodeURIComponent(slug)}&select=id,name`),
      { headers: svc() },
    );
    const sites = siteRes.ok ? await siteRes.json() : [];
    if (sites.length === 0) {
      return new Response('This site does not exist (or was taken down).', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const siteId = sites[0].id;

    const fileRes = await fetch(
      rest(`/site_files?site_id=eq.${siteId}&path=eq.${encodeURIComponent(filePath)}&select=content,content_type`),
      { headers: svc() },
    );
    const found = fileRes.ok ? await fileRes.json() : [];

    // SPA-style fallback: unknown paths (no extension) serve index.html
    let file = found[0];
    if (!file && !filePath.includes('.')) {
      const indexRes = await fetch(
        rest(`/site_files?site_id=eq.${siteId}&path=eq.index.html&select=content,content_type`),
        { headers: svc() },
      );
      file = indexRes.ok ? (await indexRes.json())[0] : undefined;
    }
    if (!file) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }

    // Count page views (not asset requests) — fire and forget
    if (filePath === 'index.html' || !filePath.includes('.')) {
      fetch(rest('/rpc/increment_site_views'), {
        method: 'POST',
        headers: { ...svc(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_site_id: siteId }),
      }).catch(() => {});
    }

    return new Response(req.method === 'HEAD' ? null : file.content, {
      headers: {
        'Content-Type': file.content_type,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
        'X-Hosted-By': 'Relational Builder Community Hosting',
      },
    });
  } catch {
    return new Response('Something went wrong serving this site.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
});
