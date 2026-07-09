/**
 * Supabase Edge Function: contact — say hello, no account needed.
 *
 * The landing page's contact form posts here. The message is saved to
 * contact_messages (the durable record) and a copy goes to the steward by
 * email — best-effort, since the row is already safe in the database.
 *
 * POST JSON: { name?, email?, neighborhood?, message }
 *   - No auth (anyone may write to us); per-IP rate limited
 *
 * Deploy: supabase functions deploy contact --no-verify-jwt
 * Secrets:
 *   RESEND_API_KEY  — Resend key for the relationalbuilder.org domain
 *   STEWARD_EMAIL   — where messages go (default josh@relationaltechproject.org)
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
      return json({ error: 'Too many messages — try again in a bit' }, 429);
    }
    ipCounts.set(ip, { hour, count: bucket?.hour === hour ? bucket.count + 1 : 1 });

    const body = await req.json().catch(() => ({}));
    const message = String(body.message ?? '').slice(0, 4000).trim();
    if (!message) return json({ error: 'Say something — even a short hello' }, 400);
    const name = String(body.name ?? '').slice(0, 120).trim() || null;
    const email = String(body.email ?? '').slice(0, 200).trim() || null;
    const neighborhood = String(body.neighborhood ?? '').slice(0, 160).trim() || null;

    const insertRes = await fetch(rest('/contact_messages'), {
      method: 'POST',
      headers: svc(),
      body: JSON.stringify({ name, email, neighborhood, message }),
    });
    if (!insertRes.ok) return json({ error: 'Could not save your message' }, 500);

    // Copy to the steward — best-effort; the message is already saved
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const steward = Deno.env.get('STEWARD_EMAIL') ?? 'josh@relationaltechproject.org';
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Relational Builder <hello@relationalbuilder.org>',
          to: [steward],
          reply_to: email ?? undefined,
          subject: `Builder contact: ${name ?? email ?? 'someone'}`,
          html: [
            `<p><strong>${esc(name ?? 'Someone')}</strong>${email ? ` (${esc(email)})` : ''} wrote through the Relational Builder contact form.</p>`,
            neighborhood ? `<p><strong>Neighborhood:</strong> ${esc(neighborhood)}</p>` : '',
            `<p>${esc(message).replace(/\n/g, '<br>')}</p>`,
          ].join('\n'),
        }),
      }).catch(() => {});
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
