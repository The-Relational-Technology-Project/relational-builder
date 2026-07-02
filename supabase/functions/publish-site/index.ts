/**
 * Supabase Edge Function: publish-site — Community Hosting publish endpoint.
 *
 * Signed-in builders publish their app's files to RTP-hosted community
 * hosting: up to MAX_SITES_PER_BUILDER live sites each, replaced atomically
 * on republish. Sites are served by the `site` function.
 *
 * POST JSON: { name, slug?, files: [{path, content}] }
 *   - Requires a Builder session (Authorization: Bearer <token>)
 *   - slug is derived from name when omitted; republishing an owned slug
 *     replaces the site
 *
 * Also handles site management for the builder's dashboard:
 *   { action: 'list' }                  → the builder's sites with view
 *                                         stats + recent neighbor feedback
 *   { action: 'delete', slug }          → take down an owned site
 *
 * Deploy: supabase functions deploy publish-site --no-verify-jwt
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_SITES_PER_BUILDER = 3;
const MAX_FILES = 150;
const MAX_FILE_BYTES = 512 * 1024;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

const CONTENT_TYPES: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  css: 'text/css; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8',
  json: 'application/json',
  // PWAs: web app manifests need their own type for installability
  webmanifest: 'application/manifest+json',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  xml: 'application/xml',
  yml: 'text/yaml',
  yaml: 'text/yaml',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'site';
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Who is publishing?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in to publish to community hosting' }, 401);
    const user = await userRes.json();
    const email = String(user.email ?? '').toLowerCase();
    if (!email) return json({ error: 'Sign in to publish to community hosting' }, 401);

    const body = await req.json();

    // ---- Site management actions (dashboard) ----
    if (body.action === 'list') {
      const sitesRes = await fetch(
        rest(`/community_sites?owner_email=eq.${encodeURIComponent(email)}&select=id,slug,name,created_at,updated_at&order=updated_at.desc`),
        { headers: svc() },
      );
      const sites = sitesRes.ok ? await sitesRes.json() : [];
      const appUrl = Deno.env.get('APP_URL') ?? 'https://relational-builder.vercel.app';

      const enriched = await Promise.all(sites.map(async (s: { id: string; slug: string; name: string; created_at: string; updated_at: string }) => {
        const [statsRes, feedbackRes] = await Promise.all([
          fetch(rest(`/site_stats?site_id=eq.${s.id}&select=day,views&order=day.desc&limit=30`), { headers: svc() }),
          fetch(rest(`/site_feedback?site_id=eq.${s.id}&select=id,name,message,created_at&order=created_at.desc&limit=20`), { headers: svc() }),
        ]);
        const stats: { day: string; views: number }[] = statsRes.ok ? await statsRes.json() : [];
        const feedback = feedbackRes.ok ? await feedbackRes.json() : [];
        const totalViews = stats.reduce((sum, d) => sum + Number(d.views), 0);
        const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
        const weekViews = stats.filter(d => d.day >= weekAgo).reduce((sum, d) => sum + Number(d.views), 0);
        return {
          slug: s.slug,
          name: s.name,
          url: `${appUrl}/s/${s.slug}/`,
          created_at: s.created_at,
          updated_at: s.updated_at,
          total_views: totalViews,
          week_views: weekViews,
          feedback,
        };
      }));
      return json({ ok: true, sites: enriched });
    }

    if (body.action === 'delete') {
      const slug = slugify(String(body.slug ?? ''));
      if (!slug) return json({ error: 'Which site?' }, 400);
      const siteRes = await fetch(
        rest(`/community_sites?slug=eq.${encodeURIComponent(slug)}&select=id,owner_email`),
        { headers: svc() },
      );
      const found = siteRes.ok ? await siteRes.json() : [];
      if (found.length === 0 || found[0].owner_email !== email) {
        return json({ error: 'No site of yours with that name' }, 404);
      }
      // Cascade removes files, stats, and feedback
      const delRes = await fetch(rest(`/community_sites?id=eq.${found[0].id}`), {
        method: 'DELETE',
        headers: svc(),
      });
      if (!delRes.ok) return json({ error: 'Could not take the site down' }, 500);
      return json({ ok: true, deleted: slug });
    }

    // ---- Publish (default action) ----
    const name = String(body.name ?? 'My community app').slice(0, 120);
    const requestedSlug = body.slug ? slugify(String(body.slug)) : slugify(name);
    const files = Array.isArray(body.files) ? body.files : [];

    if (files.length === 0) return json({ error: 'No files to publish' }, 400);
    if (files.length > MAX_FILES) return json({ error: `Too many files (max ${MAX_FILES})` }, 400);
    if (!files.some((f: { path?: string }) => String(f.path ?? '').replace(/^\//, '') === 'index.html')) {
      return json({ error: 'The site needs an index.html' }, 400);
    }

    let total = 0;
    for (const f of files) {
      const size = new TextEncoder().encode(String(f.content ?? '')).length;
      if (size > MAX_FILE_BYTES) return json({ error: `${f.path} is too large (max 512KB per file)` }, 413);
      total += size;
    }
    if (total > MAX_TOTAL_BYTES) return json({ error: 'Site too large (max 4MB total)' }, 413);

    // Existing site with this slug? Owned → republish. Someone else's → suffix.
    let slug = requestedSlug;
    let siteId: string | null = null;

    const existingRes = await fetch(
      rest(`/community_sites?slug=eq.${encodeURIComponent(slug)}&select=id,owner_email`),
      { headers: svc() },
    );
    const existing = existingRes.ok ? await existingRes.json() : [];
    if (existing.length > 0) {
      if (existing[0].owner_email === email) {
        siteId = existing[0].id;
      } else {
        slug = `${slug}-${crypto.randomUUID().slice(0, 6)}`;
      }
    }

    if (!siteId) {
      // New site — enforce the per-builder cap
      const mineRes = await fetch(
        rest(`/community_sites?owner_email=eq.${encodeURIComponent(email)}&select=id,slug,name`),
        { headers: svc() },
      );
      const mine = mineRes.ok ? await mineRes.json() : [];
      if (mine.length >= MAX_SITES_PER_BUILDER) {
        return json({
          error: `Community hosting includes ${MAX_SITES_PER_BUILDER} sites per builder — republish one of yours (${mine.map((s: { slug: string }) => s.slug).join(', ')}) by using its name, or reach out to RTP if you need more.`,
        }, 403);
      }

      const createRes = await fetch(rest('/community_sites'), {
        method: 'POST',
        headers: { ...svc(), Prefer: 'return=representation' },
        body: JSON.stringify({ slug, name, owner_email: email }),
      });
      if (!createRes.ok) return json({ error: 'Could not create site' }, 500);
      siteId = (await createRes.json())[0].id;
    } else {
      await fetch(rest(`/community_sites?id=eq.${siteId}`), {
        method: 'PATCH',
        headers: svc(),
        body: JSON.stringify({ name, updated_at: new Date().toISOString() }),
      });
      // Replace all files
      await fetch(rest(`/site_files?site_id=eq.${siteId}`), { method: 'DELETE', headers: svc() });
    }

    const rows = files.map((f: { path: string; content: string }) => {
      const clean = String(f.path).replace(/^\//, '');
      const ext = clean.split('.').pop()?.toLowerCase() ?? '';
      return {
        site_id: siteId,
        path: clean,
        content: String(f.content),
        content_type: CONTENT_TYPES[ext] ?? 'text/plain; charset=utf-8',
      };
    });
    const insertRes = await fetch(rest('/site_files'), {
      method: 'POST',
      headers: svc(),
      body: JSON.stringify(rows),
    });
    if (!insertRes.ok) return json({ error: 'Could not upload site files' }, 500);

    // Total views so far (for republish feedback)
    const statsRes = await fetch(
      rest(`/site_stats?site_id=eq.${siteId}&select=views`),
      { headers: svc() },
    );
    const stats = statsRes.ok ? await statsRes.json() : [];
    const totalViews = stats.reduce((sum: number, s: { views: number }) => sum + Number(s.views), 0);

    const appUrl = Deno.env.get('APP_URL') ?? 'https://relational-builder.vercel.app';
    return json({
      ok: true,
      slug,
      url: `${appUrl}/s/${slug}/`,
      total_views: totalViews,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
