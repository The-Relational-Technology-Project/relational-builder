/**
 * Supabase Edge Function: site — serves Community Hosting sites.
 *
 * GET /site/{slug}/            → index.html
 * GET /site/{slug}/{filepath}  → that file with its content type
 * POST /site/{slug}/__feedback → a neighbor's note for the builder
 * POST /site/{slug}/__error    → a runtime error the page caught (beacon)
 * POST /site/{slug}/__unlock   → check a private site's passphrase
 *
 * Private sites: a site with a passphrase (set at publish time, stored as a
 * PBKDF2 hash by publish-site) serves a built-in unlock page instead of its
 * files until the visitor presents the passphrase. A correct guess sets a
 * signed cookie good for UNLOCK_DAYS; the signature covers the stored hash,
 * so changing or removing the passphrase signs everyone out. This is a
 * closed door, not a vault — but the passphrase itself never ships in page
 * source, and the files never leave the server for a visitor without it.
 * Gated responses are never cached (no-store).
 *
 * Views of index.html increment the site's daily counter (simple,
 * privacy-friendly analytics — no cookies, no per-visitor tracking).
 *
 * Every served index.html gets a small "leave a note" widget injected so
 * neighbors can respond to the tool without accounts — the notes appear in
 * the builder's dashboard. Sites can opt out with:
 *   <meta name="rb-feedback" content="off">
 *
 * It also gets a tiny error beacon: runtime errors and unhandled promise
 * rejections post back (messages only — nothing about the visitor), land
 * deduplicated in site_errors, and surface as site health on the builder's
 * dashboard. Opt out with:
 *   <meta name="rb-monitor" content="off">
 *
 * Fronted by a rewrite on the builder domain so sites get clean URLs:
 *   https://relationalbuilder.org/s/{slug}/
 *
 * Deploy: supabase functions deploy site --no-verify-jwt
 */

