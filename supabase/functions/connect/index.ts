/**
 * Supabase Edge Function: connect — the Builder's relational layer.
 *
 * Builders who opt in (profiles.open_to_connecting) appear in a directory
 * other signed-in builders can see. Reaching each other is consent-first:
 *  - A cal_link is standing consent to be booked (shown as "Book a call")
 *  - Email is NEVER shown; allow_requests enables double-opt-in intros:
 *    A requests → B gets an email with accept/decline links → on accept,
 *    BOTH get one shared intro email (both on the To: line, reply-all ready).
 *
 * POST JSON (Authorization: Bearer <builder session>):
 *   {action:'directory'}                        → opted-in builders (no emails)
 *   {action:'request', to_id, message}          → send a connection request
 *   {action:'inbox'}                            → pending requests addressed to me
 *   {action:'respond', id, decision}            → answer one from inside the app
 * GET  ?token=...&do=accept|decline             → branded confirm page (no
 *   settling on GET — email scanners prefetch links; a real person clicks
 *   the button, which POSTs the form below)
 * POST ?token=...&do=... (form-urlencoded)      → settle + result page
 *
 * Email links go through the site domain (SITE_URL/connect/respond →
 * api/connect.ts proxy → here) because Supabase's gateway sanitizes
 * text/html GET responses on *.supabase.co — served directly, the pages
 * would render as raw source. Same x-rb-raw trick as the site function.
 *
 * Deploy: supabase functions deploy connect --no-verify-jwt
 * Secrets: RESEND_API_KEY (shared); SITE_URL optional override
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_REQUESTS_PER_DAY = 3;

function siteUrl(): string {
  return (Deno.env.get('SITE_URL') ?? 'https://relationalbuilder.org').replace(/\/$/, '');
}

function respondUrl(token: string, decision: 'accept' | 'decline'): string {
  return `${siteUrl()}/connect/respond?token=${token}&do=${decision}`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Branded pages (the app's clay palette: cream ground, ink text, coral) ──

/**
 * Render a page. When the request came through the api/connect proxy
 * (x-rb-raw), HTML ships disguised as text/x-rb-html so the *.supabase.co
 * gateway doesn't flatten it to plain text; the proxy restores the real
 * content type on our own domain.
 */
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
  <p class="foot">Consent-first introductions · <a href="${siteUrl()}">relationalbuilder.org</a></p>
</div></body></html>`;
  const disguise = req.headers.get('x-rb-raw') === '1';
  return new Response(html, {
    headers: {
      ...CORS,
      'Content-Type': disguise ? 'text/x-rb-html; charset=utf-8' : 'text/html; charset=utf-8',
    },
  });
}

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

// ── Email (Resend): plain text always, branded HTML alongside ──

async function sendEmail(
  to: string | string[],
  subject: string,
  text: string,
  html?: string,
): Promise<boolean> {
  const key = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!key) return false;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      from: 'Relational Builder <hello@relationalbuilder.org>',
      to: Array.isArray(to) ? to : [to],
      subject,
      text,
      ...(html ? { html } : {}),
    }),
  });
  return res.ok;
}

function emailShell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#F2E9DD;">
<div style="max-width:520px;margin:0 auto;padding:32px 20px;color:#49362B;font-family:system-ui,-apple-system,sans-serif;">
  <p style="font-family:Georgia,serif;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#93806F;margin:0 0 16px;">Relational Builder</p>
  <div style="background:#FBF7F1;border:1px solid #E2D3C1;border-radius:14px;padding:28px 26px;font-size:15px;line-height:1.65;">
    ${inner}
  </div>
  <p style="font-size:12px;color:#93806F;margin:18px 0 0;">Relational Builder · a project of the Relational Technology Project · <a href="https://relationalbuilder.org" style="color:#93806F;">relationalbuilder.org</a></p>
</div></body></html>`;
}

const emailBtn = (href: string, label: string, primary: boolean) =>
  `<a href="${href}" style="display:inline-block;margin:4px 10px 4px 0;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;${
    primary
      ? 'background:#C0532F;color:#FFF7EF;'
      : 'border:1.5px solid #C9B29B;color:#49362B;'
  }">${label}</a>`;

interface ConnectionRow {
  id: string;
  from_email: string;
  from_name: string | null;
  to_email: string;
  message: string | null;
  status: string;
}

async function displayNameFor(email: string): Promise<string | null> {
  const res = await fetch(
    rest(`/profiles?email=eq.${encodeURIComponent(email)}&select=display_name`),
    { headers: svc() },
  );
  const rows = res.ok ? await res.json() : [];
  return rows[0]?.display_name ?? null;
}

