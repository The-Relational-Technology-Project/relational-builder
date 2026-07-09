/**
 * Supabase Edge Function: site — serves Community Hosting sites.
 *
 * GET /site/{slug}/            → index.html
 * GET /site/{slug}/{filepath}  → that file with its content type
 * POST /site/{slug}/__feedback → a neighbor's note for the builder
 *
 * Views of index.html increment the site's daily counter (simple,
 * privacy-friendly analytics — no cookies, no per-visitor tracking).
 *
 * Every served index.html gets a small "leave a note" widget injected so
 * neighbors can respond to the tool without accounts — the notes appear in
 * the builder's dashboard. Sites can opt out with:
 *   <meta name="rb-feedback" content="off">
 *
 * Fronted by a rewrite on the builder domain so sites get clean URLs:
 *   https://relational-builder.vercel.app/s/{slug}/
 *
 * Deploy: supabase functions deploy site --no-verify-jwt
 */

const CACHE_TTL_SECONDS = 60;
const MAX_FEEDBACK_PER_DAY = 100;
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
      rest(`/community_sites?slug=eq.${encodeURIComponent(slug)}&select=id,name,kind,expires_at`),
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
    // Preview links are lighter-weight sites: unlisted, no analytics or
    // feedback widget, and they lapse on their own
    const isPreview = sites[0].kind === 'preview';
    if (isPreview && sites[0].expires_at && Date.parse(sites[0].expires_at) < Date.now()) {
      return new Response('This preview link has expired — ask the builder for a fresh one.', {
        status: 410,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
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

    // Inject the neighbor-note widget into served HTML pages
    let content = file.content as string;
    if (servedIndex && !isPreview && String(file.content_type).startsWith('text/html') &&
        !/name=["']rb-feedback["']\s+content=["']off["']/i.test(content)) {
      const widget = feedbackWidget(siteName);
      content = /<\/body>/i.test(content)
        ? content.replace(/<\/body>/i, `${widget}\n</body>`)
        : content + widget;
    }

    // Supabase's gateway rewrites text/html GET responses on *.supabase.co
    // to text/plain (anti-phishing). Trusted fronts (the Vercel /s/ proxy)
    // send x-rb-raw and get HTML disguised as text/x-rb-html, which they
    // translate back before it reaches the browser.
    let contentType = String(file.content_type);
    if (req.headers.get('x-rb-raw') === '1' && contentType.startsWith('text/html')) {
      contentType = 'text/x-rb-html; charset=utf-8';
    }

    return new Response(req.method === 'HEAD' ? null : content, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
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
