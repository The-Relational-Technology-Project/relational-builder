/**
 * Supabase Edge Function: steward-respond — one-click account-request
 * decisions from the steward's alert email, no sign-in required.
 *
 * The request-account email carries approve/decline links with an opaque
 * token; only the token's SHA-256 hash is stored (account_requests.
 * respond_token_hash), so the working link exists nowhere but the steward's
 * inbox. The token authorizes exactly one decision on exactly one request —
 * it grants no session, no dashboard access, and cannot touch roles.
 *
 * GET  ?token=...&do=approve|decline → branded confirm page (no settling on
 *   GET — email scanners prefetch links; a real person clicks the button,
 *   which POSTs the form)
 * POST ?token=...&do=... (form-urlencoded) → settle + result page
 *
 * Settling claims the row atomically (PATCH filtered on status=pending), so
 * a double-tap or a re-used link lands on "already decided" instead of
 * re-running. Approve then mirrors admin-requests: create the auth user
 * (422 = exists = fine), insert community_members, send the welcome email.
 * Keep that side-effect block in sync with admin-requests.
 *
 * Links go through SITE_URL/steward/respond → api/steward-respond.ts →
 * here, because Supabase's gateway sanitizes text/html GET responses on
 * *.supabase.co (same x-rb-raw trick as connect).
 *
 * Deploy: supabase functions deploy steward-respond --no-verify-jwt
 * Secrets: RESEND_API_KEY, STEWARD_EMAIL, APP_URL, SITE_URL (all shared)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function siteUrl(): string {
  return (Deno.env.get('SITE_URL') ?? 'https://relationalbuilder.org').replace(/\/$/, '');
}

function appUrl(): string {
  return Deno.env.get('APP_URL') ?? 'https://relational-builder.vercel.app';
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── Branded pages (clay palette, same shell as connect) ──

function page(req: Request, title: string, bodyHtml: string): Response {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)} · Relational Builder</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&display=swap" rel="stylesheet">
<style>
  body{margin:0;background:#F2E9DD;color:#49362B;font:16px/1.65 system-ui,-apple-system,sans-serif;
       display:grid;place-items:center;min-height:100vh;padding:24px;box-sizing:border-box}
  .card{max-width:440px;background:#FBF7F1;border:1px solid #E2D3C1;border-radius:16px;
        padding:36px 32px;box-shadow:0 2px 12px rgba(73,54,43,.06)}
  h1{font-family:'Fraunces',Georgia,serif;font-weight:600;font-size:26px;margin:0 0 12px;letter-spacing:-.01em}
  p{margin:0 0 14px;color:#5C4638}
  blockquote{margin:0 0 14px;padding:10px 14px;border-left:3px solid #C0532F;background:#F4EBE0;
             border-radius:0 8px 8px 0;font-style:italic;color:#5C4638}
  .btn{display:inline-block;border:0;cursor:pointer;padding:12px 24px;border-radius:10px;
       font:600 15px system-ui,-apple-system,sans-serif;background:#C0532F;color:#FFF7EF;text-decoration:none}
  .btn.quiet{background:transparent;border:1.5px solid #C9B29B;color:#49362B}
  form{display:inline-block;margin:6px 8px 0 0}
  .foot{font-size:12px;color:#93806F;margin-top:26px}
  .foot a{color:#93806F}
  .mark{font-family:'Fraunces',Georgia,serif;font-size:13px;letter-spacing:.08em;color:#93806F;
        text-transform:uppercase;margin:0 0 18px}
</style></head><body>
<div class="card">
  <p class="mark">Relational Builder</p>
  <h1>${esc(title)}</h1>
  ${bodyHtml}
  <p class="foot">Steward decisions · <a href="${appUrl()}">open the dashboard</a></p>
</div></body></html>`;
  const disguise = req.headers.get('x-rb-raw') === '1';
  return new Response(html, {
    headers: {
      ...CORS,
      'Content-Type': disguise ? 'text/x-rb-html; charset=utf-8' : 'text/html; charset=utf-8',
    },
  });
}

interface AccountRequestRow {
  id: string;
  email: string;
  name: string | null;
  neighborhood: string | null;
  reason: string | null;
  status: string;
  studio_label: string | null;
  respond_token_expires_at: string | null;
}

async function loadByToken(token: string): Promise<AccountRequestRow | null> {
  const hash = await sha256Hex(token);
  const res = await fetch(
    rest(`/account_requests?respond_token_hash=eq.${encodeURIComponent(hash)}&select=*`),
    { headers: svc() },
  );
  const rows = res.ok ? await res.json() : [];
  return (rows[0] as AccountRequestRow) ?? null;
}

/**
 * Approve side effects, mirroring admin-requests (keep in sync): the auth
 * user must exist before the welcome email says "just sign in", because
 * sign-in OTPs are sent with shouldCreateUser: false.
 */
