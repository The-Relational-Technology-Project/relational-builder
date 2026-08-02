/**
 * Supabase Edge Function: request-project-access
 *
 * "This invite was sent to my other address" — the way back in.
 *
 * Project membership is matched on the invited email, so an invitation sent
 * to one address is invisible to every other account a person has. That is
 * the correct security posture and a dead end for the human: the tool knows
 * an invite exists, knows who owns the project, and until now had no way to
 * put those two facts in front of anyone. This mails the project's owner and
 * asks them to invite the address the person actually uses.
 *
 * Deliberately not a grant. Nothing here changes membership — the owner still
 * decides, from the same Collaborate dialog they'd use anyway. It only carries
 * the ask, because the alternative is the invitee guessing at an email address
 * out of band.
 *
 * POST JSON: { project_id, requested_email?, invited_email?, message? }
 *   - Requires a signed-in Builder session (never an open relay)
 *   - Per-user daily cap; the owner's address is never revealed to the caller
 *   - Only mails the owner of a project that has a pending invite on it, so
 *     this can't be used to cold-mail arbitrary project owners
 *
 * Deploy: supabase functions deploy request-project-access --no-verify-jwt
 * Secrets:
 *   RESEND_API_KEY — Resend key for the relationalbuilder.org domain
 *   APP_URL        — link target (default https://relationalbuilder.org)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_SENDS_PER_USER_PER_DAY = 10;
const sendCounts = new Map<string, { day: string; count: number }>();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!resendKey) return json({ error: 'Email notifications not configured' }, 503);

  try {
    // The caller must be a signed-in Builder user
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in required' }, 401);
    const user = await userRes.json();
    const requesterEmail = String(user.email ?? '').trim().toLowerCase();
    if (!requesterEmail) return json({ error: 'Sign in required' }, 401);

    const today = new Date().toISOString().slice(0, 10);
    const bucket = sendCounts.get(requesterEmail);
    if (bucket && bucket.day === today && bucket.count >= MAX_SENDS_PER_USER_PER_DAY) {
      return json({ error: 'Daily request limit reached' }, 429);
    }

    const body = await req.json().catch(() => ({}));
    const projectId = String(body.project_id ?? '');
    if (!UUID_RE.test(projectId)) return json({ error: 'project_id required' }, 400);
    const invitedEmail = String(body.invited_email ?? '').trim().toLowerCase();
    const message = String(body.message ?? '').slice(0, 500).trim();

    // The invite this request is standing on. Requiring it means the caller
    // has to have been sent a real invitation for this project — otherwise
    // this would be a way to mail any project owner on the platform.
    if (!invitedEmail || !invitedEmail.includes('@')) {
      return json({ error: 'invited_email required' }, 400);
    }
    const memberRes = await fetch(
      rest(
        `/project_members?project_id=eq.${projectId}&email=eq.${encodeURIComponent(invitedEmail)}&select=email,user_id`,
      ),
      { headers: svc() },
    );
    const memberRows = memberRes.ok ? await memberRes.json() : [];
    if (memberRows.length === 0) {
      return json({ error: 'No invitation found for that address' }, 404);
    }

    // Project + owner
    const projRes = await fetch(
      rest(`/projects?id=eq.${projectId}&select=name,owner_id`),
      { headers: svc() },
    );
    const projRows = projRes.ok ? await projRes.json() : [];
    if (projRows.length === 0) return json({ error: 'Project not found' }, 404);
    const projectName = String(projRows[0].name ?? 'a project');
    const ownerId = String(projRows[0].owner_id ?? '');

    const ownerRes = await fetch(
      rest(`/profiles?id=eq.${ownerId}&select=email,display_name`),
      { headers: svc() },
    );
    const ownerRows = ownerRes.ok ? await ownerRes.json() : [];
    if (ownerRows.length === 0) return json({ error: 'Project owner not reachable' }, 404);
    const ownerEmail = String(ownerRows[0].email ?? '');
    if (!ownerEmail) return json({ error: 'Project owner not reachable' }, 404);

    // Already a member at the requesting address → nothing to ask for
    const already = await fetch(
      rest(
        `/project_members?project_id=eq.${projectId}&email=eq.${encodeURIComponent(requesterEmail)}&select=email`,
      ),
      { headers: svc() },
    );
    const alreadyRows = already.ok ? await already.json() : [];
    if (alreadyRows.length > 0) return json({ ok: true, status: 'already-member' });

    sendCounts.set(requesterEmail, {
      day: today,
      count: bucket?.day === today ? bucket.count + 1 : 1,
    });

    const appUrl = (Deno.env.get('APP_URL') ?? 'https://relationalbuilder.org').replace(/\/$/, '');

    const sendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Relational Builder <invites@relationalbuilder.org>',
        to: [ownerEmail],
        reply_to: requesterEmail,
        subject: `${requesterEmail} would like access to "${projectName}"`,
        html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#F5F5F4;font-family:Georgia,'Times New Roman',serif;color:#292524;">
    <div style="max-width:520px;margin:0 auto;padding:40px 24px;">
      <div style="background:#FFFFFF;border-radius:14px;padding:36px 32px;border:1px solid #E7E5E4;">
        <h1 style="font-size:20px;font-weight:600;margin:0 0 14px;">A different address, same person</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 14px;">
          You invited <strong>${escapeHtml(invitedEmail)}</strong> to
          <strong>&ldquo;${escapeHtml(projectName)}&rdquo;</strong>. They opened the link while
          signed in as <strong>${escapeHtml(requesterEmail)}</strong>, and would like to build
          from that account instead.
        </p>
        ${message ? `<blockquote style="margin:0 0 18px;padding:12px 16px;border-left:3px solid #E86F4E;background:#FDF6F3;font-size:15px;line-height:1.6;font-style:italic;">${escapeHtml(message)}</blockquote>` : ''}
        <p style="font-size:15px;line-height:1.6;margin:0 0 24px;">
          If that's right, open the project and invite
          <strong>${escapeHtml(requesterEmail)}</strong> from <em>Share &rarr; Collaborate</em>.
          Nothing has changed yet &mdash; only you can add someone.
        </p>
        <a href="${appUrl}" style="display:inline-block;background:#292524;color:#FAFAF9;text-decoration:none;font-size:15px;padding:12px 22px;border-radius:8px;">
          Open Relational Builder
        </a>
      </div>
      <p style="font-size:12px;color:#A8A29E;text-align:center;margin:20px 0 0;line-height:1.6;">
        Sent by Relational Builder, a project of
        <a href="https://relationaltechproject.org" style="color:#A8A29E;">The Relational Technology Project</a>.<br/>
        You're getting this because you invited someone to a project you own.
      </p>
    </div>
  </body>
</html>`,
      }),
    });

    if (!sendRes.ok) {
      const detail = await sendRes.text().catch(() => '');
      return json({ error: `Email send failed: ${detail.slice(0, 200)}` }, 502);
    }

    return json({ ok: true, status: 'sent' });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
