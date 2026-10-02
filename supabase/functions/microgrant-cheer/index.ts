/**
 * Supabase Edge Function: microgrant-cheer — a small celebration email to
 * the people stewarding the microgrant commons when a neighborhood starts
 * building its own gathering fund from Relational Builder.
 *
 * Fires from the client the moment a microgrant plan is approved for its
 * first build (not opt-in: it carries nothing identifying — the program's
 * name, the locality the builder has on their profile, and which scope they
 * chose). No builder name, no email, no chat.
 *
 * POST JSON: { programName?, locality?, scope?, source? }
 *   - No auth (builders may not be signed in); per-IP rate limited
 *   - Everything is optional and truncated; a bare POST still cheers
 *
 * Deploy (Management API, see CLAUDE.md): slug microgrant-cheer, verify_jwt false
 * Secrets:
 *   RESEND_API_KEY           — Resend key for the relationalbuilder.org domain
 *   MICROGRANT_CHEER_EMAILS  — comma-separated recipients (default: the four stewards below)
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const DEFAULT_RECIPIENTS = [
  'josh@relationaltechproject.org',
  'deborah@relationaltechproject.org',
  'theath50@gmail.com',
  'richiespeeney@gmail.com',
];
const RATE_LIMIT_PER_HOUR = 10;
const MAX_BODY_BYTES = 4_000;
const ipCounts = new Map<string, { hour: string; count: number }>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function clip(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function rateLimited(req: Request): boolean {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const hour = new Date().toISOString().slice(0, 13);
  const cur = ipCounts.get(ip);
  if (!cur || cur.hour !== hour) {
    ipCounts.set(ip, { hour, count: 1 });
    return false;
  }
  cur.count += 1;
  return cur.count > RATE_LIMIT_PER_HOUR;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  if (rateLimited(req)) return json({ error: 'Too many requests' }, 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: 'Body too large' }, 413);
  let body: Record<string, unknown> = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const programName = clip(body.programName, 80);
  const locality = clip(body.locality, 120);
  const scope = clip(body.scope, 60);
  const source = clip(body.source, 60);

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500);
  const to = (Deno.env.get('MICROGRANT_CHEER_EMAILS') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const recipients = to.length > 0 ? to : DEFAULT_RECIPIENTS;

  const where = locality ? ` in ${locality}` : ' somewhere new';
  const name = programName ?? 'a new gathering fund';
  const subject = `🎉 ${name} is being built${where}`;
  const lines = [
    `A neighborhood just approved its plan for a gathering fund in Relational Builder and the first build is underway.`,
    ``,
    `Program: ${name}`,
    `Where: ${locality ?? 'not on the builder’s profile'}`,
    `Scope: ${scope ?? 'not stated'}`,
    source ? `Started from: ${source}` : null,
    ``,
    `This note carries no name or email on purpose. If the builder opts in to a build report, that arrives separately at humans@relationaltechproject.org.`,
  ].filter((l): l is string => l !== null);

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2a3a">
  <p style="font-size:20px;margin:0 0 12px">🎉 ${escapeHtml(name)} is being built${escapeHtml(where)}</p>
  <p>A neighborhood just approved its plan for a gathering fund in Relational Builder and the first build is underway.</p>
  <table style="border-collapse:collapse;margin:12px 0">
    <tr><td style="padding:2px 12px 2px 0;color:#667">Program</td><td>${escapeHtml(name)}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#667">Where</td><td>${escapeHtml(locality ?? 'not on the builder’s profile')}</td></tr>
    <tr><td style="padding:2px 12px 2px 0;color:#667">Scope</td><td>${escapeHtml(scope ?? 'not stated')}</td></tr>
    ${source ? `<tr><td style="padding:2px 12px 2px 0;color:#667">Started from</td><td>${escapeHtml(source)}</td></tr>` : ''}
  </table>
  <p style="color:#667;font-size:13px">This note carries no name or email on purpose. If the builder opts in to a build report, that arrives separately at humans@relationaltechproject.org.</p>
</div>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.org>',
      to: recipients,
      subject,
      text: lines.join('\n'),
      html,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Resend error', res.status, detail);
    return json({ error: 'Email failed', status: res.status }, 502);
  }
  return json({ ok: true, recipients: recipients.length });
});