async function performApprove(r: AccountRequestRow): Promise<string | null> {
  const userRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc(),
    body: JSON.stringify({ email: r.email, email_confirm: true }),
  });
  if (!userRes.ok && userRes.status !== 422) return 'Could not create the account';

  const insertRes = await fetch(rest('/community_members'), {
    method: 'POST',
    headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({ email: r.email, note: 'approved via email link' }),
  });
  if (!insertRes.ok && insertRes.status !== 409) return 'Could not create community membership';

  // Welcome email — best-effort
  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (resendKey) {
    let studioLine = '';
    try {
      const importRes = await fetch(
        rest(
          `/studio_imports?email=eq.${encodeURIComponent(r.email.toLowerCase())}` +
            '&claimed_at=is.null&declined_at=is.null&select=id&limit=1',
        ),
        { headers: svc() },
      );
      const importRows = importRes.ok ? await importRes.json() : [];
      if (importRows.length > 0) {
        studioLine =
          `<p>We see you have a Studio account — you'll be able to bring your ` +
          `profile and project info into Relational Builder during onboarding.</p>`;
      }
    } catch {
      // best-effort: the welcome email goes out either way
    }
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Relational Builder <hello@relationalbuilder.org>',
        to: [r.email],
        subject: "You're in — welcome to Relational Builder",
        html: [
          `<p>Hi${r.name ? ' ' + esc(r.name) : ''},</p>`,
          `<p>Your Relational Builder account is ready. Free community building is included — no API key, no credit card.</p>`,
          ...(r.studio_label
            ? [`<p>You came in through <strong>${esc(String(r.studio_label))}</strong> — when you sign in, your request to join the studio will already be with its stewards.</p>`]
            : []),
          ...(studioLine ? [studioLine] : []),
          `<p><a href="${appUrl()}">Open Relational Builder</a> and sign in with this email address (we'll send you a sign-in link — no password to remember).</p>`,
          `<p>Build something your neighborhood will love.</p>`,
        ].join('\n'),
      }),
    }).catch(() => {});
  }
  return null;
}

function decidedPage(req: Request, r: AccountRequestRow): Response {
  return r.status === 'approved'
    ? page(req, 'Already approved', `<p><strong>${esc(r.name ?? r.email)}</strong> is already in — their welcome email went out when the request was first approved. Nothing more to do.</p>`)
    : page(req, 'Already declined', `<p>This request was already declined. If you've changed your mind, handle it from the <a href="${appUrl()}">steward dashboard</a>.</p>`);
}

