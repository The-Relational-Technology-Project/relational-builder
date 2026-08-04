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
 *   query       {app_id, app_key, collection, where?, order?, limit?, offset?, member_token?}
 *     — typed filtered reads; where: [{field, op, value}], op ∈ eq|neq|gt|gte|lt|lte|contains
 *
 * Typed collections (optional): a collection may declare a schema — fields
 * with type/required/unique/maxLength — via admin_schema_set (the Builder
 * syncs these from the project's cloud-schema.json). Writes to a declared
 * collection are validated server-side; undeclared collections stay
 * schemaless and work exactly as before.
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
 *   admin_schema_get   {app_id}                    — collection specs + versions
 *   admin_schema_set   {app_id, collections}       — replace all specs (versioned)
 *   admin_export_page  {app_id, offset?, limit?}   — paged full export (docs;
 *                        page 0 also carries members + collection specs)
 *   admin_backups      {app_id}                    — snapshot list (daily cron
 *                        + manual + pre-restore; newest 14 kept)
 *   admin_backup_now   {app_id}                    — take a snapshot right now
 *   admin_backup_download {app_id, backup_id}      — one snapshot's full payload
 *   admin_restore_backup  {app_id, backup_id}      — replace documents from a
 *                        snapshot (members upserted, never deleted; a
 *                        pre-restore snapshot is taken first)
 *
 * Free community tier: 3 backends per builder, 100MB / 5000 documents each.
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
const MAX_BYTES_PER_APP = 100 * 1024 * 1024;
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

      case 'query': {
        const limit = Math.min(Number(body.limit ?? 50) || 50, MAX_LIST_LIMIT);
        const offset = Math.max(Number(body.offset ?? 0) || 0, 0);
        const where = Array.isArray(body.where) ? body.where : [];
        if (where.length > 8) return json({ error: 'Too many filters (max 8)' }, 400);
        const filters: string[] = [];
        for (const w of where) {
          const field = String(w?.field ?? '');
          const op = String(w?.op ?? 'eq');
          const value = w?.value;
          if (!FIELD_NAME_RE.test(field)) return json({ error: `Bad filter field: ${field}` }, 400);
          if (!QUERY_OPS[op]) return json({ error: `Bad filter op: ${op} (use ${Object.keys(QUERY_OPS).join('|')})` }, 400);
          if (value === undefined || value === null) return json({ error: `Filter on "${field}" needs a value` }, 400);
          if (op === 'contains') {
            filters.push(`data->>${field}=ilike.${encodeURIComponent(`*${String(value)}*`)}`);
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            // -> keeps jsonb typing so numbers compare numerically
            filters.push(`data->${field}=${QUERY_OPS[op]}.${encodeURIComponent(String(value))}`);
          } else {
            filters.push(`data->>${field}=${QUERY_OPS[op]}.${encodeURIComponent(String(value))}`);
          }
        }
        let order = 'order=created_at.desc';
        const ob = body.order as { field?: unknown; dir?: unknown; numeric?: unknown } | undefined;
        if (ob && typeof ob === 'object' && ob.field !== undefined) {
          const field = String(ob.field);
          if (!FIELD_NAME_RE.test(field)) return json({ error: `Bad order field: ${field}` }, 400);
          const dir = ob.dir === 'asc' ? 'asc' : 'desc';
          order = ob.numeric ? `order=data->${field}.${dir}` : `order=data->>${field}.${dir}`;
        }
        const visFilter = member ? '' : `&visibility=eq.public`;
        const res = await fetch(
          restUrl(
            `/app_documents?app_id=eq.${encodeURIComponent(appId)}&collection=eq.${encodeURIComponent(collection)}` +
            (filters.length ? `&${filters.join('&')}` : '') +
            `&select=id,data,member_id,member_name,visibility,created_at,updated_at&${order}&limit=${limit}&offset=${offset}${visFilter}`,
          ),
          { headers: svcHeaders() },
        );
        if (!res.ok) return json({ error: 'Query failed' }, 500);
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
        const schemaFail = await schemaCheck(appId, collection, data as Record<string, unknown>, null);
        if (schemaFail) return schemaFail;
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
        const schemaFail = await schemaCheck(appId, collection, data as Record<string, unknown>, id);
        if (schemaFail) return schemaFail;
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

// ── Typed collections: opt-in schemas, validated writes, typed queries ──

interface FieldSpec {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  unique?: boolean;
  maxLength?: number;
}

interface CollectionSpec {
  fields: Record<string, FieldSpec>;
}

const FIELD_NAME_RE = /^[a-zA-Z0-9_]{1,64}$/;
const MAX_COLLECTIONS = 30;
const MAX_FIELDS = 50;
const QUERY_OPS: Record<string, string> = {
  eq: 'eq', neq: 'neq', gt: 'gt', gte: 'gte', lt: 'lt', lte: 'lte', contains: 'ilike',
};

async function getCollectionSpec(appId: string, collection: string): Promise<CollectionSpec | null> {
  const res = await fetch(
    restUrl(`/app_collections?app_id=eq.${encodeURIComponent(appId)}&name=eq.${encodeURIComponent(collection)}&select=spec`),
    { headers: svcHeaders() },
  );
  const rows = res.ok ? await res.json() : [];
  const spec = rows[0]?.spec;
  return spec && typeof spec === 'object' && spec.fields ? spec as CollectionSpec : null;
}

/** Shape-check one collection spec (used by admin_schema_set) */
function specError(name: string, spec: unknown): string | null {
  if (!FIELD_NAME_RE.test(name)) return `Collection name "${name}" must be letters/digits/underscores`;
  const fields = (spec as CollectionSpec)?.fields;
  if (!fields || typeof fields !== 'object') return `Collection "${name}" needs a fields object`;
  const entries = Object.entries(fields);
  if (entries.length > MAX_FIELDS) return `Collection "${name}" has too many fields (max ${MAX_FIELDS})`;
  for (const [fname, f] of entries) {
    if (!FIELD_NAME_RE.test(fname)) return `Field "${name}.${fname}" must be letters/digits/underscores`;
    if (!['string', 'number', 'boolean', 'array', 'object'].includes((f as FieldSpec)?.type)) {
      return `Field "${name}.${fname}" has unknown type "${(f as FieldSpec)?.type}"`;
    }
  }
  return null;
}

/** Validate a document against its collection's spec; null when it passes */
function validateData(spec: CollectionSpec, data: Record<string, unknown>): string | null {
  for (const [fname, f] of Object.entries(spec.fields)) {
    const value = data[fname];
    if (value === undefined || value === null) {
      if (f.required) return `"${fname}" is required`;
      continue;
    }
    const ok =
      f.type === 'string' ? typeof value === 'string' :
      f.type === 'number' ? typeof value === 'number' && Number.isFinite(value) :
      f.type === 'boolean' ? typeof value === 'boolean' :
      f.type === 'array' ? Array.isArray(value) :
      typeof value === 'object' && !Array.isArray(value);
    if (!ok) return `"${fname}" should be a ${f.type}`;
    if (f.type === 'string' && f.maxLength && (value as string).length > f.maxLength) {
      return `"${fname}" is too long (max ${f.maxLength} characters)`;
    }
  }
  return null;
}

/** Enforce unique fields with a lookup; returns an error message or null */
async function uniqueViolation(
  appId: string, collection: string, spec: CollectionSpec,
  data: Record<string, unknown>, excludeId: string | null,
): Promise<string | null> {
  for (const [fname, f] of Object.entries(spec.fields)) {
    if (!f.unique) continue;
    const value = data[fname];
    if (value === undefined || value === null) continue;
    const exclude = excludeId ? `&id=neq.${encodeURIComponent(excludeId)}` : '';
    const res = await fetch(
      restUrl(
        `/app_documents?app_id=eq.${encodeURIComponent(appId)}&collection=eq.${encodeURIComponent(collection)}` +
        `&data->>${fname}=eq.${encodeURIComponent(String(value))}${exclude}&select=id&limit=1`,
      ),
      { headers: svcHeaders() },
    );
    const rows = res.ok ? await res.json() : [];
    if (rows.length > 0) return `A document with that "${fname}" already exists`;
  }
  return null;
}

/** Validate + uniqueness for create/update; returns an error Response or null */
async function schemaCheck(
  appId: string, collection: string, data: Record<string, unknown>, excludeId: string | null,
): Promise<Response | null> {
  const spec = await getCollectionSpec(appId, collection);
  if (!spec) return null; // undeclared collections stay schemaless
  const invalid = validateData(spec, data);
  if (invalid) return json({ error: invalid }, 422);
  const dupe = await uniqueViolation(appId, collection, spec, data, excludeId);
  if (dupe) return json({ error: dupe }, 409);
  return null;
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

    case 'admin_schema_get': {
      const res = await fetch(
        restUrl(`/app_collections?app_id=eq.${encodeURIComponent(appId)}&select=name,spec,version,updated_at&order=name.asc`),
        { headers: svcHeaders() },
      );
      return json({ collections: res.ok ? await res.json() : [] });
    }

    case 'admin_schema_set': {
      // Replace-all semantics: the project's cloud-schema.json is the intent;
      // rows here mirror it. Versions bump only when a spec actually changes.
      const incoming = body.collections;
      if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
        return json({ error: 'collections object required' }, 400);
      }
      const entries = Object.entries(incoming as Record<string, unknown>);
      if (entries.length > MAX_COLLECTIONS) {
        return json({ error: `Too many collections (max ${MAX_COLLECTIONS})` }, 400);
      }
      for (const [name, spec] of entries) {
        const bad = specError(name, spec);
        if (bad) return json({ error: bad }, 422);
      }
      const existingRes = await fetch(
        restUrl(`/app_collections?app_id=eq.${encodeURIComponent(appId)}&select=name,spec,version`),
        { headers: svcHeaders() },
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      const existingByName = new Map(
        existing.map((r: { name: string; spec: unknown; version: number }) => [r.name, r]),
      );
      const names = new Set(entries.map(([n]) => n));
      for (const [name, spec] of entries) {
        const prev = existingByName.get(name) as { spec: unknown; version: number } | undefined;
        if (prev && JSON.stringify(prev.spec) === JSON.stringify(spec)) continue;
        const row = {
          app_id: appId,
          name,
          spec,
          version: prev ? prev.version + 1 : 1,
        };
        const res = await fetch(restUrl('/app_collections?on_conflict=app_id,name'), {
          method: 'POST',
          headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates' },
          body: JSON.stringify(row),
        });
        if (!res.ok) return json({ error: `Could not save collection "${name}"` }, 500);
      }
      // Collections dropped from the spec lose their schema (docs stay put)
      for (const r of existing as { name: string }[]) {
        if (names.has(r.name)) continue;
        await fetch(
          restUrl(`/app_collections?app_id=eq.${encodeURIComponent(appId)}&name=eq.${encodeURIComponent(r.name)}`),
          { method: 'DELETE', headers: svcHeaders() },
        );
      }
      return json({ ok: true, count: entries.length });
    }

    case 'admin_export_page': {
      // Full-fidelity export, paged: the whole point of Community Cloud is
      // that neighbors' data can always leave with the builder. Client
      // assembles pages into one JSON (or per-collection CSVs).
      const offset = Math.max(0, Number(body.offset ?? 0) || 0);
      const limit = Math.min(Number(body.limit ?? 1000) || 1000, 1000);
      const res = await fetch(
        restUrl(
          `/app_documents?app_id=eq.${encodeURIComponent(appId)}` +
          `&select=id,collection,data,member_id,member_name,visibility,created_at,updated_at` +
          `&order=created_at.asc&offset=${offset}&limit=${limit}`,
        ),
        { headers: svcHeaders() },
      );
      if (!res.ok) return json({ error: 'Could not read documents' }, 500);
      const documents = await res.json();
      // First page carries the surroundings so one loop yields a complete file
      if (offset === 0) {
        const [membersRes, collectionsRes] = await Promise.all([
          fetch(
            restUrl(`/app_members?app_id=eq.${encodeURIComponent(appId)}&select=id,email,name,created_at&order=created_at.asc&limit=1000`),
            { headers: svcHeaders() },
          ),
          fetch(
            restUrl(`/app_collections?app_id=eq.${encodeURIComponent(appId)}&select=name,spec,version&order=name.asc`),
            { headers: svcHeaders() },
          ),
        ]);
        return json({
          app: { id: appId, name: apps[0].name },
          documents,
          members: membersRes.ok ? await membersRes.json() : [],
          collections: collectionsRes.ok ? await collectionsRes.json() : [],
          done: documents.length < limit,
        });
      }
      return json({ documents, done: documents.length < limit });
    }

    case 'admin_backups': {
      const res = await fetch(
        restUrl(
          `/app_backend_backups?app_id=eq.${encodeURIComponent(appId)}` +
          `&select=id,taken_at,reason,doc_count,member_count,bytes,skipped_reason&order=taken_at.desc&limit=20`,
        ),
        { headers: svcHeaders() },
      );
      return json({ backups: res.ok ? await res.json() : [] });
    }

    case 'admin_backup_now': {
      const res = await fetch(restUrl('/rpc/take_app_backend_backup'), {
        method: 'POST',
        headers: svcHeaders(),
        body: JSON.stringify({ p_app_id: appId, p_reason: 'manual' }),
      });
      if (!res.ok) return json({ error: 'Backup failed' }, 500);
      return json({ ok: true, backup_id: await res.json() });
    }

    case 'admin_backup_download': {
      const backupId = String(body.backup_id ?? '');
      if (!backupId) return json({ error: 'backup_id required' }, 400);
      const res = await fetch(
        restUrl(
          `/app_backend_backups?id=eq.${encodeURIComponent(backupId)}&app_id=eq.${encodeURIComponent(appId)}` +
          `&select=id,taken_at,doc_count,member_count,payload,skipped_reason`,
        ),
        { headers: svcHeaders() },
      );
      const rows = res.ok ? await res.json() : [];
      if (!rows.length) return json({ error: 'Backup not found' }, 404);
      if (!rows[0].payload) {
        return json({ error: 'This backup was too large to store — use Download data instead' }, 422);
      }
      return json({ backup: rows[0] });
    }

    case 'admin_restore_backup': {
      const backupId = String(body.backup_id ?? '');
      if (!backupId) return json({ error: 'backup_id required' }, 400);
      const res = await fetch(restUrl('/rpc/restore_app_backend_backup'), {
        method: 'POST',
        headers: svcHeaders(),
        body: JSON.stringify({ p_app_id: appId, p_backup_id: backupId }),
      });
      if (!res.ok) return json({ error: 'Restore failed' }, 500);
      const result = await res.json();
      if (result?.error) return json({ error: result.error }, 422);
      return json(result);
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
