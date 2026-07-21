/**
 * Supabase Edge Function: supabase-admin — the Builder operates a builder's
 * OWN Supabase projects for them.
 *
 * A builder connects a Supabase personal access token once (vaulted in
 * builder_secrets, write-only); the Builder then applies AI-generated
 * migrations, deploys edge functions, and sets secrets on the builder's
 * projects through the Supabase Management API — the "graduate to your own
 * database" path. The PAT never reaches a browser.
 *
 * Every action requires the builder's session (Authorization) — this
 * function is never app-authed. Actions (POST JSON):
 *   pat_set        {secret}                 — vault the PAT (verified live first)
 *   pat_status     {}                       — {connected, last_used_at}; never the value
 *   pat_delete     {}
 *   sb_projects    {}                       — the builder's projects [{ref, name, status}]
 *   sb_project_keys{project_ref}            — {url, anon_key} for wiring env vars
 *   sb_apply_migrations {project_ref, migrations: [{name, sql}]}
 *     — idempotent: a _rb_migrations ledger (name + sha256) in the builder's
 *       database records what ran; unchanged files skip, changed files report
 *       drift instead of silently re-running. Returns per-file status.
 *   sb_deploy_function  {project_ref, slug, code, verify_jwt?}
 *   sb_set_secrets      {project_ref, secrets: [{name, value}]}
 *
 * Deploy: supabase functions deploy supabase-admin --no-verify-jwt
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MGMT = 'https://api.supabase.com/v1';
const RATE_LIMIT_PER_MIN = 30;
const MAX_MIGRATIONS_PER_CALL = 20;
const MAX_SQL_BYTES = 100 * 1024;
const MAX_FUNCTION_BYTES = 256 * 1024;
const MIGRATION_NAME_RE = /^[a-zA-Z0-9._-]{1,120}$/;
const SLUG_RE = /^[a-z0-9-]{1,60}$/;
const SECRET_NAME_RE = /^[A-Z0-9_]{1,64}$/;
const PROJECT_REF_RE = /^[a-z]{20}$/;

const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function isRateLimited(email: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(email);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(email, { count: 1, windowStart: now });
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

async function getPat(email: string): Promise<string | null> {
  const res = await fetch(
    restUrl(`/builder_secrets?builder_email=eq.${encodeURIComponent(email)}&service=eq.supabase_pat&select=secret`),
    { headers: svcHeaders() },
  );
  const rows = res.ok ? await res.json() : [];
  return rows[0]?.secret ?? null;
}

function patHeaders(pat: string): Record<string, string> {
  return { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' };
}

async function touchPat(email: string): Promise<void> {
  await fetch(
    restUrl(`/builder_secrets?builder_email=eq.${encodeURIComponent(email)}&service=eq.supabase_pat`),
    { method: 'PATCH', headers: svcHeaders(), body: JSON.stringify({ last_used_at: new Date().toISOString() }) },
  ).catch(() => {});
}

async function sha256hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Run SQL on the builder's project; returns {ok, rows?, error?} */
async function runQuery(pat: string, ref: string, query: string): Promise<{ ok: boolean; rows?: unknown; error?: string }> {
  const res = await fetch(`${MGMT}/projects/${ref}/database/query`, {
    method: 'POST',
    headers: patHeaders(pat),
    body: JSON.stringify({ query }),
  });
  if (res.ok) return { ok: true, rows: await res.json().catch(() => []) };
  let error = `Query failed (${res.status})`;
  try {
    const body = await res.json();
    error = String(body?.message ?? error).slice(0, 500);
  } catch { /* keep default */ }
  return { ok: false, error };
}