const CACHE_TTL_SECONDS = 60;
const MAX_FEEDBACK_PER_DAY = 100;
const UNLOCK_DAYS = 30;
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}` };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

// ---- Private sites: passphrase verification + unlock cookies ----

/** Verify against publish-site's stored format: v1$iterations$saltB64$hashB64 */
async function verifyPassphrase(passphrase: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations < 1) return false;
  let salt: Uint8Array, expected: Uint8Array;
  try {
    salt = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
    expected = Uint8Array.from(atob(parts[3]), c => c.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, expected.length * 8,
  ));
  let diff = bits.length ^ expected.length;
  for (let i = 0; i < bits.length; i++) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

async function hmacSign(msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'rb-unlock'),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg)));
  return btoa(String.fromCharCode(...sig)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Token = `${expiry}.${sig}`; the sig covers the stored hash, so rotating
 *  or removing the passphrase invalidates every outstanding cookie. */
async function mintUnlockToken(siteId: string, passphraseHash: string): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + UNLOCK_DAYS * 86400;
  return `${exp}.${await hmacSign(`${siteId}:${passphraseHash}:${exp}`)}`;
}

async function unlockTokenValid(token: string, siteId: string, passphraseHash: string): Promise<boolean> {
  const dot = token.indexOf('.');
  if (dot <= 0) return false;
  const exp = Number(token.slice(0, dot));
  const sig = token.slice(dot + 1);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now() || !sig) return false;
  const expected = await hmacSign(`${siteId}:${passphraseHash}:${exp}`);
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function unlockCookieName(slug: string): string {
  return `rb_gate_${slug.replace(/[^a-z0-9-]/gi, '')}`;
}

function readCookie(req: Request, name: string): string | null {
  for (const part of (req.headers.get('cookie') ?? '').split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1);
  }
  return null;
}

/**
 * The unlock page a private site serves in place of its files. Neutral on
 * purpose — the site's own design begins once the door opens. Posts to
 * `__unlock` resolved against the current page (same trick as the feedback
 * widget) so it works behind the /s/{slug}/ rewrite and the direct
 * function URL alike, then reloads into the real site.
 */
function unlockPage(siteName: string): string {
  const safeName = siteName.replace(/[<>&"']/g, '');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${safeName}</title>
<style>
  body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
         font-family: system-ui, sans-serif; background: #f6f5f2; color: #1f2937; }
  .card { width: min(320px, 86vw); text-align: center; padding: 24px; }
  h1 { font-size: 20px; font-weight: 600; margin: 0 0 4px; }
  p { font-size: 13px; color: #6b7280; margin: 0 0 20px; }
  input { width: 100%; box-sizing: border-box; font-size: 15px; padding: 10px 12px; text-align: center;
          border: 1px solid #d1d5db; border-radius: 8px; background: #fff; color: inherit; }
  input:focus { outline: 2px solid #1f2937; outline-offset: 1px; border-color: #1f2937; }
  button { width: 100%; margin-top: 10px; font-size: 14px; font-weight: 500; padding: 10px 12px;
           border: none; border-radius: 8px; background: #1f2937; color: #fff; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  .err { font-size: 13px; color: #b91c1c; min-height: 18px; margin-top: 10px; }
  @media (prefers-color-scheme: dark) {
    body { background: #17181b; color: #e5e7eb; }
    input { background: #232529; border-color: #3f4147; }
    input:focus { outline-color: #e5e7eb; border-color: #e5e7eb; }
    button { background: #e5e7eb; color: #17181b; }
    .err { color: #f87171; }
  }
</style>
</head>
<body>
<form class="card" id="gate">
  <h1>${safeName}</h1>
  <p>This site is just for its group — enter the passphrase you were given.</p>
  <input id="pass" type="password" autocomplete="current-password" autofocus aria-label="Passphrase">
  <button id="go" type="submit">Open</button>
  <div class="err" id="err" role="alert"></div>
</form>
<script>
(function () {
  var base = location.href.split(/[?#]/)[0];
  if (!base.endsWith('/')) base += '/';
  var form = document.getElementById('gate'), pass = document.getElementById('pass'),
      go = document.getElementById('go'), err = document.getElementById('err');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!pass.value) return;
    go.disabled = true;
    err.textContent = '';
    fetch(base + '__unlock', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase: pass.value }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { return { ok: r.ok, body: b }; }); })
      .then(function (r) {
        if (r.ok) { location.reload(); return; }
        err.textContent = r.body.error || 'That did not open it — check the passphrase and try again.';
        go.disabled = false;
        pass.select();
      })
      .catch(function () {
        err.textContent = 'Could not reach the site — try again in a moment.';
        go.disabled = false;
      });
  });
})();
</script>
</body>
</html>`;
}

/**
 * The injected widget. Kept dependency-free and tiny; posts to
 * `__feedback` resolved against the current page so it works behind the
 * /s/{slug}/ rewrite and the direct function URL alike.
 */
