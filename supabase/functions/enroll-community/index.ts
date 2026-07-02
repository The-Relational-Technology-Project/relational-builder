/**
 * Supabase Edge Function: enroll-community — passcode → community access.
 *
 * The invitation passcode already gates entry to the app; holding it plus a
 * signed-in session is what "invited" means. This function turns that into
 * community membership automatically, so invitees never hit the
 * "add your own API key" dead end.
 *
 * POST JSON: { passcode }
 *   - Requires a Builder session (Authorization: Bearer <token>)
 *   - Passcode is checked server-side against the ACCESS_CODE secret
 *   - Idempotent: existing members return ok immediately
 *
 * Deploy: supabase functions deploy enroll-community --no-verify-jwt
 * Secrets: ACCESS_CODE (same code the invitations carry)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const accessCode = Deno.env.get('ACCESS_CODE') ?? '';
    if (!accessCode) return json({ error: 'Enrollment is not configured' }, 503);

    // Who is asking?
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in first' }, 401);
    const user = await userRes.json();
    const email = String(user.email ?? '').toLowerCase();
    if (!email) return json({ error: 'Sign in first' }, 401);

    const body = await req.json().catch(() => ({}));
    if (String(body.passcode ?? '').trim() !== accessCode) {
      return json({ error: 'That passcode does not match a current invitation' }, 403);
    }

    // Already a member? Done.
    const existingRes = await fetch(
      rest(`/community_members?email=eq.${encodeURIComponent(email)}&select=email`),
      { headers: svc() },
    );
    const existing = existingRes.ok ? await existingRes.json() : [];
    if (existing.length > 0) return json({ ok: true, enrolled: false });

    const insertRes = await fetch(rest('/community_members'), {
      method: 'POST',
      headers: svc(),
      body: JSON.stringify({ email, note: 'self-enrolled via invitation passcode' }),
    });
    if (!insertRes.ok) return json({ error: 'Could not activate community access' }, 500);

    return json({ ok: true, enrolled: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
