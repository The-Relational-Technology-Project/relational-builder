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
 *   list        {app_id, app_key, collection, limit?, member_token?}
 *   get         {app_id, app_key, collection, id, member_token?}
 *   create      {app_id, app_key, collection, data, member_token?, visibility?}
 *   update      {app_id, app_key, collection, id, data, member_token?}
 *   delete      {app_id, app_key, collection, id, member_token?}
 *
 * Builder admin (all require the owner's Builder session in Authorization;
 * these power the Cloud tab in Relational Builder):
 *   admin_overview     {}                          — your apps + usage + limits
 *   admin_collections  {app_id}                    — collections with counts/sizes
 *   admin_docs         {app_id, collection, limit?} — documents (all visibilities)
 *   admin_delete_doc   {app_id, id}                — owner moderation
 *   admin_members      {app_id}                    — neighbors signed into this app
 *   admin_rename_app   {app_id, name}
 *   admin_delete_app   {app_id}                    — removes app + all its data
 *
 * Free community tier: 3 backends per builder, 20MB / 5000 documents each.
 *
 * Neighbor accounts — email-code sign-in for the app's users, so built
 * apps get "neighbors sign in" with zero builder configuration:
 *   auth_request {app_id, app_key, email, name?}  — emails a 6-digit code
 *   auth_verify  {app_id, app_key, email, code}   — → {member_token, member}
 *   auth_me      {app_id, app_key, member_token}  — → {member | null}
 *   auth_signout {app_id, app_key, member_token}
 *
 * Signed-in members are stamped onto documents they create (member_id +
 * member_name); those documents can only be updated/deleted by their
 * creator. visibility: 'public' (default) or 'members' (list/get require a
 * valid member_token). Anonymous writes still work exactly as before.
 *
 * Deploy: supabase functions deploy app-data --no-verify-jwt
 * Secrets: RESEND_API_KEY (shared with notify-invite)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_DATA_BYTES = 32 * 1024;
