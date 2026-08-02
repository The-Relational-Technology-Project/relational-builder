/**
 * Supabase Edge Function: notify-invite
 *
 * Sends a branded email (via Resend, from relationalbuilder.org) when someone
 * is invited to collaborate on a project. Fire-and-forget from the client —
 * the invite itself is already created via RLS-protected insert; this only
 * handles the notification. No-ops with 503 until RESEND_API_KEY is set.
 *
 * Auth: requires a valid Builder session token (any signed-in user), which
 * keeps this from being an open relay. Per-user daily send cap as backstop.
 *
 * The button carries ?invite=<project_id>&to=<invited email>, which is what
 * lets the app say something useful on arrival — open the project when the
 * addresses match, and name both of them when they don't. Without it the link
 * was a bare origin and a mismatched account had no way to even learn an
 * invitation existed.
 *
 * Deploy:
 *   supabase functions deploy notify-invite --no-verify-jwt
 * Secrets:
 *   RESEND_API_KEY   — Resend key for the relationalbuilder.org domain
 *   APP_URL          — link target (default https://relationalbuilder.org)
 *   ACCESS_CODE      — pilot passcode to include in the email (optional)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_SENDS_PER_USER_PER_DAY = 20;
const sendCounts = new Map<string, { day: string; count: number }>();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return json({ error: 'Email notifications not configured' }, 503);

  try {
    // Verify the caller is a signed-in Builder user
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in required' }, 401);
    const user = await userRes.json();
    const inviterEmail = String(user.email ?? '');
    if (!inviterEmail) return json({ error: 'Sign in required' }, 401);

    // Backstop against runaway sends
    const today = new Date().toISOString().slice(0, 10);
    const bucket = sendCounts.get(inviterEmail);
    if (bucket && bucket.day === today && bucket.count >= MAX_SENDS_PER_USER_PER_DAY) {
      return json({ error: 'Daily invite email limit reached' }, 429);
    }
    sendCounts.set(inviterEmail, {
      day: today,
      count: bucket?.day === today ? bucket.count + 1 : 1,
    });

    const { invitee_email, project_name, project_id: rawProjectId, note: rawNote } = await req.json();
    if (!invitee_email || typeof invitee_email !== 'string' || !invitee_email.includes('@')) {
      return json({ error: 'invitee_email required' }, 400);
    }
    const projectName = String(project_name ?? 'a project').slice(0, 120);
    // The project this invite is for. Only a real uuid rides along — this
    // ends up in a URL, so it gets the same treatment as any other input.
    const projectId =
      typeof rawProjectId === 'string' &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawProjectId)
        ? rawProjectId
        : null;
    // The sender's own words about why they're inviting. Escaped into the
    // template like any other untrusted string — it is typed by a person and
    // lands in someone else's inbox.
    const note = typeof rawNote === 'string' ? rawNote.trim().slice(0, 400) : '';

    const appUrl = (Deno.env.get('APP_URL') ?? 'https://relationalbuilder.org').replace(/\/$/, '');
    const accessCode = Deno.env.get('ACCESS_CODE') ?? '';

    // The link says which project, and which address the invite was sent to.
    // Without both, the button was a bare origin: whoever clicked it landed in
    // whatever account their browser was already signed into, with nothing to
    // see and no way to tell that an invite existed at all.
    const inviteUrl = projectId
      ? `${appUrl}/?invite=${projectId}&to=${encodeURIComponent(invitee_email)}`
      : appUrl;

    const html = renderInviteEmail({
      inviterEmail,
      projectName,
      inviteUrl,
      inviteeEmail: invitee_email,
      accessCode,
      note,
    });

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Relational Builder <invites@relationalbuilder.org>',
        to: [invitee_email],
        reply_to: inviterEmail,
        subject: `${inviterEmail} invited you to build "${projectName}" together`,
        html,
      }),
    });

    if (!sendRes.ok) {
      const detail = await sendRes.text().catch(() => '');
      return json({ error: `Email send failed: ${detail.slice(0, 200)}` }, 502);
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});

function renderInviteEmail(opts: {
  inviterEmail: string;
  projectName: string;
  inviteUrl: string;
  inviteeEmail: string;
  accessCode: string;
  note: string;
}): string {
  const { inviterEmail, projectName, inviteUrl, inviteeEmail, accessCode, note } = opts;
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F5F5F4;font-family:Georgia,'Times New Roman',serif;color:#292524;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#FFFFFF;border-radius:14px;padding:36px 32px;border:1px solid #E7E5E4;">
        <div style="font-size:28px;line-height:1;margin-bottom:20px;">
          <span style="color:#E86F4E;">&#9679;</span><span style="color:#3D8B6D;">&#9679;</span><span style="color:#E8B84E;">&#9679;</span>
        </div>
        <h1 style="font-size:22px;font-weight:600;margin:0 0 14px;">You're invited to build together</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 8px;">
          <strong>${escapeHtml(inviterEmail)}</strong> invited you to collaborate on
          <strong>&ldquo;${escapeHtml(projectName)}&rdquo;</strong> in Relational Builder &mdash;
          an open-source tool for building neighborhood technology together.
        </p>
        ${note ? `<blockquote style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #E86F4E;background:#FDF6F3;font-size:15px;line-height:1.6;font-style:italic;">${escapeHtml(note)}</blockquote>` : ''}
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
          The invitation is for <strong>${escapeHtml(inviteeEmail)}</strong> &mdash; sign in
          with that address and the project will be waiting for you. You'll be able to make
          changes and chat with the builder, the same as they can. If you'd rather use a
          different address, open the link and you can ask for it there.
        </p>
        <a href="${inviteUrl}" style="display:inline-block;background:#292524;color:#FAFAF9;text-decoration:none;font-size:15px;padding:12px 22px;border-radius:8px;">
          Open the project
        </a>
        ${accessCode ? `<p style="font-size:13px;color:#78716C;margin:20px 0 0;">Pilot passcode: <strong style="letter-spacing:0.15em;">${escapeHtml(accessCode)}</strong></p>` : ''}
      </div>
      <p style="font-size:12px;color:#A8A29E;text-align:center;margin:20px 0 0;line-height:1.6;">
        Sent by Relational Builder, a project of
        <a href="https://relationaltechproject.org" style="color:#A8A29E;">The Relational Technology Project</a>.<br/>
        Someone you know entered your email &mdash; if this isn't for you, it's safe to ignore.
      </p>
    </div>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
