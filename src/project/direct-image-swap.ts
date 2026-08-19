/**
 * Direct photo swaps — replacing a picture shouldn't cost a model call.
 *
 * When the builder points at an image in the preview, we try to resolve it
 * to the exact place it comes from and swap it with a plain write:
 *
 * 1. `data-asset` images (the builder photo pipeline) — overwrite the
 *    asset module behind the name. Works in every preview engine.
 * 2. Tagged images (framework previews stamp `data-rb-source="file:line:col"`
 *    on every element) — read the `<img>` tag at that spot in source:
 *    - `src={imported}` or `src="./local.jpg"` → overwrite the image file
 *      in the project (same path, new bytes).
 *    - `src="data:…"` inline → replace the data URL in place.
 *    - `src="https://…"` remote → add the new photo to the project and
 *      rewrite the attribute to import it.
 *
 * Anything that doesn't resolve cleanly — dynamic sources, list-rendered
 * images, untagged previews — falls back to the AI path, with the chosen
 * photo riding along as an attachment so nothing is re-uploaded.
 */

import { useProjectStore } from '@/store/project-store';
import { resolveInVfs } from '@/preview/bundler/bundle';
import { compressToDataUrl, replacePhotoAsset } from './assets';

/** What the preview inspector reports about a clicked <img>. */
export interface ClickedImage {
  src: string;
  asset?: string;
  alt?: string;
  /** "path:line:col" from the preview's source tagger (framework apps) */
  source?: string;
}

type SwapPlan =
  | { kind: 'asset'; name: string }
  | { kind: 'image-file'; path: string }
  | { kind: 'inline-data'; path: string; valueStart: number; valueEnd: number }
  | { kind: 'attr-import'; path: string; attrStart: number; attrEnd: number };

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|ico)$/i;

/** VFS paths as the bundler sees them (leading slash) → store paths. */
function vfsView(): { files: Record<string, string>; storePath: Map<string, string> } {
  const files: Record<string, string> = {};
  const storePath = new Map<string, string>();
  for (const f of useProjectStore.getState().getAllFiles()) {
    const norm = f.path.startsWith('/') ? f.path : '/' + f.path;
    files[norm] = f.content;
    storePath.set(norm, f.path);
  }
  return { files, storePath };
}

function parseSourceTag(source: string): { path: string; line: number } | null {
  const m = source.match(/^(.+):(\d+):(\d+)$/);
  if (!m) return null;
  return { path: m[1].startsWith('/') ? m[1] : '/' + m[1], line: Number(m[2]) };
}

/** Offset of the start of a 1-based line. */
function lineOffset(content: string, line: number): number {
  let off = 0;
  for (let i = 1; i < line; i++) {
    const nl = content.indexOf('\n', off);
    if (nl === -1) return content.length;
    off = nl + 1;
  }
  return off;
}

/** End index of a JSX/HTML tag opened at `start`, honoring quotes and {}. */
function tagEnd(content: string, start: number): number {
  let quote: string | null = null;
  let brace = 0;
  for (let i = start; i < content.length; i++) {
    const c = content[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === '{') brace++;
    else if (c === '}') brace = Math.max(0, brace - 1);
    else if (c === '>' && brace === 0) return i;
  }
  return -1;
}

interface SrcAttr {
  /** Whole `src=...` value span including quotes/braces */
  start: number;
  end: number;
  /** 'string' | 'expr' with the inner text */
  form: 'string' | 'expr';
  value: string;
  /** Inner value span (inside the quotes/braces) */
  innerStart: number;
  innerEnd: number;
}

/** Find the src attribute inside the <img …> whose element starts the
 *  tagged line. Returns null when there's no unambiguous single img tag. */
function findImgSrc(content: string, line: number): SrcAttr | null {
  const lineStart = lineOffset(content, line);
  const nextLines = content.indexOf('\n', lineStart);
  const lineEnd = nextLines === -1 ? content.length : nextLines;
  const tagStart = content.indexOf('<img', lineStart);
  if (tagStart === -1 || tagStart > lineEnd) return null;
  // One img per tagged line keeps "which one?" unambiguous
  const second = content.indexOf('<img', tagStart + 4);
  if (second !== -1 && second <= lineEnd) return null;
  const end = tagEnd(content, tagStart);
  if (end === -1) return null;
  const tag = content.slice(tagStart, end + 1);
  const m = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)'|\{([^}]*)\})/);
  if (!m || m.index === undefined) return null;
  const valueToken = m[1];
  const start = tagStart + m.index + m[0].length - valueToken.length;
  const isExpr = valueToken.startsWith('{');
  const value = (m[2] ?? m[3] ?? m[4] ?? '').trim();
  return {
    start,
    end: start + valueToken.length,
    form: isExpr ? 'expr' : 'string',
    value,
    innerStart: start + 1,
    innerEnd: start + valueToken.length - 1,
  };
}

/** Resolve a source-relative or aliased image reference to a VFS path. */
function resolveImageRef(
  ref: string,
  fromPath: string,
  files: Record<string, string>,
): string | null {
  let path = ref;
  if (path.startsWith('@/')) path = '/src/' + path.slice(2);
  else if (path.startsWith('./') || path.startsWith('../')) {
    const base = fromPath.slice(0, fromPath.lastIndexOf('/'));
    const parts = (base + '/' + path).split('/');
    const out: string[] = [];
    for (const part of parts) {
      if (part === '' || part === '.') continue;
      if (part === '..') out.pop();
      else out.push(part);
    }
    path = '/' + out.join('/');
  }
  if (!path.startsWith('/')) return null;
  if (!IMAGE_EXT.test(path.replace(/\?[^?]*$/, ''))) return null;
  return resolveInVfs(files, path.replace(/\?[^?]*$/, ''));
}

