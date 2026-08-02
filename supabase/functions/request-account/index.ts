/**
 * Supabase Edge Function: request-account — the open front door.
 *
 * Anyone can ask for a Relational Builder account: no passcode, no signup
 * maze. The request is stored (one live request per email) and the steward
 * is notified by email; approval happens in the super admin dashboard
 * (see admin-requests).
 *
 * POST JSON: { email, name?, neighborhood?, reason?, studio_slug?, studio_label? }
 *   - No auth (requesters have no account yet); per-IP rate limited
 *   - Idempotent-ish: a repeat request for a pending email returns ok,
 *     an already-approved email is told to just sign in
 *   - studio_slug/label carry the studio doorway the person arrived through
 *     (?studio=thread): at first sign-in a trigger files their request to
 *     join that studio automatically
 *
 * The alert email carries one-click approve/decline links (tokenized, settle
 * on POST only — see steward-respond). Only a hash of the token is stored;
 * the token itself lives nowhere but the steward's inbox.
 *
 * Deploy: supabase functions deploy request-account --no-verify-jwt
 * Secrets:
 *   RESEND_API_KEY  — Resend key for the relationalbuilder.org domain
 *   STEWARD_EMAIL   — where request notifications go
 *                     (default josh@relationaltechproject.org)
 *   APP_URL         — link target (default https://relationalbuilder.org)
 *   SITE_URL        — respond-link domain (default https://relationalbuilder.org)
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

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const RESPOND_TOKEN_DAYS = 7;

/**
 * An unclaimed project invitation for this address, and who sent it.
 *
 * Looked up here rather than accepted from the request body: a referral is the
 * most load-bearing thing on the steward's screen, so it has to be something
 * the server established, not something the form claimed. Informational only —
 * an invitation never approves anyone, it just means the steward is looking at
 * someone an existing builder already vouched for.
 */
async function inviteContext(
  email: string,
): Promise<{ invited_by_email: string | null; invited_project_name: string | null } | null> {
  const res = await fetch(
    rest(
      `/project_members?email=eq.${encodeURIComponent(email)}&user_id=is.null&select=invited_by,project_id&limit=1`,
    ),
    { headers: svc() },
  );
  const rows = res.ok ? await res.json() : [];
  if (rows.length === 0) return null;

  let invitedByEmail: string | null = null;
  if (rows[0].invited_by) {
    const who = await fetch(
      rest(`/profiles?id=eq.${encodeURIComponent(rows[0].invited_by)}&select=email&limit=1`),
      { headers: svc() },
    );
    const whoRows = who.ok ? await who.json() : [];
    invitedByEmail = whoRows[0]?.email ?? null;
  }

  let projectName: string | null = null;
  if (rows[0].project_id) {
    const proj = await fetch(
      rest(`/projects?id=eq.${encodeURIComponent(rows[0].project_id)}&select=name&limit=1`),
      { headers: svc() },
    );
    const projRows = proj.ok ? await proj.json() : [];
    projectName = projRows[0]?.name ?? null;
  }

  return { invited_by_email: invitedByEmail, invited_project_name: projectName };
}

const emailBtn = (href: string, label: string, primary: boolean) =>
  `<a href="${href}" style="display:inline-block;margin:4px 10px 4px 0;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;${
    primary
      ? 'background:#C0532F;color:#FFF7EF;'
      : 'border:1.5px solid #C9B29B;color:#49362B;'
  }">${label}</a>`;

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
    // The studio doorway they arrived through, if any — slugs are simple
    const rawSlug = String(body.studio_slug ?? '').trim().toLowerCase();
    const studioSlug = /^[a-z0-9-]{1,40}$/.test(rawSlug) ? rawSlug : null;
    const studioLabel = studioSlug
      ? String(body.studio_label ?? '').slice(0, 80).trim() || studioSlug
      : null;

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

    // Mint the one-click respond token for the steward email; only its hash
    // touches the database
    const respondToken =
      crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
    const respondTokenHash = await sha256Hex(respondToken);
    const respondTokenExpires = new Date(
      Date.now() + RESPOND_TOKEN_DAYS * 86400_000,
    ).toISOString();

    const invite = await inviteContext(email);

    const insertRes = await fetch(rest('/account_requests'), {
      method: 'POST',
      headers: svc(),
      body: JSON.stringify({
        email, name, neighborhood, reason,
        studio_slug: studioSlug, studio_label: studioLabel,
        ...(invite ?? {}),
        respond_token_hash: respondTokenHash,
        respond_token_expires_at: respondTokenExpires,
      }),
    });
    if (!insertRes.ok) return json({ error: 'Could not save your request' }, 500);

    // Notify the steward — best-effort; the request is already saved
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const steward = Deno.env.get('STEWARD_EMAIL') ?? 'josh@relationaltechproject.org';
    const appUrl = Deno.env.get('APP_URL') ?? 'https://relationalbuilder.org';
    const siteUrl = (Deno.env.get('SITE_URL') ?? 'https://relationalbuilder.org').replace(/\/$/, '');
    if (resendKey) {
      const approveUrl = `${siteUrl}/steward/respond?token=${respondToken}&do=approve`;
      const declineUrl = `${siteUrl}/steward/respond?token=${respondToken}&do=decline`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Relational Builder <hello@relationalbuilder.org>',
          to: [steward],
          subject: `Account request: ${name ?? email}`,
          html: [
            `<p><strong>${esc(name ?? 'Someone')}</strong> (${esc(email)}) asked for a Relational Builder account.</p>`,
            studioLabel ? `<p><strong>Arrived through:</strong> ${esc(studioLabel)} — approving the account will also file their request to join the studio.</p>` : '',
            invite?.invited_by_email
              ? `<p><strong>Invited by:</strong> ${esc(invite.invited_by_email)}${invite.invited_project_name ? ` — to collaborate on “${esc(invite.invited_project_name)}”` : ''}. An existing builder already vouched for them; approving lets them take that invitation up.</p>`
              : '',
            neighborhood ? `<p><strong>Neighborhood:</strong> ${esc(neighborhood)}</p>` : '',
            reason ? `<p><strong>What they want to build:</strong><br>${esc(reason)}</p>` : '',
            `<div>${emailBtn(approveUrl, 'Approve', true)}${emailBtn(declineUrl, 'Decline', false)}</div>`,
            `<p style="font-size:13px;color:#93806F;">These links work without signing in and ask you to confirm before anything happens. They expire in ${RESPOND_TOKEN_DAYS} days — after that (or any time), decide in your <a href="${appUrl}">steward dashboard</a> (account menu → Account requests).</p>`,
          ].join('\n'),
        }),
      }).catch(() => {});
    }

    return json({ ok: true, status: 'pending' });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
