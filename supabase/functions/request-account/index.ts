/**
 * Supabase Edge Function: request-account — the open front door.
 *
 * Anyone can ask for a Relational Builder account: no passcode, no signup
 * maze. The request is stored (one live request per email) and the steward
 * is notified by email; approval happens in the super admin dashboard
 * (see admin-requests).
 *
 * POST JSON: { email, name?, neighborhood?, reason?, studio_slug?,
 *              studio_label?, referral_code? }
 *   - No auth (requesters have no account yet); per-IP rate limited
 *   - Idempotent-ish: a repeat request for a pending email returns ok,
 *     an already-approved email is told to just sign in
 *   - studio_slug/label carry the studio doorway the person arrived through
 *     (?studio=thread): at first sign-in a trigger files their request to
 *     join that studio automatically
 *   - referral_code: a builder's personal invite code (?ref=CODE). Validated
 *     server-side against profiles.referral_code — a real builder's code
 *     auto-approves the request on the spot (account + membership created,
 *     welcome email sent, steward gets an FYI instead of an approve ask).
 *     The magic-link sign-in that follows is the email confirmation: OTPs
 *     only ever go to the address itself. An unrecognized code falls back
 *     to the normal pending flow.
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

/**
 * The builder behind a referral code, or null. Resolved here, never trusted
 * from the form: the code is what authorizes skipping the steward, so it has
 * to match a real profile the server looked up itself.
 */
async function referrerByCode(
  code: string,
): Promise<{ email: string; name: string | null } | null> {
  const res = await fetch(
    rest(
      `/profiles?referral_code=eq.${encodeURIComponent(code)}&select=email,display_name,full_name&limit=1`,
    ),
    { headers: svc() },
  );
  const rows = res.ok ? await res.json() : [];
  if (rows.length === 0) return null;
  return {
    email: String(rows[0].email),
    name: (rows[0].display_name ?? rows[0].full_name ?? null) as string | null,
  };
}

/**
 * Referral approval side effects, mirroring admin-requests' approve block
 * (keep in sync): the auth user must exist before anything says "just sign
 * in", because sign-in OTPs are sent with shouldCreateUser: false. Runs
 * BEFORE the account_requests row is written, so a failure here leaves
 * nothing half-approved — the person just tries again.
 */
async function performReferralApprove(
  email: string,
  referrer: { email: string; name: string | null },
  code: string,
): Promise<string | null> {
  const userRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc(),
    body: JSON.stringify({ email, email_confirm: true }),
  });
  if (!userRes.ok && userRes.status !== 422) return 'Could not create the account';

  const insertRes = await fetch(rest('/community_members'), {
    method: 'POST',
    headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ email, note: `referred by ${referrer.email} (code ${code})` }),
  });
  if (!insertRes.ok && insertRes.status !== 409) return 'Could not create community membership';
  return null;
}

