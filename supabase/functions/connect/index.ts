/**
 * Supabase Edge Function: connect — the Builder's relational layer.
 *
 * Builders who opt in (profiles.open_to_connecting) appear in a directory
 * other signed-in builders can see. Reaching each other is consent-first:
 *  - A cal_link is standing consent to be booked (shown as "Book a call")
 *  - Email is NEVER shown; allow_requests enables double-opt-in intros:
 *    A requests → B gets an email with accept/decline links → on accept,
 *    BOTH get an intro email with each other's addresses.
 *
 * POST JSON (Authorization: Bearer <builder session>):
 *   {action:'directory'}                        → opted-in builders (no emails)
 *   {action:'request', to_id, message}          → send a connection request
 * GET ?token=...&do=accept|decline              → B's response (from email links)
 *
 * Deploy: supabase functions deploy connect --no-verify-jwt
 * Secrets: RESEND_API_KEY (shared)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_REQUESTS_PER_DAY = 3;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function page(title: string, message: string): Response {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<body style="font-family:system-ui,sans-serif;background:#FAF6F0;color:#2B2320;display:grid;place-items:center;min-height:100vh;margin:0">
<div style="max-width:420px;padding:32px;text-align:center">
<h1 style="font-size:22px">${title}</h1>
<p style="line-height:1.6;color:#6B5D54">${message}</p>
<p style="font-size:12px;color:#6B5D54;margin-top:24px">Relational Builder · relationalbuilder.xyz</p>
</div></body>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.xyz>',
      to: [to],
      subject,
      text,
    }),
  });
  return res.ok;
}

async function currentUser(req: Request): Promise<{ email: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const userRes = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return null;
  const user = await userRes.json();
  return user.email ? { email: String(user.email).toLowerCase() } : null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    // ---- Accept / decline links from the email ----
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const token = url.searchParams.get('token') ?? '';
      const decision = url.searchParams.get('do') ?? '';
      if (!token || !['accept', 'decline'].includes(decision)) {
        return page('Hmm', 'This link is incomplete — try the buttons in the email again.');
      }
      const reqRes = await fetch(
        rest(`/connection_requests?token=eq.${encodeURIComponent(token)}&select=*`),
        { headers: svc() },
      );
      const rows = reqRes.ok ? await reqRes.json() : [];
      if (!rows.length) return page('Not found', 'This connection request does not exist anymore.');
      const r = rows[0];
      if (r.status !== 'pending') {
        return page('Already answered', `You already ${r.status} this request — nothing more to do.`);
      }

      await fetch(rest(`/connection_requests?id=eq.${r.id}`), {
        method: 'PATCH',
        headers: svc(),
        body: JSON.stringify({ status: decision === 'accept' ? 'accepted' : 'declined', responded_at: new Date().toISOString() }),
      });

      if (decision === 'decline') {
        return page('Declined, quietly', 'No intro will be made, and they will not be notified. Thanks for taking a look.');
      }

      // Accepted → intro email to both, revealing addresses to each other
      const fromName = r.from_name || r.from_email;
      const intro = [
        `You're connected! ${fromName} (${r.from_email}) and ${r.to_email} both said yes to an introduction through Relational Builder.`,
        '',
        r.message ? `The note that started it: "${r.message}"` : '',
        '',
        'This email goes to you both — just hit reply-all and take it from here. Build something good together.',
        '',
        '— Relational Builder, a project of the Relational Technology Project',
      ].filter(l => l !== undefined).join('\n');
      await sendEmail(r.from_email, `Intro: you and ${r.to_email} are connected`, intro);
      await sendEmail(r.to_email, `Intro: you and ${fromName} are connected`, intro);

      return page('Connected!', 'An intro email with both your addresses is on its way to each of you. Reply and take it from there.');
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const body = await req.json();
    const action = String(body.action ?? '');

    const user = await currentUser(req);
    if (!user) return json({ error: 'Sign in first' }, 401);

    if (action === 'directory') {
      const res = await fetch(
        rest(`/profiles?open_to_connecting=eq.true&select=id,display_name,neighborhood,connect_note,cal_link,allow_requests,email`),
        { headers: svc() },
      );
      const rows = res.ok ? await res.json() : [];
      const visible = rows.filter((p: { email: string }) => p.email.toLowerCase() !== user.email);

      // Prompts travel with profiles: attach each builder's shared prompts
      // (title + slug only — already public by their own choice to share)
      const promptsByOwner = new Map<string, { title: string; slug: string }[]>();
      if (visible.length > 0) {
        const ids = visible.map((p: { id: string }) => p.id).join(',');
        const promptsRes = await fetch(
          rest(`/prompts?owner_id=in.(${ids})&is_shared=eq.true&share_slug=not.is.null&select=owner_id,title,share_slug&order=updated_at.desc&limit=60`),
          { headers: svc() },
        );
        const shared = promptsRes.ok ? await promptsRes.json() : [];
        for (const p of shared as { owner_id: string; title: string; share_slug: string }[]) {
          const mine = promptsByOwner.get(p.owner_id) ?? [];
          if (mine.length < 2) {
            mine.push({ title: p.title, slug: p.share_slug });
            promptsByOwner.set(p.owner_id, mine);
          }
        }
      }

      const builders = visible.map((p: Record<string, unknown>) => ({
        id: p.id,
        name: p.display_name || 'A builder',
        neighborhood: p.neighborhood ?? null,
        note: p.connect_note ?? null,
        cal_link: p.cal_link ?? null,
        allow_requests: Boolean(p.allow_requests),
        prompts: promptsByOwner.get(String(p.id)) ?? [],
        // email deliberately omitted
      }));
      return json({ builders });
    }

    if (action === 'request') {
      const toId = String(body.to_id ?? '');
      const message = String(body.message ?? '').trim().slice(0, 500);
      if (!toId) return json({ error: 'Who do you want to connect with?' }, 400);

      // Rate limit the requester
      const dayAgo = new Date(Date.now() - 86400_000).toISOString();
      const recentRes = await fetch(
        rest(`/connection_requests?from_email=eq.${encodeURIComponent(user.email)}&created_at=gte.${encodeURIComponent(dayAgo)}&select=id`),
        { headers: svc() },
      );
      const recent = recentRes.ok ? await recentRes.json() : [];
      if (recent.length >= MAX_REQUESTS_PER_DAY) {
        return json({ error: 'You have sent a few requests today already — give them a day to land' }, 429);
      }

      const toRes = await fetch(
        rest(`/profiles?id=eq.${encodeURIComponent(toId)}&open_to_connecting=eq.true&allow_requests=eq.true&select=email,display_name`),
        { headers: svc() },
      );
      const targets = toRes.ok ? await toRes.json() : [];
      if (!targets.length) return json({ error: 'That builder is not taking requests right now' }, 404);
      const target = targets[0];

      const fromRes = await fetch(
        rest(`/profiles?email=eq.${encodeURIComponent(user.email)}&select=display_name,neighborhood`),
        { headers: svc() },
      );
      const fromProfile = (fromRes.ok ? await fromRes.json() : [])[0] ?? {};
      const fromName = fromProfile.display_name || user.email.split('@')[0];

      const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      const insRes = await fetch(rest('/connection_requests'), {
        method: 'POST',
        headers: svc(),
        body: JSON.stringify({
          from_email: user.email,
          from_name: fromName,
          to_email: String(target.email).toLowerCase(),
          message: message || null,
          token,
        }),
      });
      if (!insRes.ok) return json({ error: 'Could not send the request' }, 500);

      const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/connect`;
      const place = fromProfile.neighborhood ? ` in ${fromProfile.neighborhood}` : '';
      const sent = await sendEmail(
        String(target.email),
        `${fromName} would like to connect with you`,
        [
          `Hi${target.display_name ? ` ${target.display_name}` : ''},`,
          '',
          `${fromName}, a builder${place}, would like to connect with you through Relational Builder.`,
          message ? `\nTheir note: "${message}"\n` : '',
          'If you say yes, you BOTH get an intro email with each other\'s addresses — nothing is shared until then. If you decline, nothing is shared and they are not notified.',
          '',
          `Yes, introduce us: ${base}?token=${token}&do=accept`,
          `No thanks (quietly): ${base}?token=${token}&do=decline`,
          '',
          '— Relational Builder, a project of the Relational Technology Project',
        ].join('\n'),
      );
      if (!sent) return json({ error: 'Could not deliver the request email' }, 502);

      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
