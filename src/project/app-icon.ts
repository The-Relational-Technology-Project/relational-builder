import type { FileEntry } from './virtual-fs';

/**
 * Default home-screen icons for every published site.
 *
 * When a neighbor saves a shortcut to a published tool on their phone
 * (iOS "Add to Home Screen", Android "Add to Home screen" / install), the
 * home screen should show a real app icon — not a browser-default letter
 * tile or a screenshot. Every hosted publish path (Community Hosting,
 * preview links, Netlify, Vercel) runs `withAppIcons` so this is true by
 * default: a deterministic icon drawn from the project's name, a web app
 * manifest for Android, and an apple-touch-icon for iOS.
 *
 * Everything is additive and defers to the builder: any icon, manifest,
 * or meta the project already carries wins — we only fill the gaps.
 *
 * Binary note: the project pipeline is text-only (Postgres-backed hosting,
 * JSON deploy APIs), so the PNGs ride as base64 text under binary
 * extensions. `isBinaryFilePath` marks them for each transport: the `site`
 * edge function decodes on serve, zip export flags base64, Vercel gets
 * `encoding: 'base64'`.
 */

const BINARY_EXT = /\.(png|jpe?g|gif|webp|ico)$/i;

/** Files whose VFS content is base64 rather than text (see module note). */
export function isBinaryFilePath(path: string): boolean {
  return BINARY_EXT.test(path);
}

const now = () => Date.now();

function entryOf(path: string, content: string, language: string): FileEntry {
  return { path, content, language, createdAt: now(), updatedAt: now() };
}

/** Deterministic hue from the project name — same name, same icon. */
function hashHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % 360;
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function iconColors(name: string): { theme: string; deep: string } {
  const hue = hashHue(name.trim().toLowerCase() || 'community tool');
  return { theme: hslToHex(hue, 52, 42), deep: hslToHex(hue, 56, 30) };
}

/** Up to two initials from the name's first meaningful words. */
function initialsOf(name: string): string {
  const words = name
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w.length > 0 && !/^(the|a|an|of|for|our|my)$/i.test(w));
  const source = words.length > 0 ? words : [name.trim() || 'App'];
  return source
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');
}

/** Draw the icon at `size` px; returns bare base64 (no data: prefix). */
function drawIconBase64(name: string, size: number): string {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');

  const { theme, deep } = iconColors(name);
  const gradient = ctx.createLinearGradient(0, 0, 0, size);
  gradient.addColorStop(0, theme);
  gradient.addColorStop(1, deep);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Initials stay within the central ~50% so Android's maskable crop
  // (circle, squircle) never clips them; iOS rounds the corners itself.
  const initials = initialsOf(name);
  ctx.fillStyle = '#ffffff';
  ctx.font = `600 ${Math.round(size * (initials.length > 1 ? 0.4 : 0.5))}px system-ui, -apple-system, 'Segoe UI', sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(initials, size / 2, size / 2 + size * 0.03);

  return canvas.toDataURL('image/png').split(',')[1];
}

function buildManifest(name: string): string {
  const { theme } = iconColors(name);
  const shortName = name.length <= 12 ? name : (name.split(/\s+/)[0] || name).slice(0, 12);
  return JSON.stringify(
    {
      name,
      short_name: shortName,
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: theme,
      theme_color: theme,
      icons: [
        { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
      ],
    },
    null,
    2,
  );
}

const strip = (p: string) => p.replace(/^\//, '');

/**
 * Ensure a publishable file set carries home-screen icons: generated icon
 * PNGs, a manifest, and the index.html links that activate them. Anything
 * the project already provides (its own manifest, icons, theme-color) is
 * left alone. Idempotent; returns the files unchanged when there's no
 * index.html or no DOM to draw with.
 */
export function withAppIcons(files: FileEntry[], projectName: string): FileEntry[] {
  const indexIdx = files.findIndex(f => strip(f.path) === 'index.html');
  if (indexIdx === -1 || typeof document === 'undefined') return files;

  const name = projectName.trim() || 'Community App';
  const has = (path: string) => files.some(f => strip(f.path) === path);
  let html = files[indexIdx].content;
  const headBits: string[] = [];
  const added: FileEntry[] = [];

  let icons192 = false;
  const ensureIcon = (path: string, size: number): boolean => {
    if (has(path)) return true;
    try {
      added.push(entryOf('/' + path, drawIconBase64(name, size), 'base64'));
      return true;
    } catch {
      return false;
    }
  };

  // Android / Chromium: web app manifest. The project's own manifest file
  // gets linked as-is; otherwise we generate one alongside the icons.
  if (!/rel=["']manifest["']/i.test(html)) {
    const ownManifest = ['manifest.webmanifest', 'manifest.json'].find(has);
    if (ownManifest) {
      headBits.push(`<link rel="manifest" href="./${ownManifest}">`);
    } else if (ensureIcon('icons/icon-192.png', 192) && ensureIcon('icons/icon-512.png', 512)) {
      icons192 = true;
      added.push(entryOf('/manifest.webmanifest', buildManifest(name), 'json'));
      headBits.push(`<link rel="manifest" href="./manifest.webmanifest">`);
    }
  }

  // iOS: apple-touch-icon (a real PNG URL — SVG and manifest icons don't
  // count for the home screen), plus the label the shortcut is named with
  if (!/rel=["']apple-touch-icon/i.test(html) && ensureIcon('icons/apple-touch-icon.png', 180)) {
    headBits.push(`<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">`);
  }
  if (!/name=["']apple-mobile-web-app-title["']/i.test(html)) {
    headBits.push(`<meta name="apple-mobile-web-app-title" content="${name.replace(/"/g, '&quot;')}">`);
  }

  if (!/name=["']theme-color["']/i.test(html)) {
    headBits.push(`<meta name="theme-color" content="${iconColors(name).theme}">`);
  }

  // Browser-tab favicon, riding the same 192px icon
  if (!/rel=["'](?:shortcut )?icon["']/i.test(html) && (icons192 || ensureIcon('icons/icon-192.png', 192))) {
    headBits.push(`<link rel="icon" type="image/png" href="./icons/icon-192.png">`);
  }

  if (headBits.length === 0 && added.length === 0) return files;

  const injection = headBits.join('\n');
  html = /<\/head>/i.test(html)
    ? html.replace(/<\/head>/i, `${injection}\n</head>`)
    : `${injection}\n${html}`;

  const out = files.slice();
  out[indexIdx] = { ...files[indexIdx], content: html, updatedAt: now() };
  return [...out, ...added];
}