const MAX_LIST_LIMIT = 100;
const MAX_DOCS_PER_APP = 5000;
const MAX_APPS_PER_BUILDER = 3;
const MAX_BYTES_PER_APP = 20 * 1024 * 1024;
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

    // Builder-facing admin: authenticated by session + ownership, not app_key
    if (action.startsWith('admin_')) {
      return await handleAdmin(req, body, action);
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
      restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,app_key,name`),
      { headers: svcHeaders() },
    );
    const apps = appRes.ok ? await appRes.json() : [];
    if (!Array.isArray(apps) || apps.length === 0 || apps[0].app_key !== appKey) {
      return json({ error: 'Unknown app or wrong key' }, 403);
    }
    const appName = String(apps[0].name ?? 'this community app');

    // Neighbor auth actions
    if (action === 'auth_request') return await authRequest(appId, appName, body);
    if (action === 'auth_verify') return await authVerify(appId, body);
    if (action === 'auth_me') {
      const member = await resolveMember(appId, body.member_token);
      return json({ member });
    }
    if (action === 'auth_signout') {
      const token = String(body.member_token ?? '');
      if (token) {
        await fetch(restUrl(`/app_sessions?token=eq.${encodeURIComponent(token)}&app_id=eq.${encodeURIComponent(appId)}`), {
          method: 'DELETE',
          headers: svcHeaders(),
        });
      }
      return json({ ok: true });
    }

    // Data actions may carry a member identity
    const member = await resolveMember(appId, body.member_token);

    switch (action) {
      case 'list': {
        const limit = Math.min(Number(body.limit ?? 50) || 50, MAX_LIST_LIMIT);
        // Members-only documents stay hidden without a valid member session
        const visFilter = member ? '' : `&visibility=eq.public`;
        const res = await fetch(
          restUrl(
            `/app_documents?app_id=eq.${encodeURIComponent(appId)}&collection=eq.${encodeURIComponent(collection)}` +
            `&select=id,data,member_id,member_name,visibility,created_at,updated_at&order=created_at.desc&limit=${limit}${visFilter}`,
          ),
          { headers: svcHeaders() },
        );
        return json({ documents: await res.json() });
      }

      case 'get': {
        const id = String(body.id ?? '');
        if (!id) return json({ error: 'id required' }, 400);
        const res = await fetch(
          restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${encodeURIComponent(appId)}&select=id,data,member_id,member_name,visibility,created_at,updated_at`),
          { headers: svcHeaders() },
        );
        const docs = await res.json();
        if (!docs.length) return json({ error: 'Not found' }, 404);
        if (docs[0].visibility === 'members' && !member) {
          return json({ error: 'Sign in to see this' }, 403);
        }
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
          restUrl(`/app_documents?app_id=eq.${encodeURIComponent(appId)}&select=id`),
          { headers: { ...svcHeaders(), Prefer: 'count=exact', Range: '0-0' } },
        );
        const total = Number(countRes.headers.get('content-range')?.split('/')[1] ?? 0);
        if (total >= MAX_DOCS_PER_APP) {
          return json({ error: 'This app has reached its document limit' }, 507);
        }
        if (await storageFull(appId)) {
          return json({ error: `This app's storage is full (${MAX_BYTES_PER_APP / 1024 / 1024}MB) — remove old data in the Builder's Cloud tab` }, 507);
        }
        const visibility = body.visibility === 'members' ? 'members' : 'public';
        if (visibility === 'members' && !member) {
          return json({ error: 'Sign in to post members-only' }, 403);
        }
        const res = await fetch(restUrl('/app_documents'), {
          method: 'POST',
          headers: { ...svcHeaders(), Prefer: 'return=representation' },
          body: JSON.stringify({
            app_id: appId,
            collection,
            data,
            visibility,
            member_id: member?.id ?? null,
            member_name: member?.name ?? null,
          }),
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
        if (await storageFull(appId)) {
          return json({ error: `This app's storage is full (${MAX_BYTES_PER_APP / 1024 / 1024}MB) — remove old data in the Builder's Cloud tab` }, 507);
        }
        const owned = await ownershipCheck(appId, id, member);
        if (owned !== true) return owned;
        const res = await fetch(
          restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${encodeURIComponent(appId)}`),
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
        const owned = await ownershipCheck(appId, id, member);
        if (owned !== true) return owned;
        await fetch(
          restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${encodeURIComponent(appId)}`),
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

interface Member {
  id: string;
  email: string;
  name: string | null;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CODES_PER_HOUR = 5;
/** Wrong-guess cap per issued sign-in code — defeats brute-forcing a 6-digit code */
const MAX_VERIFY_ATTEMPTS = 6;

/** Resolve a member from a session token (null when absent/expired) */
async function resolveMember(appId: string, tokenRaw: unknown): Promise<Member | null> {
  const token = String(tokenRaw ?? '');
  if (!token) return null;
  const res = await fetch(
    restUrl(`/app_sessions?token=eq.${encodeURIComponent(token)}&app_id=eq.${encodeURIComponent(appId)}&select=member_id,expires_at`),
    { headers: svcHeaders() },
  );
  const sessions = res.ok ? await res.json() : [];
  if (!sessions.length || new Date(sessions[0].expires_at) < new Date()) return null;
  const memberRes = await fetch(
    restUrl(`/app_members?id=eq.${sessions[0].member_id}&select=id,email,name`),
    { headers: svcHeaders() },
  );
  const members = memberRes.ok ? await memberRes.json() : [];
  return members[0] ?? null;
}

/** Creator-owned documents can only change under their creator's session */
async function ownershipCheck(appId: string, docId: string, member: Member | null): Promise<true | Response> {
  const res = await fetch(
    restUrl(`/app_documents?id=eq.${encodeURIComponent(docId)}&app_id=eq.${encodeURIComponent(appId)}&select=member_id`),
    { headers: svcHeaders() },
  );
  const docs = res.ok ? await res.json() : [];
  if (!docs.length) return json({ error: 'Not found' }, 404);
  if (docs[0].member_id && docs[0].member_id !== member?.id) {
    return json({ error: 'Only the neighbor who posted this can change it' }, 403);
  }
  return true;
}

/** Email a 6-digit sign-in code for this app */
async function authRequest(appId: string, appName: string, body: Record<string, unknown>): Promise<Response> {
  const email = String(body.email ?? '').trim().toLowerCase();
  const name = String(body.name ?? '').trim().slice(0, 80) || null;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Enter a valid email address' }, 400);
  }

  // Modest per-email throttle
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const recentRes = await fetch(
    restUrl(`/app_login_codes?app_id=eq.${encodeURIComponent(appId)}&email=eq.${encodeURIComponent(email)}&created_at=gte.${encodeURIComponent(hourAgo)}&select=id`),
    { headers: svcHeaders() },
  );
  const recent = recentRes.ok ? await recentRes.json() : [];
  if (recent.length >= MAX_CODES_PER_HOUR) {
    return json({ error: 'Too many codes requested — try again in an hour' }, 429);
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const insRes = await fetch(restUrl('/app_login_codes'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({
      app_id: appId,
      email,
      name,
      code,
      expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString(),
    }),
  });
  if (!insRes.ok) return json({ error: 'Could not create a sign-in code' }, 500);

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return json({ error: 'Sign-in emails are not configured yet' }, 503);
  const sendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.org>',
      to: [email],
      subject: `${code} is your sign-in code for ${appName}`,
      text: [
        `Hi${name ? ` ${name}` : ''},`,
        '',
        `Your sign-in code for ${appName} is: ${code}`,
        '',
        'It works for the next 10 minutes. If you didn\'t request this, you can ignore it.',
        '',
        `— ${appName}, hosted with Relational Builder`,
      ].join('\n'),
    }),
  });
  if (!sendRes.ok) return json({ error: 'Could not send the sign-in email' }, 502);

  return json({ ok: true, sent: true });
}

