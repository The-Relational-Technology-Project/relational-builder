/**
 * /b/{handle}/og.png — a social card for a builder's public page, rendered
 * from the page's own /data/profile.json: name, neighborhood, and a line of
 * what they have built. Nothing here is generated; an empty field is simply
 * left off the card.
 *
 * Rendered with @vercel/og (Satori + resvg) on the edge. The data file is
 * read through the site function the same way api/site.ts does (x-rb-raw +
 * x-rb-profile), so a handle that is not a builder page renders nothing.
 */

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const ORIGIN = 'https://texakzqqenzpxawktbgx.supabase.co/functions/v1/site';
const FRAUNCES = 'https://cdn.jsdelivr.net/npm/@fontsource/fraunces@5/files/fraunces-latin-600-normal.woff';
const INTER = 'https://cdn.jsdelivr.net/npm/@fontsource/inter@5/files/inter-latin-400-normal.woff';

interface ProfileData {
  name?: string;
  neighborhood?: string;
  projects?: { name?: string }[];
  practice_highlights?: string[];
  sections?: string[];
}

const fontCache = new Map<string, Promise<ArrayBuffer>>();
function font(url: string): Promise<ArrayBuffer> {
  let p = fontCache.get(url);
  if (!p) {
    p = fetch(url).then(r => {
      if (!r.ok) throw new Error(`font ${r.status}`);
      return r.arrayBuffer();
    });
    fontCache.set(url, p);
  }
  return p;
}

async function profileFor(handle: string): Promise<ProfileData | null> {
  const res = await fetch(`${ORIGIN}/${handle}/data/profile.json`, {
    headers: { 'x-rb-raw': '1', 'x-rb-profile': '1', 'x-rb-path': `${handle}/data/profile.json` },
  });
  if (!res.ok) return null;
  try {
    const data = (await res.json()) as ProfileData;
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const handle = (url.searchParams.get('b') ?? '').toLowerCase();
  if (!/^[a-z0-9-]{3,32}$/.test(handle)) return new Response('Not found', { status: 404 });

  const [data, fraunces, inter] = await Promise.all([profileFor(handle), font(FRAUNCES), font(INTER)]);
  if (!data) return new Response('Not found', { status: 404 });

  const name = clip(String(data.name ?? '').trim() || 'A relational technologist', 40);
  const place = clip(String(data.neighborhood ?? '').trim(), 60);
  const on = new Set(Array.isArray(data.sections) ? data.sections : []);
  const projects = (Array.isArray(data.projects) ? data.projects : [])
    .map(p => String(p?.name ?? '').trim())
    .filter(Boolean);
  const line =
    on.has('projects') && projects.length > 0
      ? clip(`Built: ${projects.slice(0, 3).join(' · ')}${projects.length > 3 ? ` +${projects.length - 3}` : ''}`, 90)
      : on.has('practice') && Array.isArray(data.practice_highlights) && data.practice_highlights[0]
        ? clip(String(data.practice_highlights[0]), 90)
        : '';

  // Satori takes a React-shaped element tree; built as plain objects here
  // so the edge function needs no JSX runtime
  const element = {
      type: 'div',
      props: {
        style: {
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          justifyContent: 'space-between', padding: '64px 72px',
          background: 'linear-gradient(135deg, #f6f1e7 0%, #e9e2d3 100%)', color: '#1f2a24',
          fontFamily: 'Inter',
        },
        children: [
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: 18 },
              children: [
                { type: 'div', props: { style: { fontSize: 28, color: '#5b6b62', letterSpacing: 1 }, children: 'Relational technologist' } },
                { type: 'div', props: { style: { fontSize: 88, fontFamily: 'Fraunces', lineHeight: 1.05 }, children: name } },
                ...(place ? [{ type: 'div', props: { style: { fontSize: 40, color: '#2f5d47' }, children: place } }] : []),
              ],
            },
          },
          {
            type: 'div',
            props: {
              style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24 },
              children: [
                { type: 'div', props: { style: { fontSize: 30, color: '#3d4a43', maxWidth: 820 }, children: line } },
                { type: 'div', props: { style: { fontSize: 26, color: '#5b6b62', whiteSpace: 'nowrap' }, children: `relationalbuilder.org/b/${handle}` } },
              ],
            },
          },
        ],
      },
    } as unknown as ConstructorParameters<typeof ImageResponse>[0];

  return new ImageResponse(
    element,
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' },
        { name: 'Inter', data: inter, weight: 400, style: 'normal' },
      ],
      headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400' },
    },
  );
}
