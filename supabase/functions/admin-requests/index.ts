/**
 * Supabase Edge Function: admin-requests — the steward's side of the door.
 *
 * Lists and decides account requests. Only super admins may call it: the
 * caller's verified session email must be in SUPER_ADMIN_EMAILS.
 *
 * POST JSON:
 *   { action: "list" }                     → { requests: [...] }
 *   { action: "approve", id }              → adds community membership,
 *                                            emails the person a welcome
 *   { action: "decline", id }              → marks declined (no email —
 *                                            the steward reaches out
 *                                            personally when it matters)
 *
 * Deploy: supabase functions deploy admin-requests --no-verify-jwt
 * Secrets:
 *   SUPER_ADMIN_EMAILS — comma-separated (default joshuanesbit@gmail.com)
 *   RESEND_API_KEY     — for the welcome email (optional but recommended)
 *   APP_URL            — sign-in link target
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

function superAdmins(): string[] {
  return (Deno.env.get('SUPER_ADMIN_EMAILS') ?? 'joshuanesbit@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Verify the caller and check they're a super admin
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in required' }, 401);
    const user = await userRes.json();
    const callerEmail = String(user.email ?? '').toLowerCase();
    if (!callerEmail || !superAdmins().includes(callerEmail)) {
      return json({ error: 'Not authorized' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    if (action === 'list') {
      const res = await fetch(
        rest('/account_requests?select=*&order=created_at.desc&limit=100'),
        { headers: svc() },
      );
      const requests = res.ok ? await res.json() : [];
      return json({ requests });
    }

    const id = String(body.id ?? '');
    if (!id || (action !== 'approve' && action !== 'decline')) {
      return json({ error: 'action must be list, approve, or decline (with id)' }, 400);
    }

    // Load the request
    const reqRes = await fetch(
      rest(`/account_requests?id=eq.${encodeURIComponent(id)}&select=*`),
      { headers: svc() },
    );
    const rows = reqRes.ok ? await reqRes.json() : [];
    if (rows.length === 0) return json({ error: 'Request not found' }, 404);
    const request = rows[0];

    if (action === 'approve') {
      // Membership is what "approved" means — sign-in then just works
      const insertRes = await fetch(rest('/community_members'), {
        method: 'POST',
        headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({
          email: request.email,
          note: `approved by ${callerEmail}`,
        }),
      });
      if (!insertRes.ok && insertRes.status !== 409) {
        return json({ error: 'Could not create community membership' }, 500);
      }
    }

    await fetch(rest(`/account_requests?id=eq.${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: svc(),
      body: JSON.stringify({
        status: action === 'approve' ? 'approved' : 'declined',
        decided_at: new Date().toISOString(),
        decided_by: callerEmail,
      }),
    });

    // Welcome email with the sign-in link — best-effort
    if (action === 'approve') {
      const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
      const appUrl = Deno.env.get('APP_URL') ?? 'https://relational-builder.vercel.app';
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Relational Builder <hello@relationalbuilder.xyz>',
            to: [request.email],
            subject: "You're in — welcome to Relational Builder",
            html: [
              `<p>Hi${request.name ? ' ' + esc(request.name) : ''},</p>`,
              `<p>Your Relational Builder account is ready. Free community building is included — no API key, no credit card.</p>`,
              `<p><a href="${appUrl}">Open Relational Builder</a> and sign in with this email address (we'll send you a sign-in link — no password to remember).</p>`,
              `<p>Build something your neighborhood will love.</p>`,
            ].join('\n'),
          }),
        }).catch(() => {});
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
