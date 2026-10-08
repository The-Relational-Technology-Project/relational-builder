import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import { builderClient } from '@/cloud/builder-client';
import { composeStoryRecord } from '@/project/draft-story';

/**
 * Share Live — a short demo deck for showing a build to a room.
 *
 * Slide 1: project title + one-liner. Then one slide per thing the builder
 * chose: the app (its screenshot, large, beside a few short feature lines),
 * any further views of the app the builder captured (one big picture each),
 * a flyer (its picture), a plan doc (what's inside, as a few lines of text —
 * a screenshot of a page of prose reads as nothing from the back of a room).
 * Last: QR code + link so the room can open it on their phones.
 *
 * The deck is one self-contained HTML page published through the same
 * unlisted preview pipeline as Share Preview (30-day link, no site-cap
 * cost). The screenshot rides on the story-photos host so the page itself
 * stays tiny — and so the demo wall in the Gallery can reuse the image.
 */

export interface ShareLiveCopy {
  oneLiner: string;
  bullets: string[];
  /** What each plan doc holds, a few short lines per doc, keyed by its path (no leading slash) */
  docHighlights: Record<string, string[]>;
}

/** Slide copy limits — a projector slide holds a few short lines, not a paragraph */
export const MAX_BULLETS = 4;
export const MAX_BULLET_CHARS = 48;
export const MAX_DOC_HIGHLIGHTS = 4;
export const MAX_HIGHLIGHT_CHARS = 60;

const COPY_SYSTEM = [
  'You write demo-day slide copy for a small community-built web app, from the build record you are given.',
  'Plain, warm, specific words — say what the tool actually does for real people. No marketing fluff, no exclamation marks, no jargon.',
  'The slides are read from the back of a room: every line is a headline, not a sentence. Fragments are good. No trailing periods.',
  'Reply in EXACTLY this format and nothing else:',
  'ONE-LINER: <one sentence, under 120 characters, that tells a room of strangers what this is>',
  'BULLET: <one thing it does, 3 to 6 words, under 40 characters>',
  'Give 3 or 4 BULLET lines, the most important first.',
  'Then, for each plan doc excerpt in the record (the "--- name (plan doc excerpt) ---" sections), 2 to 4 lines:',
  'DOC <name exactly as given>: <one thing the doc gives its reader, 3 to 8 words, under 55 characters>',
  'Skip the DOC lines when the record has no plan doc excerpts.',
].join('\n');

/** Trim a drafted line to slide length: drop a trailing period, cut at a word boundary */
export function tidyLine(raw: string, max: number): string {
  const t = raw.replace(/^[-*•]\s*/, '').replace(/[.。]\s*$/, '').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const atWord = cut.lastIndexOf(' ');
  return (atWord > max * 0.6 ? cut.slice(0, atWord) : cut).trimEnd() + '…';
}

/**
 * The lines a doc slide shows when nobody drafted any: its section
 * headings (what the reader finds inside), or failing those, the first
 * sentences of its opening paragraphs. Short enough for a projector.
 */
