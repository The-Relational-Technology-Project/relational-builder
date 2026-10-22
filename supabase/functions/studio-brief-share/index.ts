/**
 * Supabase Edge Function: studio-brief-share — a network partner sends the
 * Studio Brief (and the one-page site) they shaped in Relational Builder to
 * the person who sets studios up at the Relational Tech Project.
 *
 * Opt-in only: the client posts here when the partner presses "Send to Josh
 * at RTP" on the card in the chat. The brief names the partner's stewards
 * and their emails, so nothing is ever sent automatically.
 *
 * The message is saved to contact_messages (topic 'studio-brief'; the
 * durable record, so a brief can be found again even if the email is lost)
 * and emailed with the brief inline and as studio-brief.md, plus the page
 * as studio-page.html when it came along, with the partner's email as the
 * reply address.
 *
 * POST JSON: { projectName?, studioName?, tagline?, inCommon?, stewards?, door?,
 *              contact?, builderName?, builderEmail?, note?, brief,
 *              siteHtml?, siteUrl?, consentAt? }
 *   - No auth (builders may not be signed in); per-IP rate limited
 *   - brief is required; everything else is optional and truncated
 *
 * Deploy (Management API, see CLAUDE.md): slug studio-brief-share, verify_jwt false
 * Secrets:
 *   RESEND_API_KEY            — Resend key for the relationalbuilder.org domain
 *   STUDIO_BRIEF_EMAILS       — comma-separated recipients (default: josh@)
 *   SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — provided by the platform
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const DEFAULT_RECIPIENTS = ['josh@relationaltechproject.org'];
const RATE_LIMIT_PER_HOUR = 6;
const MAX_BODY_BYTES = 900_000;
const MAX_BRIEF_CHARS = 60_000;
const MAX_SITE_CHARS = 600_000;
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

function clipText(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

function base64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
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

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
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

  const brief = clipText(body.brief, MAX_BRIEF_CHARS);
  if (!brief) return json({ error: 'The brief is missing' }, 400);

  const studioName = clip(body.studioName, 120) ?? clip(body.projectName, 120) ?? 'A new studio';
  const builderName = clip(body.builderName, 120);
  const builderEmail = clip(body.builderEmail, 200);
  const note = clipText(body.note, 2000);
  const siteHtml = clipText(body.siteHtml, MAX_SITE_CHARS);
  const siteUrl = clip(body.siteUrl, 400);

  const rows: [string, string | null][] = [
    ['Studio', studioName],
    ['Tagline', clip(body.tagline, 200)],
    ['What they hold in common', clip(body.inCommon, 200)],
    ['Stewards', clip(body.stewards, 400)],
    ['Door', clip(body.door, 200)],
    ['Contact on the page', clip(body.contact, 200)],
    ['Sent by', builderName ? `${builderName}${builderEmail ? ` (${builderEmail})` : ''}` : builderEmail],
    ['Live page', siteUrl],
    ['Page attached', siteHtml ? 'yes (studio-page.html)' : 'no'],
  ];

  // The durable record first — the email is best-effort after it
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  if (supabaseUrl) {
    const record = [
      `Studio Brief: ${studioName}`,
      ...rows.slice(1).map(([k, v]) => `${k}: ${v ?? 'not stated'}`),
      note ? `\nNote:\n${note}` : '',
      '',
      brief,
    ].join('\n');
    await fetch(`${supabaseUrl}/rest/v1/contact_messages`, {
      method: 'POST',
      headers: svc(),
      body: JSON.stringify({
        name: builderName,
        email: builderEmail,
        neighborhood: studioName,
        message: record.slice(0, 4000),
        topic: 'studio-brief',
      }),
    }).catch(() => undefined);
  }

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return json({ error: 'RESEND_API_KEY is not configured' }, 500);
  const to = (Deno.env.get('STUDIO_BRIEF_EMAILS') ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const recipients = to.length > 0 ? to : DEFAULT_RECIPIENTS;

  const subject = `Studio Brief: ${studioName}${builderName ? ` — from ${builderName}` : ''}`;
  const intro = `${builderName ?? 'A network partner'} shaped a Studio in Relational Builder and chose to share the brief${siteHtml ? ' and the one-page site' : ''} with you. The brief is below and attached as studio-brief.md${siteHtml ? '; the page is attached as studio-page.html' : ''}. Reply to this email to reach them.`;

  const text = [
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v ?? 'not stated'}`),
    note ? `\nTheir note:\n${note}` : '',
    '',
    '----- Studio Brief -----',
    '',
    brief,
  ].join('\n');

  const html = `<div style="font-family:ui-sans-serif,system-ui,sans-serif;font-size:15px;line-height:1.5;color:#1f2a3a">
  <p style="font-size:20px;margin:0 0 12px">${escapeHtml(subject)}</p>
  <p>${escapeHtml(intro)}</p>
  <table style="border-collapse:collapse;margin:12px 0">
    ${rows.map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#667;vertical-align:top">${escapeHtml(k)}</td><td>${v && k === 'Live page' ? `<a href="${escapeHtml(v)}">${escapeHtml(v)}</a>` : escapeHtml(v ?? 'not stated')}</td></tr>`).join('\n    ')}
  </table>
  ${note ? `<p style="white-space:pre-wrap;border-left:3px solid #D2764B;padding-left:12px;color:#334">${escapeHtml(note)}</p>` : ''}
  <h2 style="font-size:16px;margin:20px 0 8px">Studio Brief</h2>
  <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:13px;line-height:1.45;background:#faf7f2;border:1px solid #e5dcd0;border-radius:8px;padding:12px">${escapeHtml(brief)}</pre>
  <p style="color:#667;font-size:13px">Sent from Relational Builder's "design your studio" journey (relationalbuilder.org/studios) when the partner pressed Send. It is kept in contact_messages under topic studio-brief.</p>
</div>`;

  const attachments: { filename: string; content: string }[] = [
    { filename: 'studio-brief.md', content: base64(brief) },
  ];
  if (siteHtml) attachments.push({ filename: 'studio-page.html', content: base64(siteHtml) });

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.org>',
      to: recipients,
      reply_to: builderEmail ?? undefined,
      subject,
      text,
      html,
      attachments,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    console.error('Resend error', res.status, detail);
    return json({ error: 'Email failed', status: res.status }, 502);
  }
  return json({ ok: true, recipients: recipients.length });
});