/**
 * Both parties said yes → ONE intro email with both on the To: line, so
 * each sees the other in the recipient list and reply-all just works.
 */
async function sendIntroEmails(r: ConnectionRow): Promise<void> {
  const fromName = r.from_name || r.from_email;
  const toName = (await displayNameFor(r.to_email)) || r.to_email;
  const text = [
    `You're connected! ${fromName} (${r.from_email}) and ${toName} (${r.to_email}) both said yes to an introduction through Relational Builder.`,
    '',
    r.message ? `The note that started it: "${r.message}"` : '',
    '',
    "You're both on this email — just hit reply-all and take it from here. Build something good together.",
    '',
    '— Relational Builder, a project of the Relational Technology Project',
  ].filter(l => l !== undefined).join('\n');
  const html = emailShell(
    [
      `<h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 12px;">You're connected 🤝</h1>`,
      `<p style="margin:0 0 12px;"><strong>${esc(fromName)}</strong> (${esc(r.from_email)}) and <strong>${esc(toName)}</strong> (${esc(r.to_email)}) both said yes to an introduction through Relational Builder.</p>`,
      r.message
        ? `<p style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #C0532F;background:#F4EBE0;border-radius:0 8px 8px 0;font-style:italic;">"${esc(r.message)}"</p>`
        : '',
      `<p style="margin:0;">You're both on this email — just hit <strong>reply-all</strong> and take it from here. Build something good together.</p>`,
    ].join(''),
  );
  await sendEmail(
    [r.from_email, r.to_email],
    `Intro: ${fromName} & ${toName} are connected`,
    text,
    html,
  );
}

async function settleRequest(r: ConnectionRow, decision: 'accept' | 'decline'): Promise<void> {
  await fetch(rest(`/connection_requests?id=eq.${r.id}`), {
    method: 'PATCH',
    headers: svc(),
    body: JSON.stringify({
      status: decision === 'accept' ? 'accepted' : 'declined',
      responded_at: new Date().toISOString(),
    }),
  });
  if (decision === 'accept') await sendIntroEmails(r);
}