export function docHighlightsFromMarkdown(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const unmark = (s: string) =>
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  const headings = lines
    .map(l => l.match(/^#{2,3}\s+(.+)$/)?.[1])
    .filter((h): h is string => Boolean(h))
    .map(h => tidyLine(unmark(h).replace(/^\d+[.)]\s*/, ''), MAX_HIGHLIGHT_CHARS))
    .filter(Boolean);
  if (headings.length >= 2) return headings.slice(0, MAX_DOC_HIGHLIGHTS);

  const sentences: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) { inFence = !inFence; continue; }
    if (inFence || !line.trim() || /^(#|>|\||[-*+]\s|\d+[.)]\s|---)/.test(line.trim())) continue;
    const text = unmark(line);
    const first = text.split(/(?<=[.!?])\s+/)[0];
    if (first && first.length > 12) sentences.push(tidyLine(first, MAX_HIGHLIGHT_CHARS));
    if (sentences.length >= MAX_DOC_HIGHLIGHTS) break;
  }
  return [...headings, ...sentences].slice(0, MAX_DOC_HIGHLIGHTS);
}

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
    .map(m => tidyLine(m[1], MAX_BULLET_CHARS))
    .filter(Boolean)
    .slice(0, MAX_BULLETS);
  const docHighlights: Record<string, string[]> = {};
  for (const m of reply.matchAll(/^DOC\s+(.+?):\s*(.+)$/gm)) {
    const key = m[1].trim().replace(/^\//, '');
    const line = tidyLine(m[2], MAX_HIGHLIGHT_CHARS);
    if (!line) continue;
    const list = (docHighlights[key] ??= []);
    if (list.length < MAX_DOC_HIGHLIGHTS) list.push(line);
  }
  if (!oneLiner && bullets.length === 0) {
    throw new Error('The draft came back empty — you can fill the copy in by hand');
  }
  return { oneLiner, bullets, docHighlights };
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

/**
 * A way to reach the builder, offered by them in Share Live. The label is
 * how they want it read on the slide — one of CONTACT_KINDS or their own
 * word — and the value is what the room acts on.
 */
export interface BuilderContact {
  label: string;
  value: string;
}

/** The standard labels the Share Live dialog offers (plus "Other") */
export const CONTACT_KINDS = ['Email', 'Phone', 'Website'] as const;

/**
 * Something a phone can act on from the value — mailto:, tel:, or https://
 * — or null when it should stay plain text (a handle, "ask for Sam at the
 * front table"). Judged from the value itself, so an "Other" label that
 * holds an email still links.
 */
export function contactHref(contact: BuilderContact): string | null {
  const v = contact.value.trim();
  if (!v) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(v)) return `https://${v}`;
  const digits = v.replace(/[\s().-]/g, '');
  if (/^\+?\d{7,15}$/.test(digits)) return `tel:${digits}`;
  return null;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** One artifact's slide: the app, a further view of it, a flyer, a plan */
export interface DeckArtifactSlide {
  /** "The app", "Printable page", "Written doc" */
  kindLabel: string;
  /** The artifact's own name — heads the slide for everything but the app */
  name: string;
  screenshotUrl: string | null;
  /** For a doc: what's inside, a few short lines, shown instead of a picture */
  highlights?: string[];
  /** For a further view of the app: what this page is ("Host sign-up") */
  caption?: string | null;
}

export interface DeckInput {
  title: string;
  oneLiner: string;
  builderName: string | null;
  eventName: string | null;
  bullets: string[];
  /** The chosen artifacts, in order; the first gets the bullets */
  artifacts: DeckArtifactSlide[];
  demoUrl: string;
  /** Inline SVG markup for the demo URL's QR code */
  qrSvg: string;
  /** How to reach the builder, if they chose to say — on the title and last slides */
  contact?: BuilderContact | null;
}

/** The contact line's markup: label, then the value as a link when it can be one */
function contactMarkup(contact: BuilderContact): string {
  const href = contactHref(contact);
  const value = href
    ? `<a href="${esc(href)}" target="_blank" rel="noreferrer">${esc(contact.value.trim())}</a>`
    : esc(contact.value.trim());
  return `<span class="contact-label">${esc(contact.label.trim() || 'Contact')}</span> ${value}`;
}

/**
 * The deck itself: one self-contained HTML page, three slides, click or
 * arrow keys to move. Warm Builder palette, type sized for a projector.
 */
export function buildDeckHtml(input: DeckInput): string {
  const { title, oneLiner, builderName, eventName, bullets, demoUrl, qrSvg } = input;
  const contact = input.contact && input.contact.value.trim() ? input.contact : null;
  const byline = [builderName, eventName].filter(Boolean).map(s => esc(String(s)));
  const shortUrl = demoUrl.replace(/^https?:\/\//, '');
  const contactLine = contact ? contactMarkup(contact) : '';
  // One slide per artifact. The first carries the drafted bullets under
  // "What it does", picture beside. A doc with highlights is text: what's
  // inside, as a few lines. Anything else is its picture, big, headed by
  // what it is. With nothing chosen (older callers) the bullets still get
  // their slide.
  const artifacts = input.artifacts.length
    ? input.artifacts
    : [{ kindLabel: 'The app', name: title, screenshotUrl: null } as DeckArtifactSlide];
  // The lead slide is the first artifact with a picture to put beside the
  // bullets; when everything chosen is a doc, the bullets open on their own.
  const leadIndex = artifacts.findIndex(a => !(a.highlights?.some(h => h.trim())));
  const bulletList = bullets.length ? `<ul>${bullets.map(b => `<li>${esc(b)}</li>`).join('')}</ul>` : '';
  const slideHtml = artifacts.map((a, i) => {
    const shot = a.screenshotUrl
      ? `<img class="shot" src="${esc(a.screenshotUrl)}" alt="${esc(a.caption || a.name)} screenshot">`
      : '';
    const highlights = (a.highlights ?? []).map(h => h.trim()).filter(Boolean).slice(0, MAX_DOC_HIGHLIGHTS);
    if (i === leadIndex) {
      return `  <section class="slide">
    <div class="kicker">What it does</div>
    <div class="row">${shot}${bulletList}</div>
  </section>`;
    }
    if (highlights.length) {
      return `  <section class="slide">
    <div class="kicker">${esc(a.kindLabel)}</div>
    <h2>${esc(a.name)}</h2>
    <ul class="doc">${highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul>
  </section>`;
    }
    const heading = a.caption?.trim() || (a.name === title ? '' : a.name);
    return `  <section class="slide">
    <div class="kicker">${esc(a.kindLabel)}</div>
    ${heading ? `<h2>${esc(heading)}</h2>` : ''}
    <div class="hero">${shot}</div>
  </section>`;
  });
  if (leadIndex < 0 && bulletList) {
    slideHtml.unshift(`  <section class="slide">
    <div class="kicker">What it does</div>
    <div class="row">${bulletList}</div>
  </section>`);
  }
  const artifactSlides = slideHtml.join('\n\n');
  const slideCount = slideHtml.length + 2;
  const dots = Array.from({ length: slideCount }, (_, i) => `<span${i === 0 ? ' class="on"' : ''}></span>`).join('');

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
    padding: 5vmin 5vmin 9vmin;
  }
  .slide.on { display: flex; }
  .kicker { font-size: clamp(14px, 2.2vmin, 22px); letter-spacing: .14em;
    text-transform: uppercase; color: #C0532F; font-weight: 700; margin-bottom: 2vmin; }
  h1 { font-size: clamp(34px, 9vmin, 110px); line-height: 1.05; letter-spacing: -0.02em; max-width: 26ch; }
  h2 { font-size: clamp(24px, 5.5vmin, 64px); line-height: 1.1; letter-spacing: -0.02em; max-width: 30ch; }
  .oneliner { font-size: clamp(18px, 3.6vmin, 42px); line-height: 1.35; color: #49362B;
    max-width: 34ch; margin-top: 3.5vmin; }
  .byline { margin-top: 4.5vmin; font-size: clamp(13px, 2.2vmin, 24px); color: #93806F; }
  .byline strong { color: #49362B; font-weight: 600; }
  .contact { font-size: clamp(13px, 2.2vmin, 24px); color: #93806F; word-break: break-word; max-width: 90vw; }
  .contact a { color: #C0532F; text-decoration: none; font-weight: 600; }
  .contact-label { text-transform: uppercase; letter-spacing: .1em; font-size: .78em; font-weight: 700; color: #B7A894; }
  .byline + .contact { margin-top: 1.2vmin; }
  .hint + .contact { margin-top: 2.4vmin; }
  /* The picture is the slide: as tall as the screen allows, copy beside it */
  .row { display: flex; gap: 6vmin; align-items: center; justify-content: center;
    margin-top: 1vmin; width: 100%; min-height: 0; }
  .shot { display: block; max-width: 100%; max-height: 74vh; border-radius: 14px; object-fit: contain;
    border: 1px solid #E5DCD0; box-shadow: 0 18px 50px rgba(42,31,24,.14); }
  .row .shot { flex: 0 1 auto; max-width: 58vw; }
  .row ul { flex: 0 1 auto; }
  .hero { margin-top: 1vmin; display: flex; justify-content: center; width: 100%; min-height: 0; }
  .hero .shot { max-width: 92vw; max-height: 70vh; }
  h2 + .hero .shot { max-height: 64vh; }
  ul { list-style: none; text-align: left; font-size: clamp(18px, 3.6vmin, 46px);
    line-height: 1.3; max-width: 22ch; }
  li { padding: 1.5vmin 0 1.5vmin 4.4vmin; position: relative; }
  li::before { content: ''; position: absolute; left: 0; top: calc(1.5vmin + .5em);
    width: 2.2vmin; height: 2.2vmin; max-width: 18px; max-height: 18px;
    border-radius: 50%; background: #C0532F; transform: translateY(-50%); }
  /* A doc slide: a few lines of what's inside, centered, nothing to squint at */
  ul.doc { margin-top: 3vmin; max-width: 30ch; font-size: clamp(20px, 4.2vmin, 54px); }
  ul.doc li { padding: 1.8vmin 0 1.8vmin 5vmin; }
  ul.doc li::before { top: calc(1.8vmin + .5em); width: 2.6vmin; height: 2.6vmin; max-width: 22px; max-height: 22px; }
  @media (max-aspect-ratio: 1/1) {
    .row { flex-direction: column; gap: 3vmin; }
    .row .shot { max-width: 88vw; max-height: 48vh; }
    .row ul { max-width: 30ch; }
  }
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
    ${contactLine ? `<p class="contact">${contactLine}</p>` : ''}
  </section>

${artifactSlides}

  <section class="slide">
    <div class="kicker">Try it on your phone</div>
    <div class="qr">${qrSvg}</div>
    <div class="url">${esc(shortUrl)}</div>
    <p class="hint">Point your camera at the code — no install, no signup</p>
    ${contactLine ? `<p class="contact">Reach ${builderName ? esc(String(builderName)) : 'the builder'} · ${contactLine}</p>` : ''}
  </section>

  <div class="dots">${dots}</div>
  <a class="credit" href="https://relationalbuilder.org" target="_blank" rel="noreferrer">Built with Relational Builder</a>

  <script>
    var slides = Array.prototype.slice.call(document.querySelectorAll('.slide'));
    var dots = Array.prototype.slice.call(document.querySelectorAll('.dots span'));
    var i = 0;
    // Inside an event's presentation page (/show/CODE) the deck sits in an
    // iframe: stepping past either end hands the clicker to the page, which
    // moves to the next or previous builder. On its own, the deck wraps.
    var framed = window.parent && window.parent !== window;
    function show(n) {
      if (framed && n >= slides.length) { window.parent.postMessage({ type: 'rb-deck-next' }, '*'); return; }
      if (framed && n < 0) { window.parent.postMessage({ type: 'rb-deck-prev' }, '*'); return; }
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