/** Welcome the referred builder + FYI the steward — both best-effort */
async function sendReferralEmails(
  email: string,
  name: string | null,
  referrer: { email: string; name: string | null },
  code: string,
  studioLabel: string | null,
): Promise<void> {
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return;
  const appUrl = Deno.env.get('APP_URL') ?? 'https://relationalbuilder.org';
  const steward = Deno.env.get('STEWARD_EMAIL') ?? 'josh@relationaltechproject.org';
  const referrerLabel = referrer.name ?? referrer.email;

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.org>',
      to: [email],
      subject: "You're in — welcome to Relational Builder",
      html: [
        `<p>Hi${name ? ' ' + esc(name) : ''},</p>`,
        `<p>Your Relational Builder account is ready — <strong>${esc(referrerLabel)}</strong>'s invite code vouched for you, so there was no waiting. Free community building is included: no API key, no credit card.</p>`,
        ...(studioLabel
          ? [`<p>You came in through <strong>${esc(studioLabel)}</strong> — when you sign in, your request to join the studio will already be with its stewards.</p>`]
          : []),
        `<p><a href="${appUrl}">Open Relational Builder</a> and sign in with this email address (we'll send you a sign-in link — no password to remember).</p>`,
        `<p>Build something your neighborhood will love.</p>`,
      ].join('\n'),
    }),
  }).catch(() => {});

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.org>',
      to: [steward],
      subject: `New builder via referral: ${name ?? email}`,
      html: [
        `<p><strong>${esc(name ?? 'Someone')}</strong> (${esc(email)}) just joined with <strong>${esc(referrerLabel)}</strong>'s invite code (<code>${esc(code)}</code>) — no approval needed, their welcome email is on its way.</p>`,
        `<p style="font-size:13px;color:#93806F;">FYI only. Every referred join is in your <a href="${appUrl}">steward dashboard</a> under recent decisions.</p>`,
      ].join('\n'),
    }),
  }).catch(() => {});
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
    // Normalize the invite code hard (uppercase, alphanumeric only) so
    // "josh", " JOSH " and "j-o-s-h" all mean the same thing
    const rawReferral = String(body.referral_code ?? '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 12);
    const attemptedCode = rawReferral.length >= 3 ? rawReferral : null;
    const referrer = attemptedCode ? await referrerByCode(attemptedCode) : null;

    // Already a community member → just sign in
    const memberRes = await fetch(
      rest(`/community_members?email=eq.${encodeURIComponent(email)}&select=email`),
      { headers: svc() },
    );
    const members = memberRes.ok ? await memberRes.json() : [];
    if (members.length > 0) {
      return json({ ok: true, status: 'already-member' });
    }

    // Existing request → tell them where it stands, don't re-notify. One
    // exception: a valid invite code rescues a request still waiting in the
    // queue — the vouch arrived, no reason to keep them at the door.
    const existingRes = await fetch(
      rest(`/account_requests?email=eq.${encodeURIComponent(email)}&select=id,status,name,studio_label`),
      { headers: svc() },
    );
    const existing = existingRes.ok ? await existingRes.json() : [];
    if (existing.length > 0) {
      if (referrer && attemptedCode && existing[0].status === 'pending') {
        const failure = await performReferralApprove(email, referrer, attemptedCode);
        if (failure) return json({ error: failure }, 500);
        await fetch(
          rest(`/account_requests?id=eq.${encodeURIComponent(existing[0].id)}&status=eq.pending`),
          {
            method: 'PATCH',
            headers: svc(),
            body: JSON.stringify({
              status: 'approved',
              referral_code: attemptedCode,
              decided_at: new Date().toISOString(),
              decided_by: `referral code ${attemptedCode} (${referrer.email})`,
            }),
          },
        );
        await sendReferralEmails(
          email,
          name ?? existing[0].name ?? null,
          referrer,
          attemptedCode,
          studioLabel ?? existing[0].studio_label ?? null,
        );
        return json({ ok: true, status: 'approved', referral: 'accepted' });
      }
      return json({ ok: true, status: existing[0].status === 'approved' ? 'already-member' : 'pending' });
    }

    // A valid invite code approves on the spot: account + membership first
    // (so a failure leaves nothing half-done), then the request row lands
    // already-decided in the steward's history, then the emails go out.
    if (referrer && attemptedCode) {
      const failure = await performReferralApprove(email, referrer, attemptedCode);
      if (failure) return json({ error: failure }, 500);
      await fetch(rest('/account_requests'), {
        method: 'POST',
        headers: svc(),
        body: JSON.stringify({
          email, name, neighborhood, reason,
          studio_slug: studioSlug, studio_label: studioLabel,
          referral_code: attemptedCode,
          status: 'approved',
          decided_at: new Date().toISOString(),
          decided_by: `referral code ${attemptedCode} (${referrer.email})`,
        }),
      }).catch(() => {});
      await sendReferralEmails(email, name, referrer, attemptedCode, studioLabel);
      return json({ ok: true, status: 'approved', referral: 'accepted' });
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
            attemptedCode
              ? `<p><strong>Referral code:</strong> they entered <code>${esc(attemptedCode)}</code>, which didn't match any builder — so this request came to you the usual way.</p>`
              : '',
            reason ? `<p><strong>What they want to build:</strong><br>${esc(reason)}</p>` : '',
            `<div>${emailBtn(approveUrl, 'Approve', true)}${emailBtn(declineUrl, 'Decline', false)}</div>`,
            `<p style="font-size:13px;color:#93806F;">These links work without signing in and ask you to confirm before anything happens. They expire in ${RESPOND_TOKEN_DAYS} days — after that (or any time), decide in your <a href="${appUrl}">steward dashboard</a> (account menu → Account requests).</p>`,
          ].join('\n'),
        }),
      }).catch(() => {});
    }

    return json({ ok: true, status: 'pending', ...(attemptedCode ? { referral: 'unknown' } : {}) });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
