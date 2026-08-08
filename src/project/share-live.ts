import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import { builderClient } from '@/cloud/builder-client';
import { composeStoryRecord } from '@/project/draft-story';

/**
 * Share Live — a three-slide demo deck for showing a build to a room.
 *
 * Slide 1: project title + one-liner. Slide 2: screenshot + what it does.
 * Slide 3: QR code + link so the room can open it on their phones.
 *
 * The deck is one self-contained HTML page published through the same
 * unlisted preview pipeline as Share Preview (30-day link, no site-cap
 * cost). The screenshot rides on the story-photos host so the page itself
 * stays tiny — and so the demo wall in the Gallery can reuse the image.
 */

export interface ShareLiveCopy {
  oneLiner: string;
  bullets: string[];
}

const COPY_SYSTEM = [
  'You write demo-day slide copy for a small community-built web app, from the build record you are given.',
  'Plain, warm, specific words — say what the tool actually does for real people. No marketing fluff, no exclamation marks, no jargon.',
  'Reply in EXACTLY this format and nothing else:',
  'ONE-LINER: <one sentence, under 140 characters, that tells a room of strangers what this is>',
  'BULLET: <a main feature or capability, under 70 characters>',
  'Give 3 to 5 BULLET lines.',
].join('\n');

/** Draft the deck copy from the build record — same provider path as stories */
export async function draftShareLiveCopy(): Promise<ShareLiveCopy> {
  const { activeProviderId, activeModelId } = useProviderStore.getState();
  const provider = registry.getProvider(activeProviderId);
  if (!provider) throw new Error('No model available to draft with');

  const record = composeStoryRecord();

  let reply = '';
  await new Promise<void>((resolve, reject) => {
    provider.chat(
      [
        { role: 'system', content: COPY_SYSTEM },
        { role: 'user', content: record },
      ],
      activeModelId,
      {
        onToken: t => { reply += t; },
        onComplete: () => resolve(),
        onError: err => reject(err),
      },
      new AbortController().signal,
    ).catch(reject); // chat() can throw before streaming — don't hang the promise
  });

  const oneLiner = (reply.match(/^ONE-LINER:\s*(.+)$/m)?.[1] ?? '').trim().slice(0, 160);
  const bullets = [...reply.matchAll(/^BULLET:\s*(.+)$/gm)]
    .map(m => m[1].trim().slice(0, 90))
    .filter(Boolean)
    .slice(0, 5);
  if (!oneLiner && bullets.length === 0) {
    throw new Error('The draft came back empty — you can fill the copy in by hand');
  }
  return { oneLiner, bullets };
}

/**
 * Squeeze a captured screenshot under the story-photos host's 600 KB photo
 * cap: bounded width, then a JPEG quality ladder. Returns null when the
 * image can't be decoded (the deck and wall just go without).
 */