async function loadByToken(token: string): Promise<ConnectionRow | null> {
  const res = await fetch(
    rest(`/connection_requests?token=eq.${encodeURIComponent(token)}&select=*`),
    { headers: svc() },
  );
  const rows = res.ok ? await res.json() : [];
  return (rows[0] as ConnectionRow) ?? null;
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

/** The email-link flow: GET confirms, POST (the confirm button) settles. */
async function handleEmailFlow(req: Request, token: string, decision: 'accept' | 'decline'): Promise<Response> {
  const r = await loadByToken(token);
  if (!r) {
    return page(req, 'Not found', '<p>This connection request doesn\'t exist anymore — it may have been withdrawn.</p>');
  }
  if (r.status !== 'pending') {
    return r.status === 'accepted'
      ? page(req, 'Already connected', '<p>You already said yes — the intro email with both your addresses is in your inboxes. Reply-all there and take it from wherever it left off.</p>')
      : page(req, 'Already answered', '<p>You already declined this request, quietly — nothing was shared, and nothing more to do.</p>');
  }

  const fromName = esc(r.from_name || 'A builder');

  if (req.method === 'GET') {
    // Confirm, don't settle: scanners prefetch GETs; people click buttons.
    if (decision === 'accept') {
      return page(
        req,
        `Connect with ${fromName}?`,
        [
          r.message ? `<blockquote>"${esc(r.message)}"</blockquote>` : '',
          `<p>Saying yes sends <strong>one intro email to you both</strong> with each other's addresses — reply-all and you're talking. Nothing is shared until you confirm.</p>`,
          `<form method="POST"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="do" value="accept"><button class="btn" type="submit">Yes, introduce us</button></form>`,
          `<form method="POST"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="do" value="decline"><button class="btn quiet" type="submit">No thanks</button></form>`,
        ].join('\n'),
      );
    }
    return page(
      req,
      'Decline quietly?',
      [
        `<p>No intro will be made, nothing about you is shared, and ${fromName} won't be notified.</p>`,
        `<form method="POST"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="do" value="decline"><button class="btn" type="submit">Decline quietly</button></form>`,
        `<form method="POST"><input type="hidden" name="token" value="${esc(token)}"><input type="hidden" name="do" value="accept"><button class="btn quiet" type="submit">Actually — introduce us</button></form>`,
      ].join('\n'),
    );
  }

  // POST: a real person pressed the button
  await settleRequest(r, decision);
  if (decision === 'decline') {
    return page(req, 'Declined, quietly', `<p>No intro will be made, and ${fromName} won't be notified. Thanks for taking a look.</p>`);
  }
  return page(
    req,
    "You're connected 🤝",
    `<p>One intro email just went out <strong>to you both</strong> — you're each on the To: line. Open it, hit reply-all, and take it from there.</p>`,
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    const url = new URL(req.url);

    // ---- Accept / decline links from the email ----
    if (req.method === 'GET') {
      const token = url.searchParams.get('token') ?? '';
      const decision = url.searchParams.get('do') ?? '';
      if (!token || !['accept', 'decline'].includes(decision)) {
        return page(req, 'Hmm', '<p>This link is incomplete — try the buttons in the email again.</p>');
      }
      return handleEmailFlow(req, token, decision as 'accept' | 'decline');
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    // The confirm page's button posts a form (not JSON) — settle it here
    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      const token = String(form.get('token') ?? url.searchParams.get('token') ?? '');
      const decision = String(form.get('do') ?? url.searchParams.get('do') ?? '');
      if (!token || !['accept', 'decline'].includes(decision)) {
        return page(req, 'Hmm', '<p>Something was missing from that form — try the link in the email again.</p>');
      }
      return handleEmailFlow(req, token, decision as 'accept' | 'decline');
    }

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

    // Pending requests addressed to me — what the email carried and nothing
    // more (from_name + note; the sender's address stays private until accept)
    if (action === 'inbox') {
      const res = await fetch(
        rest(`/connection_requests?to_email=eq.${encodeURIComponent(user.email)}&status=eq.pending&select=id,from_name,message,created_at&order=created_at.desc`),
        { headers: svc() },
      );
      return json({ requests: res.ok ? await res.json() : [] });
    }

    // Answer a request from inside the app — same consent flow as the email
    // links, gated to the addressee's own session
    if (action === 'respond') {
      const id = String(body.id ?? '');
      const decision = String(body.decision ?? '');
      if (!id || !['accept', 'decline'].includes(decision)) {
        return json({ error: 'Bad request' }, 400);
      }
      const rowsRes = await fetch(
        rest(`/connection_requests?id=eq.${encodeURIComponent(id)}&select=*`),
        { headers: svc() },
      );
      const rows = rowsRes.ok ? await rowsRes.json() : [];
      const r = rows[0] as ConnectionRow | undefined;
      if (!r || r.to_email.toLowerCase() !== user.email) return json({ error: 'Not found' }, 404);
      if (r.status !== 'pending') return json({ error: 'Already answered' }, 409);
      await settleRequest(r, decision as 'accept' | 'decline');
      return json({ ok: true });
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

      const place = fromProfile.neighborhood ? ` in ${fromProfile.neighborhood}` : '';
      const acceptUrl = respondUrl(token, 'accept');
      const declineUrl = respondUrl(token, 'decline');
      const greeting = `Hi${target.display_name ? ` ${target.display_name}` : ''},`;
      const sent = await sendEmail(
        String(target.email),
        `${fromName} would like to connect with you`,
        [
          greeting,
          '',
          `${fromName}, a builder${place}, would like to connect with you through Relational Builder.`,
          message ? `\nTheir note: "${message}"\n` : '',
          'If you say yes, you BOTH get one intro email with each other\'s addresses — nothing is shared until then. If you decline, nothing is shared and they are not notified.',
          '',
          `Yes, introduce us: ${acceptUrl}`,
          `No thanks (quietly): ${declineUrl}`,
          '',
          '— Relational Builder, a project of the Relational Technology Project',
        ].join('\n'),
        emailShell(
          [
            `<p style="margin:0 0 12px;">${esc(greeting)}</p>`,
            `<p style="margin:0 0 12px;"><strong>${esc(fromName)}</strong>, a builder${esc(place)}, would like to connect with you through Relational Builder.</p>`,
            message
              ? `<p style="margin:0 0 12px;padding:10px 14px;border-left:3px solid #C0532F;background:#F4EBE0;border-radius:0 8px 8px 0;font-style:italic;">"${esc(message)}"</p>`
              : '',
            `<p style="margin:0 0 18px;">If you say yes, you <strong>both</strong> get one intro email with each other's addresses — nothing is shared until then. If you decline, nothing is shared and they aren't notified.</p>`,
            `<div>${emailBtn(acceptUrl, 'Yes, introduce us', true)}${emailBtn(declineUrl, 'No thanks', false)}</div>`,
          ].join(''),
        ),
      );
      if (!sent) return json({ error: 'Could not deliver the request email' }, 502);

      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
