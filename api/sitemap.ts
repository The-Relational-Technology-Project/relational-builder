/**
 * /sitemap.xml — the app's own public addresses plus every published
 * builder page (/b/{handle}/). The commons keeps its own sitemap at
 * /commons/sitemap.xml; robots.txt lists both.
 *
 * Builder pages come from the public_builder_pages() RPC, a definer
 * function that returns only slug + updated_at for kind 'profile' rows —
 * the one thing about a site that is public by the builder's own choice.
 */

export const config = { runtime: 'edge' };

declare const process: { env: Record<string, string | undefined> };

const SITE = 'https://relationalbuilder.org';
const BUILDER_URL =
  process.env.VITE_BUILDER_SUPABASE_URL ?? 'https://texakzqqenzpxawktbgx.supabase.co';
const BUILDER_ANON =
  process.env.VITE_BUILDER_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRleGFrenFxZW56cHhhd2t0Ymd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI5NDczMDQsImV4cCI6MjA5ODUyMzMwNH0.NnNhDvYMPsDfC5T4QkExUtSrflG5VP76gkFY-KxiV8M';

const STATIC_PAGES = ['/', '/gallery', '/commons'];

export default async function handler(): Promise<Response> {
  let pages: { slug: string; updated_at: string }[] = [];
  try {
    const res = await fetch(`${BUILDER_URL}/rest/v1/rpc/public_builder_pages`, {
      method: 'POST',
      headers: {
        apikey: BUILDER_ANON,
        Authorization: `Bearer ${BUILDER_ANON}`,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    if (res.ok) pages = (await res.json()) as { slug: string; updated_at: string }[];
  } catch {
    // A sitemap with only the static pages is still a valid sitemap
  }

  const urls = [
    ...STATIC_PAGES.map(p => `<url><loc>${SITE}${p}</loc></url>`),
    ...pages
      .filter(p => /^[a-z0-9-]{3,32}$/.test(p.slug))
      .map(
        p =>
          `<url><loc>${SITE}/b/${p.slug}/</loc>${p.updated_at ? `<lastmod>${String(p.updated_at).slice(0, 10)}</lastmod>` : ''}</url>`,
      ),
  ];
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
    {
      headers: {
        'content-type': 'application/xml; charset=utf-8',
        'cache-control': 'public, max-age=3600, s-maxage=3600',
      },
    },
  );
}