function feedbackWidget(siteName: string): string {
  const safeName = siteName.replace(/[<>&"']/g, '');
  return `
<script>
(function () {
  if (document.querySelector('meta[name="rb-feedback"][content="off"]')) return;
  var base = location.href.split(/[?#]/)[0];
  if (!base.endsWith('/')) base += '/';
  var url = base + '__feedback';
  var css = 'position:fixed;bottom:16px;right:16px;z-index:99999;font-family:system-ui,sans-serif;';
  var box = document.createElement('div');
  box.setAttribute('style', css);
  box.innerHTML =
    '<button id="rbfb-btn" style="background:#1f2937;color:#fff;border:none;border-radius:999px;padding:8px 14px;font-size:13px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.25)">&#128172; Leave a note</button>' +
    '<div id="rbfb-form" style="display:none;background:#fff;color:#111;border:1px solid #d1d5db;border-radius:12px;padding:12px;width:260px;box-shadow:0 4px 16px rgba(0,0,0,.2)">' +
    '<div style="font-size:13px;font-weight:600;margin-bottom:6px">A note for the builder of ${safeName}</div>' +
    '<input id="rbfb-name" placeholder="Your name (optional)" maxlength="80" style="width:100%;box-sizing:border-box;font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:6px">' +
    '<textarea id="rbfb-msg" placeholder="What works? What would help?" maxlength="1000" rows="3" style="width:100%;box-sizing:border-box;font-size:13px;padding:6px 8px;border:1px solid #d1d5db;border-radius:6px;margin-bottom:6px"></textarea>' +
    '<div style="display:flex;gap:6px;justify-content:flex-end">' +
    '<button id="rbfb-cancel" style="background:none;border:none;font-size:12px;color:#6b7280;cursor:pointer">Cancel</button>' +
    '<button id="rbfb-send" style="background:#1f2937;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;cursor:pointer">Send</button>' +
    '</div></div>';
  document.body.appendChild(box);
  var btn = box.querySelector('#rbfb-btn'), form = box.querySelector('#rbfb-form');
  btn.onclick = function () { btn.style.display = 'none'; form.style.display = 'block'; };
  box.querySelector('#rbfb-cancel').onclick = function () { form.style.display = 'none'; btn.style.display = 'inline-block'; };
  box.querySelector('#rbfb-send').onclick = function () {
    var msg = box.querySelector('#rbfb-msg').value.trim();
    if (!msg) return;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: box.querySelector('#rbfb-name').value.trim(), message: msg }) })
      .catch(function () {});
    form.innerHTML = '<div style="font-size:13px;padding:4px 0">&#128155; Thanks — your note went to the builder.</div>';
    setTimeout(function () { form.style.display = 'none'; btn.style.display = 'inline-block'; }, 2500);
  };
})();
</script>`;
}

/**
 * The injected error beacon. Sends each distinct message once per page
 * load, at most 3 per load — enough to know the tool is hurting without
 * turning a render loop into traffic. Errors from the visitor's own
 * browser extensions (wallet injections, redacted cross-origin "Script
 * error.") are dropped before they're ever sent — see NOISE below, and
 * the matching backstop in community-monitor.
 */
const ERROR_BEACON = `
<script>
(function () {
  if (document.querySelector('meta[name="rb-monitor"][content="off"]')) return;
  var base = location.href.split(/[?#]/)[0];
  if (!base.endsWith('/')) base += '/';
  var url = base + '__error';
  var seen = {};
  var sent = 0;
  // Visitors' browser extensions — crypto wallets above all — inject scripts
  // into every page and throw errors the builder can't do anything about.
  // Drop those here so they never leave the visitor's browser: a builder's
  // "your site hit errors" email must only ever be about their own code.
  var NOISE = /metamask|ethereum|walletconnect|coinbase|phantom|solana|extension context invalidated|resizeobserver loop/i;
  function noisy(message) {
    // Bare "Script error." is a cross-origin error the browser redacted —
    // nearly always an extension, and unactionable either way.
    return NOISE.test(message) || /^script error\\.?$/i.test(message.trim());
  }
  function report(message) {
    message = String(message || '').slice(0, 500);
    if (!message || noisy(message) || seen[message] || sent >= 3) return;
    seen[message] = 1;
    sent++;
    try {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: message }), keepalive: true }).catch(function () {});
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    // Extension-origin errors are only identifiable here, before the path is
    // stripped to a basename for the report.
    if (e.filename && /^(chrome|moz|safari-web)-extension:/.test(e.filename)) return;
    report(e.message + (e.filename ? ' (' + e.filename.split('/').pop() + ':' + e.lineno + ')' : ''));
  });
  window.addEventListener('unhandledrejection', function (e) {
    var r = e.reason;
    report('Unhandled rejection: ' + (r && r.message ? r.message : String(r)));
  });
})();
</script>`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    // Path arrives as /site/{slug}/{...filepath} (direct) — the domain
    // rewrite maps /s/{slug}/... onto the same shape
    const url = new URL(req.url);
    const segments = url.pathname.split('/').filter(Boolean);
    const siteIdx = segments.indexOf('site');
    const slug = segments[siteIdx + 1] ?? '';
    let filePath = segments.slice(siteIdx + 2).join('/');
    if (!slug) return new Response('Site not specified', { status: 400 });
    if (!filePath) filePath = 'index.html';

    const siteRes = await fetch(
      rest(`/community_sites?slug=eq.${encodeURIComponent(slug)}&select=id,name,kind,expires_at,passphrase_hash`),
      { headers: svc() },
    );
    const sites = siteRes.ok ? await siteRes.json() : [];
    if (sites.length === 0) {
      return new Response('This site does not exist (or was taken down).', {
        status: 404,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
    const siteId = sites[0].id;
    const siteName = sites[0].name ?? slug;
    const passphraseHash: string | null = sites[0].passphrase_hash ?? null;
    // Preview links are lighter-weight sites: unlisted, no analytics or
    // feedback widget, and they lapse on their own
    const isPreview = sites[0].kind === 'preview';
    if (isPreview && sites[0].expires_at && Date.parse(sites[0].expires_at) < Date.now()) {
      return new Response('This preview link has expired — ask the builder for a fresh one.', {
        status: 410,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // ---- Unlock (the private-site cover page POSTs here) ----
    if (req.method === 'POST' && filePath.split('/').pop() === '__unlock') {
      // No passphrase (anymore) — a stale cover page's submit just opens
      if (!passphraseHash) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const body = await req.json().catch(() => ({}));
      const passphrase = String(body.passphrase ?? '');
      if (!passphrase || !(await verifyPassphrase(passphrase, passphraseHash))) {
        // A beat of delay keeps scripted guessing slow without hurting people
        await new Promise(resolve => setTimeout(resolve, 400));
        return new Response(JSON.stringify({ error: 'That did not open it — check the passphrase and try again.' }), {
          status: 401, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const token = await mintUnlockToken(siteId, passphraseHash);
      // Path=/ so one cookie works behind /s/{slug}/ and the direct function
      // URL alike; the slug in the name keeps sites from colliding
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          ...CORS,
          'Content-Type': 'application/json',
          'Set-Cookie': `${unlockCookieName(slug)}=${token}; Path=/; Max-Age=${UNLOCK_DAYS * 86400}; HttpOnly; Secure; SameSite=Lax`,
        },
      });
    }

    // ---- Error beacon (the injected script POSTs here) ----
    if (req.method === 'POST' && filePath.split('/').pop() === '__error') {
      const body = await req.json().catch(() => ({}));
      const message = String(body.message ?? '').trim().slice(0, 500);
      if (!message || isPreview) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      // Signature: the message minus volatile bits (numbers, urls) so the
      // same crash dedupes across visitors and reloads
      const signature = message
        .replace(/https?:\/\/\S+/g, 'url')
        .replace(/\d+/g, 'N')
        .toLowerCase()
        .slice(0, 200);
      await fetch(rest('/rpc/record_site_error'), {
        method: 'POST',
        headers: { ...svc(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_site_id: siteId, p_signature: signature, p_message: message }),
      }).catch(() => {});
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ---- Neighbor feedback (widget POSTs here) ----
    if (req.method === 'POST') {
      if (filePath.split('/').pop() !== '__feedback') {
        return new Response('Not found', { status: 404, headers: CORS });
      }
      const body = await req.json().catch(() => ({}));
      const message = String(body.message ?? '').trim().slice(0, 1000);
      const name = String(body.name ?? '').trim().slice(0, 80) || null;
      if (!message) {
        return new Response(JSON.stringify({ error: 'Say something first' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      // Per-site daily cap keeps abuse boring
      const today = new Date().toISOString().slice(0, 10);
      const countRes = await fetch(
        rest(`/site_feedback?site_id=eq.${siteId}&created_at=gte.${today}&select=id`),
        { headers: { ...svc(), Prefer: 'count=exact', Range: '0-0' } },
      );
      const count = Number(countRes.headers.get('content-range')?.split('/')[1] ?? 0);
      if (count >= MAX_FEEDBACK_PER_DAY) {
        return new Response(JSON.stringify({ error: 'This site has received a lot of notes today — try again tomorrow' }), {
          status: 429, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      const insRes = await fetch(rest('/site_feedback'), {
        method: 'POST',
        headers: { ...svc(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ site_id: siteId, name, message }),
      });
      if (!insRes.ok) {
        return new Response(JSON.stringify({ error: 'Could not save your note' }), {
          status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      });
    }

    // ---- The gate: a private site serves its unlock page, not its files ----
    if (passphraseHash) {
      const token = readCookie(req, unlockCookieName(slug));
      const unlocked = token ? await unlockTokenValid(token, siteId, passphraseHash) : false;
      if (!unlocked) {
        // Pages get the cover; stray asset requests (no unlocked page asked
        // for them) get a plain refusal
        const wantsPage = filePath === 'index.html' || filePath.endsWith('.html') || !filePath.includes('.');
        if (!wantsPage) {
          return new Response('This site is passphrase-protected.', {
            status: 401,
            headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
          });
        }
        // Same gateway workaround as below: trusted fronts get HTML
        // disguised as text/x-rb-html and translate it back
        const coverType = req.headers.get('x-rb-raw') === '1'
          ? 'text/x-rb-html; charset=utf-8'
          : 'text/html; charset=utf-8';
        return new Response(req.method === 'HEAD' ? null : unlockPage(siteName), {
          status: 401,
          headers: {
            'Content-Type': coverType,
            'Cache-Control': 'no-store',
            'X-Hosted-By': 'Relational Builder Community Hosting',
          },
        });
      }
    }

    const fileRes = await fetch(
      rest(`/site_files?site_id=eq.${siteId}&path=eq.${encodeURIComponent(filePath)}&select=content,content_type`),
      { headers: svc() },
    );
    const found = fileRes.ok ? await fileRes.json() : [];

    // SPA-style fallback: unknown paths (no extension) serve index.html
    let file = found[0];
    let servedIndex = filePath === 'index.html';
    if (!file && !filePath.includes('.')) {
      const indexRes = await fetch(
        rest(`/site_files?site_id=eq.${siteId}&path=eq.index.html&select=content,content_type`),
        { headers: svc() },
      );
      file = indexRes.ok ? (await indexRes.json())[0] : undefined;
      servedIndex = Boolean(file);
    }
    if (!file) {
      return new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } });
    }

    // Count page views (not asset requests) — fire and forget
    if (servedIndex && !isPreview) {
      fetch(rest('/rpc/increment_site_views'), {
        method: 'POST',
        headers: { ...svc(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_site_id: siteId }),
      }).catch(() => {});
    }

    // Inject the neighbor-note widget and error beacon into served HTML
    let content = file.content as string;
    if (servedIndex && !isPreview && String(file.content_type).startsWith('text/html')) {
      let extras = '';
      if (!/name=["']rb-feedback["']\s+content=["']off["']/i.test(content)) {
        extras += feedbackWidget(siteName);
      }
      if (!/name=["']rb-monitor["']\s+content=["']off["']/i.test(content)) {
        extras += ERROR_BEACON;
      }
      if (extras) {
        // Splice before the LAST </body>: app bundles are inlined in this
        // HTML and can legitimately contain "</body>" inside a JS string —
        // injecting at the first match would land these scripts mid-bundle
        // and break the page with a SyntaxError. (Splicing also sidesteps
        // String.replace's $-pattern expansion.)
        const at = content.toLowerCase().lastIndexOf('</body>');
        content = at >= 0
          ? content.slice(0, at) + extras + '\n' + content.slice(at)
          : content + extras;
      }
    }

    // Supabase's gateway rewrites text/html GET responses on *.supabase.co
    // to text/plain (anti-phishing). Trusted fronts (the Vercel /s/ proxy)
    // send x-rb-raw and get HTML disguised as text/x-rb-html, which they
    // translate back before it reaches the browser.
    let contentType = String(file.content_type);
    if (req.headers.get('x-rb-raw') === '1' && contentType.startsWith('text/html')) {
      contentType = 'text/x-rb-html; charset=utf-8';
    }

    // Binary images (home-screen icons, photos) are stored as base64 text —
    // decode to real bytes here. SVG stays text; undecodable content is
    // served as-is rather than erroring.
    let body: BodyInit = content;
    if (/^image\//.test(contentType) && contentType !== 'image/svg+xml') {
      try {
        body = Uint8Array.from(atob(content.replace(/\s+/g, '')), c => c.charCodeAt(0));
      } catch {
        body = content;
      }
    }

    return new Response(req.method === 'HEAD' ? null : body, {
      headers: {
        'Content-Type': contentType,
        // Unlocked private content must never land in a shared cache
        'Cache-Control': passphraseHash ? 'private, no-store' : `public, max-age=${CACHE_TTL_SECONDS}`,
        'X-Hosted-By': 'Relational Builder Community Hosting',
      },
    });
  } catch {
    return new Response('Something went wrong serving this site.', {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
});
