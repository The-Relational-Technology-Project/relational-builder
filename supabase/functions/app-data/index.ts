/**
 * Supabase Edge Function: app-data — the Community Cloud API.
 *
 * Zero-setup shared storage for apps built in Relational Builder. Each app
 * gets an app_id + app_key (created by a signed-in builder); the built app
 * then reads and writes JSON documents in named collections.
 *
 * PUBLIC-BY-DESIGN: the app's keys ship in its page, so anything stored here
 * is community-public. Right for boards, calendars, signups; never secrets.
 *
 * Actions (POST JSON):
 *   create_app  {name}                        — requires builder session (Authorization)
 *   list        {app_id, app_key, collection, limit?}
 *   get         {app_id, app_key, collection, id}
 *   create      {app_id, app_key, collection, data}
 *   update      {app_id, app_key, collection, id, data}
 *   delete      {app_id, app_key, collection, id}
 *
 * Deploy: supabase functions deploy app-data --no-verify-jwt
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_DATA_BYTES = 32 * 1024;
const MAX_LIST_LIMIT = 100;
const MAX_DOCS_PER_APP = 5000;
const RATE_LIMIT_PER_MIN = 120;

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(appId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(appId);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(appId, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function svcHeaders(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function restUrl(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const action = String(body.action ?? '');

    if (action === 'create_app') {
      return await createApp(req, body);
    }

    // All data actions authenticate with app_id + app_key
    const appId = String(body.app_id ?? '');
    const appKey = String(body.app_key ?? '');
    const collection = String(body.collection ?? '').slice(0, 64);
    if (!appId || !appKey) return json({ error: 'app_id and app_key required' }, 401);
    if (!collection) return json({ error: 'collection required' }, 400);
    if (isRateLimited(appId)) {
      return json({ error: 'Rate limit exceeded — try again in a minute' }, 429);
    }

    const appRes = await fetch(
      restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,app_key`),
      { headers: svcHeaders() },
    );
    const apps = appRes.ok ? await appRes.json() : [];
    if (!Array.isArray(apps) || apps.length === 0 || apps[0].app_key !== appKey) {
      return json({ error: 'Unknown app or wrong key' }, 403);
    }

    switch (action) {
      case 'list': {
        const limit = Math.min(Number(body.limit ?? 50) || 50, MAX_LIST_LIMIT);
        const res = await fetch(
          restUrl(
            `/app_documents?app_id=eq.${appId}&collection=eq.${encodeURIComponent(collection)}` +
            `&select=id,data,created_at,updated_at&order=created_at.desc&limit=${limit}`,
          ),
          { headers: svcHeaders() },
        );
        return json({ documents: await res.json() });
      }

      case 'get': {
        const id = String(body.id ?? '');
        if (!id) return json({ error: 'id required' }, 400);
        const res = await fetch(
          restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${appId}&select=id,data,created_at,updated_at`),
          { headers: svcHeaders() },
        );
        const docs = await res.json();
        if (!docs.length) return json({ error: 'Not found' }, 404);
        return json({ document: docs[0] });
      }

      case 'create': {
        const data = body.data;
        if (data === undefined || typeof data !== 'object' || data === null) {
          return json({ error: 'data object required' }, 400);
        }
        if (JSON.stringify(data).length > MAX_DATA_BYTES) {
          return json({ error: `data too large (max ${MAX_DATA_BYTES / 1024}KB)` }, 413);
        }
        // Soft cap on total docs per app
        const countRes = await fetch(
          restUrl(`/app_documents?app_id=eq.${appId}&select=id`),
          { headers: { ...svcHeaders(), Prefer: 'count=exact', Range: '0-0' } },
        );
        const total = Number(countRes.headers.get('content-range')?.split('/')[1] ?? 0);
        if (total >= MAX_DOCS_PER_APP) {
          return json({ error: 'This app has reached its document limit' }, 507);
        }
        const res = await fetch(restUrl('/app_documents'), {
          method: 'POST',
          headers: { ...svcHeaders(), Prefer: 'return=representation' },
          body: JSON.stringify({ app_id: appId, collection, data }),
        });
        const created = await res.json();
        if (!res.ok) return json({ error: 'Create failed' }, 500);
        return json({ document: created[0] });
      }

      case 'update': {
        const id = String(body.id ?? '');
        const data = body.data;
        if (!id) return json({ error: 'id required' }, 400);
        if (data === undefined || typeof data !== 'object' || data === null) {
          return json({ error: 'data object required' }, 400);
        }
        if (JSON.stringify(data).length > MAX_DATA_BYTES) {
          return json({ error: `data too large (max ${MAX_DATA_BYTES / 1024}KB)` }, 413);
        }
        const res = await fetch(
          restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${appId}`),
          {
            method: 'PATCH',
            headers: { ...svcHeaders(), Prefer: 'return=representation' },
            body: JSON.stringify({ data }),
          },
        );
        const updated = await res.json();
        if (!Array.isArray(updated) || updated.length === 0) return json({ error: 'Not found' }, 404);
        return json({ document: updated[0] });
      }

      case 'delete': {
        const id = String(body.id ?? '');
        if (!id) return json({ error: 'id required' }, 400);
        await fetch(
          restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${appId}`),
          { method: 'DELETE', headers: svcHeaders() },
        );
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

/** Create a Community Cloud app — requires a signed-in Builder session */
async function createApp(req: Request, body: Record<string, unknown>): Promise<Response> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return json({ error: 'Sign in to enable Community Cloud' }, 401);
  const user = await userRes.json();
  const email = String(user.email ?? '');
  if (!email) return json({ error: 'Sign in to enable Community Cloud' }, 401);

  const appKey = crypto.randomUUID().replace(/-/g, '');
  const name = String(body.name ?? 'Untitled app').slice(0, 120);

  const res = await fetch(restUrl('/cloud_apps'), {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ app_key: appKey, name, owner_email: email.toLowerCase() }),
  });
  if (!res.ok) return json({ error: 'Could not create app' }, 500);
  const created = await res.json();

  return json({ app_id: created[0].id, app_key: appKey });
}