const LEDGER_DDL = [
  'create table if not exists public._rb_migrations (',
  '  name text primary key,',
  '  hash text not null,',
  "  applied_at timestamptz not null default now()",
  ');',
].join('\n');

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const action = String(body.action ?? '');

    const email = await resolveBuilder(req);
    if (!email) return json({ error: 'Sign in to manage your Supabase projects' }, 401);
    if (isRateLimited(email)) {
      return json({ error: 'Rate limit exceeded — try again in a minute' }, 429);
    }

    if (action === 'pat_set') {
      const secret = String(body.secret ?? '').trim();
      if (!secret || secret.length > 200) return json({ error: 'An access token is required' }, 400);
      // Verify live before vaulting — a token that can't list projects is useless here
      const check = await fetch(`${MGMT}/projects`, { headers: patHeaders(secret) });
      if (check.status === 401 || check.status === 403) {
        return json({ error: 'Supabase rejected this token — check that you copied it fully' }, 422);
      }
      if (!check.ok) return json({ error: 'Could not reach Supabase — try again shortly' }, 502);
      const projects = await check.json();
      const res = await fetch(restUrl('/builder_secrets?on_conflict=builder_email,service'), {
        method: 'POST',
        headers: { ...svcHeaders(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ builder_email: email, service: 'supabase_pat', secret }),
      });
      if (!res.ok) return json({ error: 'Could not save the token' }, 500);
      return json({ ok: true, projects_count: Array.isArray(projects) ? projects.length : 0 });
    }

    if (action === 'pat_status') {
      const res = await fetch(
        restUrl(`/builder_secrets?builder_email=eq.${encodeURIComponent(email)}&service=eq.supabase_pat&select=created_at,last_used_at`),
        { headers: svcHeaders() },
      );
      const rows = res.ok ? await res.json() : [];
      return json({ connected: rows.length > 0, ...(rows[0] ?? {}) });
    }

    if (action === 'pat_delete') {
      await fetch(
        restUrl(`/builder_secrets?builder_email=eq.${encodeURIComponent(email)}&service=eq.supabase_pat`),
        { method: 'DELETE', headers: svcHeaders() },
      );
      return json({ ok: true });
    }

    // Everything below needs the vaulted PAT
    const pat = await getPat(email);
    if (!pat) return json({ error: 'Connect your Supabase access token first (Services tab)' }, 412);

    if (action === 'sb_projects') {
      const res = await fetch(`${MGMT}/projects`, { headers: patHeaders(pat) });
      if (!res.ok) return json({ error: 'Supabase rejected the saved token — reconnect it in the Services tab' }, 502);
      const projects = await res.json();
      touchPat(email);
      return json({
        projects: (Array.isArray(projects) ? projects : []).map((p: Record<string, unknown>) => ({
          ref: p.id, name: p.name, region: p.region, status: p.status,
        })),
      });
    }

    const ref = String(body.project_ref ?? '');
    if (!PROJECT_REF_RE.test(ref)) return json({ error: 'project_ref required' }, 400);

    switch (action) {
      case 'sb_project_keys': {
        const res = await fetch(`${MGMT}/projects/${ref}/api-keys`, { headers: patHeaders(pat) });
        if (!res.ok) return json({ error: 'Could not read the project API keys' }, 502);
        const keys = await res.json();
        const anon = (Array.isArray(keys) ? keys : []).find((k: { name?: string }) => k.name === 'anon');
        if (!anon?.api_key) return json({ error: 'No anon key on that project' }, 404);
        touchPat(email);
        return json({ url: `https://${ref}.supabase.co`, anon_key: anon.api_key });
      }

      case 'sb_apply_migrations': {
        const migrations = Array.isArray(body.migrations) ? body.migrations : [];
        if (migrations.length === 0) return json({ error: 'migrations required' }, 400);
        if (migrations.length > MAX_MIGRATIONS_PER_CALL) {
          return json({ error: `Too many migrations in one call (max ${MAX_MIGRATIONS_PER_CALL})` }, 400);
        }
        for (const m of migrations) {
          if (!MIGRATION_NAME_RE.test(String(m?.name ?? ''))) {
            return json({ error: `Bad migration name: ${String(m?.name ?? '')}` }, 400);
          }
          if (typeof m?.sql !== 'string' || !m.sql.trim() || m.sql.length > MAX_SQL_BYTES) {
            return json({ error: `Migration ${m.name}: SQL missing or too large (max ${MAX_SQL_BYTES / 1024}KB)` }, 400);
          }
        }

        const ledger = await runQuery(pat, ref, LEDGER_DDL);
        if (!ledger.ok) return json({ error: `Could not prepare the migration ledger: ${ledger.error}` }, 502);
        const appliedRes = await runQuery(pat, ref, 'select name, hash from public._rb_migrations;');
        if (!appliedRes.ok) return json({ error: `Could not read the migration ledger: ${appliedRes.error}` }, 502);
        const applied = new Map(
          (Array.isArray(appliedRes.rows) ? appliedRes.rows : [])
            .map((r: { name: string; hash: string }) => [r.name, r.hash]),
        );

        const results: { name: string; status: 'applied' | 'skipped' | 'drift' | 'error'; error?: string }[] = [];
        for (const m of migrations) {
          const name = String(m.name);
          const hash = await sha256hex(m.sql);
          const prior = applied.get(name);
          if (prior === hash) { results.push({ name, status: 'skipped' }); continue; }
          if (prior !== undefined) {
            results.push({
              name, status: 'drift',
              error: 'This file already ran with different contents. New schema changes belong in a NEW migration file.',
            });
            continue;
          }
          const run = await runQuery(pat, ref, m.sql);
          if (!run.ok) {
            results.push({ name, status: 'error', error: run.error });
            break; // migrations are ordered — don't run later ones over a failure
          }
          // name is charset-checked and hash is hex, so plain literals are safe
          const record = await runQuery(
            pat, ref,
            `insert into public._rb_migrations (name, hash) values ('${name}', '${hash}');`,
          );
          if (!record.ok) {
            results.push({ name, status: 'error', error: `Ran, but could not record it: ${record.error}` });
            break;
          }
          results.push({ name, status: 'applied' });
        }
        touchPat(email);
        return json({ results });
      }

      case 'sb_deploy_function': {
        const slug = String(body.slug ?? '');
        const code = String(body.code ?? '');
        if (!SLUG_RE.test(slug)) return json({ error: 'Bad function slug (lowercase letters, digits, dashes)' }, 400);
        if (!code.trim() || code.length > MAX_FUNCTION_BYTES) {
          return json({ error: `Function code missing or too large (max ${MAX_FUNCTION_BYTES / 1024}KB)` }, 400);
        }
        const verifyJwt = body.verify_jwt === true;
        const form = new FormData();
        form.append(
          'metadata',
          new Blob(
            [JSON.stringify({ name: slug, entrypoint_path: 'index.ts', verify_jwt: verifyJwt })],
            { type: 'application/json' },
          ),
        );
        form.append('file', new Blob([code], { type: 'application/typescript' }), 'index.ts');
        const res = await fetch(`${MGMT}/projects/${ref}/functions/deploy?slug=${slug}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${pat}` },
          body: form,
        });
        if (!res.ok) {
          let error = `Deploy failed (${res.status})`;
          try { error = String((await res.json())?.message ?? error).slice(0, 500); } catch { /* keep */ }
          return json({ error }, 502);
        }
        touchPat(email);
        const out = await res.json();
        return json({ ok: true, version: out?.version ?? null });
      }

      case 'sb_set_secrets': {
        const secrets = Array.isArray(body.secrets) ? body.secrets : [];
        if (secrets.length === 0 || secrets.length > 20) return json({ error: 'secrets: 1–20 required' }, 400);
        for (const s of secrets) {
          if (!SECRET_NAME_RE.test(String(s?.name ?? ''))) return json({ error: `Bad secret name: ${String(s?.name ?? '')}` }, 400);
          if (typeof s?.value !== 'string' || !s.value) return json({ error: `Secret ${s.name} needs a value` }, 400);
        }
        const res = await fetch(`${MGMT}/projects/${ref}/secrets`, {
          method: 'POST',
          headers: patHeaders(pat),
          body: JSON.stringify(secrets.map((s: { name: string; value: string }) => ({ name: s.name, value: s.value }))),
        });
        if (!res.ok) {
          let error = `Setting secrets failed (${res.status})`;
          try { error = String((await res.json())?.message ?? error).slice(0, 500); } catch { /* keep */ }
          return json({ error }, 502);
        }
        touchPat(email);
        return json({ ok: true });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
