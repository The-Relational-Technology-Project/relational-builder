/**
 * Preview screenshots — the build report's optional picture of what got built.
 *
 * The rasterizing happens INSIDE the preview iframe (SCREENSHOT_SOURCE below,
 * injected like the inspector script): the parent can't reach a Sandpack
 * document cross-origin, and even the same-origin framework iframe owns the
 * styles and fonts a faithful capture needs. The parent asks over postMessage,
 * gets a data URL back, and normalizes it to an email-friendly JPEG.
 *
 * Privacy shape mirrors the rest of the report loop: a capture stays on the
 * device — it only travels if the builder ticks the snapshot box AND shares.
 *
 * Twin: public/screenshot.js — keep the logic in sync.
 */

export const SCREENSHOT_SOURCE = `(function () {
  if (window.__rbShotLoaded) return; window.__rbShotLoaded = true;
  var libPromise = null;
  function lib() {
    if (!libPromise) libPromise = import('https://esm.sh/html-to-image@1.11.13');
    return libPromise;
  }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || d.type !== 'rb-screenshot' || !d.id) return;
    function reply(msg) {
      msg.type = 'rb-screenshot-done'; msg.id = d.id;
      try { parent.postMessage(msg, '*'); } catch (err) {}
    }
    lib().then(function (mod) {
      var opts = {
        backgroundColor: '#ffffff',
        pixelRatio: 1,
        quality: 0.92,
        // A broken or CORS-refusing remote image must not sink the capture
        imagePlaceholder: 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
      };
      return mod.toJpeg(document.body, opts).catch(function () {
        // Cross-origin stylesheets can poison font inlining — retry without
        var bare = {}; for (var k in opts) bare[k] = opts[k]; bare.skipFonts = true;
        return mod.toJpeg(document.body, bare);
      });
    }).then(function (dataUrl) {
      reply({ dataUrl: dataUrl });
    }).catch(function (err) {
      reply({ error: String((err && err.message) || err) });
    });
  });
})();`;

/** Rasterizing a whole page + fetching the library can take a while */
const CAPTURE_TIMEOUT_MS = 20_000;
/** Email-friendly bounds: readable, never megabytes */
const MAX_WIDTH = 1100;
const MAX_HEIGHT = 1800;
const JPEG_QUALITY = 0.85;
/** Base64 chars — beyond this we re-encode harder, then give up */
const MAX_DATA_URL_CHARS = 1_000_000;

type Screenshotter = () => Promise<string | null>;

let current: Screenshotter | null = null;

/** Each preview engine registers (and unregisters) its own capture path */
export function registerPreviewScreenshotter(fn: Screenshotter | null): void {
  current = fn;
}

/**
 * A JPEG data URL of the running app, or null when there's nothing to
 * capture (document-only builds, engine still booting) or the capture
 * fails. Callers treat null as "the report just ships without a picture".
 */
export async function capturePreviewScreenshot(): Promise<string | null> {
  if (!current) return null;
  try {
    return await current();
  } catch {
    return null;
  }
}

/** Ask the given preview window for a capture and normalize the reply */
export function captureFromIframe(win: Window): Promise<string | null> {
  return new Promise(resolve => {
    const id = `shot-${Math.random().toString(36).slice(2)}`;
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, CAPTURE_TIMEOUT_MS);
    function cleanup() {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
    }
    function onMessage(e: MessageEvent) {
      const d = e.data;
      if (!d || d.type !== 'rb-screenshot-done' || d.id !== id) return;
      cleanup();
      if (typeof d.dataUrl === 'string' && d.dataUrl.startsWith('data:image/')) {
        normalize(d.dataUrl).then(resolve);
      } else {
        resolve(null);
      }
    }
    window.addEventListener('message', onMessage);
    try {
      win.postMessage({ type: 'rb-screenshot', id }, '*');
    } catch {
      cleanup();
      resolve(null);
    }
  });
}

/**
 * Scale to a readable width, crop pathological page heights, and re-encode
 * as JPEG small enough to ride in the report body and the steward email.
 */
async function normalize(dataUrl: string): Promise<string | null> {
  const img = new Image();
  const loaded = new Promise<boolean>(res => {
    img.onload = () => res(true);
    img.onerror = () => res(false);
  });
  img.src = dataUrl;
  if (!(await loaded) || img.width === 0 || img.height === 0) return null;

  const scale = Math.min(1, MAX_WIDTH / img.width);
  const w = Math.round(img.width * scale);
  const h = Math.min(MAX_HEIGHT, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, img.width, Math.min(img.height, h / scale), 0, 0, w, h);

  try {
    let out = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (out.length > MAX_DATA_URL_CHARS) out = canvas.toDataURL('image/jpeg', 0.6);
    return out.length > MAX_DATA_URL_CHARS ? null : out;
  } catch {
    // A tainted canvas (an image the placeholder pass missed) throws here
    return null;
  }
}
