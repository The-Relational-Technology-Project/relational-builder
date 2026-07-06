/**
 * Supabase Edge Function: request-account — the open front door.
 *
 * Anyone can ask for a Relational Builder account: no passcode, no signup
 * maze. The request is stored (one live request per email) and the steward
 * is notified by email; approval happens in the super admin dashboard
 * (see admin-requests).
 *
 * POST JSON: { email, name?, neighborhood?, reason? }
 *   - No auth (requesters have no account yet); per-IP rate limited
 *   - Idempotent-ish: a repeat request for a pending email returns ok,
 *     an already-approved email is told to just sign in
 *
 * Deploy: supabase functions deploy request-account --no-verify-jwt
 * Secrets:
 *   RESEND_API_KEY  — Resend key for the relationalbuilder.org domain
 *   STEWARD_EMAIL   — where request notifications go
 *                     (default josh@relationaltechproject.org)
 *   APP_URL         — link target (default https://relational-builder.vercel.app)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RATE_LIMIT_PER_HOUR = 5;
const ipCounts = new Map<string, { hour: string; count: number }>();

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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Soft per-IP rate limit (per warm isolate) — enough to stop scripts
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const hour = new Date().toISOString().slice(0, 13);
    const bucket = ipCounts.get(ip);
    if (bucket && bucket.hour === hour && bucket.count >= RATE_LIMIT_PER_HOUR) {
      return json({ error: 'Too many requests — try again in a bit' }, 429);
    }
    ipCounts.set(ip, { hour, count: bucket?.hour === hour ? bucket.count + 1 : 1 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'A real email address is required' }, 400);
    }
    const name = String(body.name ?? '').slice(0, 120).trim() || null;
    const neighborhood = String(body.neighborhood ?? '').slice(0, 160).trim() || null;
    const reason = String(body.reason ?? '').slice(0, 1000).trim() || null;

    // Already a community member → just sign in
    const memberRes = await fetch(
      rest(`/community_members?email=eq.${encodeURIComponent(email)}&select=email`),
      { headers: svc() },
    );
    const members = memberRes.ok ? await memberRes.json() : [];
    if (members.length > 0) {
      return json({ ok: true, status: 'already-member' });
    }

    // Existing request → tell them where it stands, don't re-notify
    const existingRes = await fetch(
      rest(`/account_requests?email=eq.${encodeURIComponent(email)}&select=status`),
      { headers: svc() },
    );
    const existing = existingRes.ok ? await existingRes.json() : [];
    if (existing.length > 0) {
      return json({ ok: true, status: existing[0].status === 'approved' ? 'already-member' : 'pending' });
    }

    const insertRes = await fetch(rest('/account_requests'), {
      method: 'POST',
      headers: svc(),
      body: JSON.stringify({ email, name, neighborhood, reason }),
    });
    if (!insertRes.ok) return json({ error: 'Could not save your request' }, 500);

    // Notify the steward — best-effort; the request is already saved
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const steward = Deno.env.get('STEWARD_EMAIL') ?? 'josh@relationaltechproject.org';
    const appUrl = Deno.env.get('APP_URL') ?? 'https://relational-builder.vercel.app';
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Relational Builder <hello@relationalbuilder.org>',
          to: [steward],
          subject: `Account request: ${name ?? email}`,
          html: [
            `<p><strong>${esc(name ?? 'Someone')}</strong> (${esc(email)}) asked for a Relational Builder account.</p>`,
            neighborhood ? `<p><strong>Neighborhood:</strong> ${esc(neighborhood)}</p>` : '',
            reason ? `<p><strong>What they want to build:</strong><br>${esc(reason)}</p>` : '',
            `<p>Approve or decline in your <a href="${appUrl}">super admin dashboard</a> (account menu → Account requests).</p>`,
          ].join('\n'),
        }),
      }).catch(() => {});
    }

    return json({ ok: true, status: 'pending' });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