/** Trade a valid code for a member session */
async function authVerify(appId: string, body: Record<string, unknown>): Promise<Response> {
  const email = String(body.email ?? '').trim().toLowerCase();
  const code = String(body.code ?? '').trim();
  if (!email || !code) return json({ error: 'email and code required' }, 400);

  // Fetch the most recent live code for this email — NOT filtered by the
  // submitted code — so we can count and cap guesses. This is what stops
  // a 6-digit code from being brute-forced: at most MAX_VERIFY_ATTEMPTS
  // tries per issued code, then it's burned.
  const codeRes = await fetch(
    restUrl(`/app_login_codes?app_id=eq.${encodeURIComponent(appId)}&email=eq.${encodeURIComponent(email)}&used=eq.false&select=id,name,code,attempts,expires_at&order=created_at.desc&limit=1`),
    { headers: svcHeaders() },
  );
  const codes = codeRes.ok ? await codeRes.json() : [];
  if (!codes.length || new Date(codes[0].expires_at) < new Date()) {
    return json({ error: 'That code is wrong or expired — request a fresh one' }, 403);
  }
  const row = codes[0];
  const attempts = Number(row.attempts ?? 0);
  if (attempts >= MAX_VERIFY_ATTEMPTS) {
    // Burn it so guessing can't continue on this code
    await fetch(restUrl(`/app_login_codes?id=eq.${encodeURIComponent(String(row.id))}`), {
      method: 'PATCH',
      headers: svcHeaders(),
      body: JSON.stringify({ used: true }),
    });
    return json({ error: 'Too many tries — request a fresh code' }, 429);
  }
  if (String(row.code) !== code) {
    // Wrong guess: count it against this code
    await fetch(restUrl(`/app_login_codes?id=eq.${encodeURIComponent(String(row.id))}`), {
      method: 'PATCH',
      headers: svcHeaders(),
      body: JSON.stringify({ attempts: attempts + 1 }),
    });
    return json({ error: 'That code is wrong or expired — request a fresh one' }, 403);
  }
  // Correct: burn the code
  await fetch(restUrl(`/app_login_codes?id=eq.${encodeURIComponent(String(row.id))}`), {
    method: 'PATCH',
    headers: svcHeaders(),
    body: JSON.stringify({ used: true }),
  });
  // (below, references to codes[0].name continue to work)

  // Upsert the member (name from the sign-in request wins when present)
  const existingRes = await fetch(
    restUrl(`/app_members?app_id=eq.${encodeURIComponent(appId)}&email=eq.${encodeURIComponent(email)}&select=id,email,name`),
    { headers: svcHeaders() },
  );
  const existing = existingRes.ok ? await existingRes.json() : [];
  let member: Member;
  if (existing.length > 0) {
    member = existing[0];
    if (codes[0].name && codes[0].name !== member.name) {
      await fetch(restUrl(`/app_members?id=eq.${member.id}`), {
        method: 'PATCH',
        headers: svcHeaders(),
        body: JSON.stringify({ name: codes[0].name }),
      });
      member = { ...member, name: codes[0].name };
    }
  } else {
    const createRes = await fetch(restUrl('/app_members'), {
      method: 'POST',
      headers: { ...svcHeaders(), Prefer: 'return=representation' },
      body: JSON.stringify({ app_id: appId, email, name: codes[0].name }),
    });
    if (!createRes.ok) return json({ error: 'Could not create your account' }, 500);
    member = (await createRes.json())[0];
  }

  const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const sessRes = await fetch(restUrl('/app_sessions'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({
      token,
      app_id: appId,
      member_id: member.id,
      expires_at: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
    }),
  });
  if (!sessRes.ok) return json({ error: 'Could not start your session' }, 500);

  return json({ ok: true, member_token: token, member: { id: member.id, email: member.email, name: member.name } });
}