export async function shrinkScreenshot(dataUrl: string): Promise<string | null> {
  const img = new Image();
  const loaded = await new Promise<boolean>(resolve => {
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
  if (!loaded || !img.naturalWidth) return null;

  const maxWidth = 1000;
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  // ~700k base64 chars ≈ 525 KB decoded — comfortably under the host's cap
  const MAX_CHARS = 700_000;
  for (const quality of [0.82, 0.68, 0.55, 0.42]) {
    try {
      const out = canvas.toDataURL('image/jpeg', quality);
      if (out.length <= MAX_CHARS) return out;
    } catch {
      return null; // tainted canvas — shouldn't happen for our own capture
    }
  }
  return null;
}

/** Host a screenshot on public storage via story-photos; null on any failure */
export async function hostScreenshot(dataUrl: string): Promise<string | null> {
  try {
    if (!builderClient) return null;
    const { data } = await builderClient.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const res = await fetch(
      `${import.meta.env.VITE_BUILDER_SUPABASE_URL}/functions/v1/story-photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ photos: [{ data: dataUrl, caption: 'app screenshot' }] }),
      },
    );
    const payload = await res.json().catch(() => ({}));
    return res.ok && Array.isArray(payload.urls) ? (payload.urls[0] ?? null) : null;
  } catch {
    return null;
  }
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface DeckInput {
  title: string;
  oneLiner: string;
  builderName: string | null;
  eventName: string | null;
  bullets: string[];
  screenshotUrl: string | null;
  demoUrl: string;
  /** Inline SVG markup for the demo URL's QR code */
  qrSvg: string;
}

/**
 * The deck itself: one self-contained HTML page, three slides, click or
 * arrow keys to move. Warm Builder palette, type sized for a projector.
 */
export function buildDeckHtml(input: DeckInput): string {
  const { title, oneLiner, builderName, eventName, bullets, screenshotUrl, demoUrl, qrSvg } = input;
  const byline = [builderName, eventName].filter(Boolean).map(s => esc(String(s)));
  const shortUrl = demoUrl.replace(/^https?:\/\//, '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="rb-feedback" content="off">
<meta name="rb-monitor" content="off">
<title>${esc(title)} — live share</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { height: 100%; }
  body {
    font-family: ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #FAF7F2; color: #2A1F18; overflow: hidden; cursor: pointer;
  }
  .slide {
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; text-align: center;
    padding: 6vmin 8vmin 10vmin;
  }
  .slide.on { display: flex; }
  .kicker { font-size: clamp(14px, 2.2vmin, 22px); letter-spacing: .14em;
    text-transform: uppercase; color: #C0532F; font-weight: 700; margin-bottom: 2.5vmin; }
  h1 { font-size: clamp(34px, 9vmin, 110px); line-height: 1.05; letter-spacing: -0.02em; max-width: 26ch; }
  .oneliner { font-size: clamp(18px, 3.6vmin, 42px); line-height: 1.35; color: #49362B;
    max-width: 34ch; margin-top: 3.5vmin; }
  .byline { margin-top: 4.5vmin; font-size: clamp(13px, 2.2vmin, 24px); color: #93806F; }
  .byline strong { color: #49362B; font-weight: 600; }
  .row { display: flex; gap: 5vmin; align-items: center; justify-content: center;
    flex-wrap: wrap; margin-top: 3vmin; max-width: 92vw; }
  .shot { max-width: min(52vw, 900px); max-height: 58vh; border-radius: 14px;
    border: 1px solid #E5DCD0; box-shadow: 0 18px 50px rgba(42,31,24,.14); }
  ul { list-style: none; text-align: left; font-size: clamp(16px, 3vmin, 36px);
    line-height: 1.45; max-width: 30ch; }
  li { padding: 1.2vmin 0 1.2vmin 4.2vmin; position: relative; }
  li::before { content: ''; position: absolute; left: 0; top: calc(1.2vmin + .52em);
    width: 2.2vmin; height: 2.2vmin; max-width: 18px; max-height: 18px;
    border-radius: 50%; background: #C0532F; transform: translateY(-50%); }
  .qr { background: #ffffff; border-radius: 20px; padding: 3vmin;
    box-shadow: 0 18px 50px rgba(42,31,24,.14); display: inline-block; line-height: 0; }
  .qr svg { width: min(44vmin, 420px); height: min(44vmin, 420px); }
  .url { margin-top: 3.5vmin; font-size: clamp(16px, 3vmin, 34px); font-weight: 600;
    color: #C0532F; word-break: break-all; max-width: 90vw; }
  .hint { margin-top: 1.6vmin; font-size: clamp(13px, 2.2vmin, 24px); color: #93806F; }
  .dots { position: absolute; bottom: 3.5vmin; left: 0; right: 0; display: flex;
    gap: 1.6vmin; justify-content: center; }
  .dots span { width: 1.6vmin; height: 1.6vmin; min-width: 9px; min-height: 9px;
    border-radius: 50%; background: #D9CCBC; transition: background .15s; }
  .dots span.on { background: #C0532F; }
  .credit { position: absolute; bottom: 3.2vmin; right: 3.5vmin;
    font-size: clamp(11px, 1.8vmin, 18px); color: #B7A894; text-decoration: none; }
</style>
</head>
<body>
  <section class="slide on">
    ${eventName ? `<div class="kicker">${esc(eventName)}</div>` : ''}
    <h1>${esc(title)}</h1>
    ${oneLiner ? `<p class="oneliner">${esc(oneLiner)}</p>` : ''}
    ${byline.length ? `<p class="byline">Built by <strong>${byline[0]}</strong></p>` : ''}
  </section>

  <section class="slide">
    <div class="kicker">What it does</div>
    <div class="row">
      ${screenshotUrl ? `<img class="shot" src="${esc(screenshotUrl)}" alt="${esc(title)} screenshot">` : ''}
      ${bullets.length ? `<ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
    </div>
  </section>

  <section class="slide">
    <div class="kicker">Try it on your phone</div>
    <div class="qr">${qrSvg}</div>
    <div class="url">${esc(shortUrl)}</div>
    <p class="hint">Point your camera at the code — no install, no signup</p>
  </section>

  <div class="dots"><span class="on"></span><span></span><span></span></div>
  <a class="credit" href="https://relationalbuilder.org" target="_blank" rel="noreferrer">Built with Relational Builder</a>

  <script>
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('.dots span'));
    var i = 0;
    function show(n) {
      i = (n + slides.length) % slides.length;
      slides.forEach(function (s, k) { s.classList.toggle('on', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('on', k === i); });
    }
    document.body.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      show(i + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') show(i + 1);
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') show(i - 1);
    });
  </script>
</body>
</html>`;
}
