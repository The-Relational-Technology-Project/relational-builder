/**
 * Supabase Edge Function: commons-guestbook — notes and votes on the public
 * commons theme pages (/commons/themes/...).
 *
 * The Vercel edge function is the only intended caller: it renders the
 * pages, proxies form posts here, and passes a salted hash of the visitor's
 * IP (the raw IP never reaches this function or the database).
 *
 * GET  ?page=<slug>          → { notes: [...], votes: { item: count } }
 * POST { action: 'note', page, name, note, ip_hash, website? }
 * POST { action: 'vote', page, item, ip_hash }
 *   - No auth (the wall is public); rate limited per ip_hash in the tables
 *   - `website` is a honeypot: any value → pretend success, write nothing
 *
 * Deploy: via the Management API (see CLAUDE.md), verify_jwt off.
 * Tables: commons_notes, commons_votes (service-role only — RLS with no
 * anon policies).
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const NOTES_PER_HOUR = 5;
const KNOWN_PAGES = new Set(['on-your-block', 'civic-media']);

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

const rest = (path: string): string => `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;

const clean = (s: unknown, max: number): string =>
  String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    if (req.method === 'GET') {
      const page = clean(new URL(req.url).searchParams.get('page'), 60);
      if (!KNOWN_PAGES.has(page)) return json({ notes: [], votes: {} });

      const [notesRes, votesRes] = await Promise.all([
        fetch(
          rest(`/commons_notes?select=name,note,created_at&page_slug=eq.${page}&approved=eq.true&order=created_at.desc&limit=60`),
          { headers: svc() },
        ),
        fetch(rest(`/commons_votes?select=item_slug&page_slug=eq.${page}&limit=5000`), {
          headers: svc(),
        }),
      ]);
      const notes = notesRes.ok ? await notesRes.json() : [];
      const voteRows: { item_slug: string }[] = votesRes.ok ? await votesRes.json() : [];
      const votes: Record<string, number> = {};
      for (const v of voteRows) votes[v.item_slug] = (votes[v.item_slug] ?? 0) + 1;
      return json({ notes, votes });
    }

    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

    const body = await req.json().catch(() => ({}));
    const page = clean(body.page, 60);
    const ipHash = clean(body.ip_hash, 32);
    if (!KNOWN_PAGES.has(page) || !ipHash) return json({ error: 'Bad request' }, 400);

    if (body.action === 'vote') {
      const item = clean(body.item, 80);
      if (!item) return json({ error: 'Bad request' }, 400);
      // Unique (page, item, ip_hash) — repeat votes land on the constraint
      // and are simply already counted.
      const res = await fetch(rest('/commons_votes'), {
        method: 'POST',
        headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({ page_slug: page, item_slug: item, ip_hash: ipHash }),
      });
      return json({ ok: res.ok });
    }

    if (body.action === 'note') {
      // Honeypot: bots fill every field; people never see this one.
      if (clean(body.website, 10)) return json({ ok: true });

      const name = clean(body.name, 40);
      const note = clean(body.note, 280);
      if (!name || !note) return json({ error: 'Name and note are both needed' }, 400);

      const since = new Date(Date.now() - 3600_000).toISOString();
      const recent = await fetch(
        rest(`/commons_notes?select=id&ip_hash=eq.${ipHash}&created_at=gte.${since}&limit=${NOTES_PER_HOUR}`),
        { headers: svc() },
      );
      const rows = recent.ok ? await recent.json() : [];
      if (rows.length >= NOTES_PER_HOUR) {
        return json({ error: 'Too many notes for now — come back in a bit' }, 429);
      }

      const res = await fetch(rest('/commons_notes'), {
        method: 'POST',
        headers: svc(),
        body: JSON.stringify({ page_slug: page, name, note, ip_hash: ipHash }),
      });
      return json({ ok: res.ok }, res.ok ? 200 : 500);
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});