/** Resolve the signed-in builder's email from the Authorization header */
async function resolveBuilder(req: Request): Promise<string | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  const email = String(user.email ?? '').toLowerCase();
  return email || null;
}

/** True when this app's stored documents have reached the storage cap */
async function storageFull(appId: string): Promise<boolean> {
  const res = await fetch(restUrl('/rpc/cloud_app_bytes'), {
    method: 'POST',
    headers: svcHeaders(),
    body: JSON.stringify({ p_app_id: appId }),
  });
  if (!res.ok) return false; // never block writes on a stats failure
  const bytes = Number(await res.json());
  return Number.isFinite(bytes) && bytes >= MAX_BYTES_PER_APP;
}

/** Create a Community Cloud app — requires a signed-in Builder session */
async function createApp(req: Request, body: Record<string, unknown>): Promise<Response> {
  const email = await resolveBuilder(req);
  if (!email) return json({ error: 'Sign in to enable Community Cloud' }, 401);

  // Free community tier: three backends per builder
  const mineRes = await fetch(
    restUrl(`/cloud_apps?owner_email=eq.${encodeURIComponent(email)}&select=id,name`),
    { headers: svcHeaders() },
  );
  const mine = mineRes.ok ? await mineRes.json() : [];
  if (Array.isArray(mine) && mine.length >= MAX_APPS_PER_BUILDER) {
    return json({
      error: `Community Cloud includes ${MAX_APPS_PER_BUILDER} app backends per builder — you can reuse or remove one of yours (${mine.map((a: { name: string }) => a.name).join(', ')}) in the Cloud tab, or reach out to RTP if you need more.`,
    }, 403);
  }

  const appKey = crypto.randomUUID().replace(/-/g, '');
  const name = String(body.name ?? 'Untitled app').slice(0, 120);

  const res = await fetch(restUrl('/cloud_apps'), {
    method: 'POST',
    headers: { ...svcHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify({ app_key: appKey, name, owner_email: email }),
  });
  if (!res.ok) return json({ error: 'Could not create app' }, 500);
  const created = await res.json();

  return json({ app_id: created[0].id, app_key: appKey });
}

// ── Builder admin: the Cloud tab's view into apps, data, and neighbors ──

async function handleAdmin(req: Request, body: Record<string, unknown>, action: string): Promise<Response> {
  const email = await resolveBuilder(req);
  if (!email) return json({ error: 'Sign in to manage your Community Cloud' }, 401);

  if (action === 'admin_overview') {
    const res = await fetch(restUrl('/rpc/cloud_apps_overview'), {
      method: 'POST',
      headers: svcHeaders(),
      body: JSON.stringify({ p_owner_email: email }),
    });
    if (!res.ok) return json({ error: 'Could not load your apps' }, 500);
    const apps = await res.json();
    return json({
      apps,
      limits: {
        max_apps: MAX_APPS_PER_BUILDER,
        max_bytes: MAX_BYTES_PER_APP,
        max_docs: MAX_DOCS_PER_APP,
      },
    });
  }

  // Everything else operates on one app the builder must own
  const appId = String(body.app_id ?? '');
  if (!appId) return json({ error: 'app_id required' }, 400);
  const appRes = await fetch(
    restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}&select=id,name,owner_email`),
    { headers: svcHeaders() },
  );
  const apps = appRes.ok ? await appRes.json() : [];
  if (!apps.length || String(apps[0].owner_email ?? '').toLowerCase() !== email) {
    return json({ error: 'Not your app' }, 403);
  }

  switch (action) {
    case 'admin_collections': {
      const res = await fetch(restUrl('/rpc/cloud_app_collections'), {
        method: 'POST',
        headers: svcHeaders(),
        body: JSON.stringify({ p_app_id: appId }),
      });
      if (!res.ok) return json({ error: 'Could not load collections' }, 500);
      return json({ collections: await res.json() });
    }

    case 'admin_docs': {
      const collection = String(body.collection ?? '').slice(0, 64);
      if (!collection) return json({ error: 'collection required' }, 400);
      const limit = Math.min(Number(body.limit ?? 50) || 50, MAX_LIST_LIMIT);
      const res = await fetch(
        restUrl(
          `/app_documents?app_id=eq.${encodeURIComponent(appId)}&collection=eq.${encodeURIComponent(collection)}` +
          `&select=id,data,member_id,member_name,visibility,created_at,updated_at&order=created_at.desc&limit=${limit}`,
        ),
        { headers: svcHeaders() },
      );
      return json({ documents: await res.json() });
    }

    case 'admin_delete_doc': {
      const id = String(body.id ?? '');
      if (!id) return json({ error: 'id required' }, 400);
      await fetch(
        restUrl(`/app_documents?id=eq.${encodeURIComponent(id)}&app_id=eq.${encodeURIComponent(appId)}`),
        { method: 'DELETE', headers: svcHeaders() },
      );
      return json({ ok: true });
    }

    case 'admin_members': {
      const res = await fetch(
        restUrl(`/app_members?app_id=eq.${encodeURIComponent(appId)}&select=id,email,name,created_at&order=created_at.desc&limit=200`),
        { headers: svcHeaders() },
      );
      return json({ members: await res.json() });
    }

    case 'admin_rename_app': {
      const name = String(body.name ?? '').trim().slice(0, 120);
      if (!name) return json({ error: 'name required' }, 400);
      await fetch(restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}`), {
        method: 'PATCH',
        headers: svcHeaders(),
        body: JSON.stringify({ name }),
      });
      return json({ ok: true });
    }

    case 'admin_delete_app': {
      // FKs cascade: documents, members, sessions, and codes go with the app
      await fetch(restUrl(`/cloud_apps?id=eq.${encodeURIComponent(appId)}`), {
        method: 'DELETE',
        headers: svcHeaders(),
      });
      return json({ ok: true });
    }

    default:
      return json({ error: `Unknown action: ${action}` }, 400);
  }
}
