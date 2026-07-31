/**
 * Supabase Edge Function: story-photos — host the photos a Project Story
 * carries into the commons.
 *
 * The commons submission pipeline is text-only markdown, so a story's
 * embedded photos are uploaded here (the Builder backend's public storage)
 * and the story body references them by URL. Upload happens at the moment
 * of contribution, only for photos actually embedded in the story, and only
 * after the builder's explicit consent in the share card.
 *
 * POST JSON: { photos: [{ data: <data URL>, caption? }] }
 *   - Requires a Builder session (Authorization: Bearer <token>)
 *   - Returns { ok: true, urls: [<public URL>] } in the same order
 *
 * Deploy: supabase functions deploy story-photos --no-verify-jwt
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_PHOTOS = 6;
/** Notepad photos are downscaled to 1024px JPEG client-side — a real one is
 *  well under this; anything bigger isn't a notepad photo */
const MAX_PHOTO_BYTES = 600 * 1024;
const MAX_TOTAL_BYTES = 2.5 * 1024 * 1024;

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Photos are only hosted for signed-in builders — an open upload
    // endpoint on public storage would be an abuse magnet
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in to share photos with a story' }, 401);

    const body = await req.json();
    const photos: { data?: string }[] = Array.isArray(body.photos) ? body.photos : [];
    if (photos.length === 0) return json({ error: 'No photos to host' }, 400);
    if (photos.length > MAX_PHOTOS) return json({ error: `Too many photos (max ${MAX_PHOTOS})` }, 400);

    let total = 0;
    const decoded: { bytes: Uint8Array; mime: string }[] = [];
    for (const p of photos) {
      const m = /^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/.exec(String(p.data ?? ''));
      if (!m) return json({ error: 'Photos must be image data URLs' }, 400);
      let bytes: Uint8Array;
      try {
        bytes = Uint8Array.from(atob(m[2]), c => c.charCodeAt(0));
      } catch {
        return json({ error: 'Unreadable photo data' }, 400);
      }
      if (bytes.length > MAX_PHOTO_BYTES) return json({ error: 'A photo is too large (max 600KB)' }, 413);
      total += bytes.length;
      decoded.push({ bytes, mime: m[1] });
    }
    if (total > MAX_TOTAL_BYTES) return json({ error: 'Photos too large altogether (max 2.5MB)' }, 413);

    const urls: string[] = [];
    for (const { bytes, mime } of decoded) {
      const path = `story-photos/${crypto.randomUUID()}.${EXT[mime]}`;
      const upRes = await fetch(
        `${supabaseUrl}/storage/v1/object/studio-library/${path}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${serviceKey}`,
            apikey: serviceKey,
            'Content-Type': mime,
            'cache-control': 'max-age=31536000, immutable',
          },
          body: bytes,
        },
      );
      if (!upRes.ok) return json({ error: 'Could not host a photo — try again' }, 502);
      urls.push(`${supabaseUrl}/storage/v1/object/public/studio-library/${path}`);
    }

    return json({ ok: true, urls });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Upload failed' }, 500);
  }
});