async function handleRespond(
  req: Request,
  token: string,
  decision: 'approve' | 'decline',
): Promise<Response> {
  const r = await loadByToken(token);
  if (!r) {
    return page(req, 'Not found', `<p>This link doesn't match any account request — it may have been removed. The <a href="${appUrl()}">steward dashboard</a> has the live list.</p>`);
  }
  if (r.status !== 'pending') return decidedPage(req, r);
  const expires = r.respond_token_expires_at ? Date.parse(r.respond_token_expires_at) : 0;
  if (!expires || expires < Date.now()) {
    return page(req, 'Link expired', `<p>Email links stay live for a week; this one has lapsed. The request is still waiting in your <a href="${appUrl()}">steward dashboard</a> (account menu → Account requests).</p>`);
  }

  const who = esc(r.name ?? 'Someone');

  if (req.method === 'GET') {
    // Confirm, don't settle: scanners prefetch GETs; people click buttons.
    const details = [
      `<p><strong>${who}</strong> (${esc(r.email)}) asked for a Relational Builder account.</p>`,
      r.studio_label ? `<p><strong>Arrived through:</strong> ${esc(r.studio_label)}</p>` : '',
      r.neighborhood ? `<p><strong>Neighborhood:</strong> ${esc(r.neighborhood)}</p>` : '',
      r.reason ? `<blockquote>"${esc(r.reason)}"</blockquote>` : '',
    ].join('\n');
    const form = (d: 'approve' | 'decline', primary: boolean) =>
      `<form method="POST"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="do" value="${d}"><button class="btn${primary ? '' : ' quiet'}" type="submit">${d === 'approve' ? 'Approve — sends their welcome email' : 'Decline'}</button></form>`;
    const forms = (primary: 'approve' | 'decline') =>
      primary === 'approve'
        ? `${form('approve', true)}\n${form('decline', false)}`
        : `${form('decline', true)}\n${form('approve', false)}`;
    return decision === 'approve'
      ? page(req, `Approve ${who}?`, `${details}\n<p>Approving creates their account and sends the welcome email with sign-in instructions. Nothing happens until you confirm.</p>\n${forms('approve')}`)
      : page(req, `Decline ${who}?`, `${details}\n<p>Declining is quiet — no email goes out. You can still approve them later from the dashboard. Nothing happens until you confirm.</p>\n${forms('decline')}`);
  }

  // POST: a real person pressed the button. Claim the row atomically so a
  // double-tap (or both links clicked) can't settle twice.
  const steward = Deno.env.get('STEWARD_EMAIL') ?? 'josh@relationaltechproject.org';
  const claimRes = await fetch(
    rest(`/account_requests?id=eq.${encodeURIComponent(r.id)}&status=eq.pending`),
    {
      method: 'PATCH',
      headers: { ...svc(), Prefer: 'return=representation' },
      body: JSON.stringify({
        status: decision === 'approve' ? 'approved' : 'declined',
        decided_at: new Date().toISOString(),
        decided_by: `email link (${steward})`,
      }),
    },
  );
  const claimed = claimRes.ok ? await claimRes.json() : [];
  if (claimed.length === 0) {
    const fresh = await loadByToken(token);
    return fresh && fresh.status !== 'pending'
      ? decidedPage(req, fresh)
      : page(req, 'Hmm', `<p>That didn't go through — try again, or decide from the <a href="${appUrl()}">steward dashboard</a>.</p>`);
  }

  if (decision === 'decline') {
    return page(req, 'Declined, quietly', `<p>No email went out to ${esc(r.email)}. If you change your mind, the request is in your <a href="${appUrl()}">steward dashboard</a> under decided requests.</p>`);
  }

  const failure = await performApprove(r);
  if (failure) {
    return page(req, 'Almost', `<p>The request is marked approved, but a step failed: ${esc(failure)}.</p><p>Open the <a href="${appUrl()}">steward dashboard</a> and hit Approve there — it safely re-runs account creation and the welcome email.</p>`);
  }
  return page(req, `${who} is in 🎉`, `<p>Their account is ready and the welcome email with sign-in instructions is on its way to ${esc(r.email)}.</p>`);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);
    let token = url.searchParams.get('token') ?? '';
    let decision = url.searchParams.get('do') ?? '';

    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') ?? '';
      if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = await req.formData();
        token = String(form.get('token') ?? token);
        decision = String(form.get('do') ?? decision);
      }
    } else if (req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    if (!/^[0-9a-f]{64}$/.test(token) || !['approve', 'decline'].includes(decision)) {
      return page(req, 'Hmm', '<p>This link is incomplete — try the buttons in the email again.</p>');
    }
    return handleRespond(req, token, decision as 'approve' | 'decline');
  } catch (err) {
    return page(
      req,
      'Something broke',
      `<p>${esc(err instanceof Error ? err.message : 'Internal error')}</p><p>The request is untouched — decide from the <a href="${appUrl()}">steward dashboard</a>.</p>`,
    );
  }
});