/**
 * How this image can be swapped without a model call — or null when only
 * the AI can be trusted to place it.
 */
export function planImageSwap(img: ClickedImage): SwapPlan | null {
  const { files, storePath } = vfsView();

  // The builder photo pipeline: same name, new picture
  if (img.asset && storePath.has(`/assets/${img.asset}.js`)) {
    return { kind: 'asset', name: img.asset };
  }

  if (!img.source) return null;
  const loc = parseSourceTag(img.source);
  if (!loc) return null;
  const content = files[loc.path];
  if (content === undefined) return null;
  const src = findImgSrc(content, loc.line);
  if (!src) return null;
  const path = storePath.get(loc.path) ?? loc.path;

  if (src.form === 'string') {
    if (src.value.startsWith('data:')) {
      return { kind: 'inline-data', path, valueStart: src.innerStart, valueEnd: src.innerEnd };
    }
    const local = resolveImageRef(src.value, loc.path, files);
    if (local) {
      return { kind: 'image-file', path: storePath.get(local) ?? local };
    }
    // Remote URL or a path the project doesn't hold — bring the photo in
    return { kind: 'attr-import', path, attrStart: src.start, attrEnd: src.end };
  }

  // src={expr}: a plain identifier that a default import binds to an image
  const expr = src.value;
  if (/^[A-Za-z_$][\w$]*$/.test(expr)) {
    const im = content.match(
      new RegExp(String.raw`import\s+${expr}\s+from\s+['"]([^'"]+)['"]`),
    );
    const local = im && resolveImageRef(im[1], loc.path, files);
    if (local) return { kind: 'image-file', path: storePath.get(local) ?? local };
    return null;
  }
  // A string literal inside braces: src={'...'}
  const lit = expr.match(/^['"](.*)['"]$/);
  if (lit) {
    if (lit[1].startsWith('data:')) {
      const open = content.indexOf(lit[1], src.innerStart);
      if (open === -1) return null;
      return { kind: 'inline-data', path, valueStart: open, valueEnd: open + lit[1].length };
    }
    const local = resolveImageRef(lit[1], loc.path, files);
    if (local) return { kind: 'image-file', path: storePath.get(local) ?? local };
  }
  return null;
}

function slugify(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo';
}

function identFrom(slug: string, content: string): string {
  const words = slug.split('-').filter(Boolean);
  let base = words
    .map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1)))
    .join('')
    .replace(/^[0-9]/, 'p$&');
  if (!base.endsWith('Photo')) base += 'Photo';
  let ident = base;
  let n = 2;
  while (new RegExp(String.raw`\b${ident}\b`).test(content)) ident = `${base}${n++}`;
  return ident;
}

/** Where the new import line goes: after the last top-level import. */
function importInsertOffset(content: string): number {
  const re = /^import\b[^\n]*\n/gm;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) last = m.index + m[0].length;
  return last;
}

/**
 * Swap the pointed-at image for `file`. Re-plans at save time (a build may
 * have landed since the click) and checkpoints first, so undo covers photo
 * swaps exactly like AI changes. Returns false when the image can't be
 * placed safely — callers fall back to the AI path with the photo attached.
 */
export async function applyImageSwap(img: ClickedImage, file: File): Promise<boolean> {
  let dataUrl: string;
  try {
    dataUrl = await compressToDataUrl(file);
  } catch {
    return false;
  }
  const plan = planImageSwap(img);
  if (!plan) return false;

  const store = useProjectStore.getState();

  if (plan.kind === 'asset') {
    store.takeCheckpoint('Before photo swap');
    return replacePhotoAsset(plan.name, dataUrl);
  }

  const target = store.getFile(plan.path);
  if (!target) return false;

  if (plan.kind === 'image-file') {
    // Same path, new bytes — the bundler sniffs real content over extension
    store.takeCheckpoint('Before photo swap');
    store.writeFile(plan.path, dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
    return true;
  }

  if (plan.kind === 'inline-data') {
    store.takeCheckpoint('Before photo swap');
    store.writeFile(
      plan.path,
      target.content.slice(0, plan.valueStart) + dataUrl + target.content.slice(plan.valueEnd),
    );
    return true;
  }

  // attr-import: the photo joins the project, the attribute imports it
  const ext = dataUrl.startsWith('data:image/png') ? 'png' : 'jpg';
  const slug = slugify(file.name);
  const existing = new Set(store.getAllFiles().map(f => (f.path.startsWith('/') ? f.path : '/' + f.path)));
  let name = slug;
  let n = 2;
  while (existing.has(`/src/assets/${name}.${ext}`)) name = `${slug}-${n++}`;
  const imagePath = `/src/assets/${name}.${ext}`;

  const ident = identFrom(name, target.content);
  const importLine = `import ${ident} from '@/assets/${name}.${ext}';\n`;
  const at = importInsertOffset(target.content);
  const shift = at <= plan.attrStart ? importLine.length : 0;
  const withImport =
    target.content.slice(0, at) + importLine + target.content.slice(at);
  const rewritten =
    withImport.slice(0, plan.attrStart + shift) +
    `{${ident}}` +
    withImport.slice(plan.attrEnd + shift);

  store.takeCheckpoint('Before photo swap');
  store.writeFile(imagePath, dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  store.writeFile(plan.path, rewritten);
  return true;
}
