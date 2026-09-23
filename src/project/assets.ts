import { fileToDataUrl } from '@/lib/image';
import { useProjectStore } from '@/store/project-store';
import { detectPreviewKind } from '@/preview/detect';
import type { FileEntry } from '@/project/virtual-fs';

/**
 * Photo assets — the builder's own real, local images in their apps.
 *
 * Images ride as self-registering text modules (assets/<name>.js holding a
 * compressed data-URI), so they work everywhere the project goes with zero
 * server changes: Sandpack preview, zip export, Community Hosting,
 * Netlify/Vercel. Apps reference them declaratively:
 *
 *   <script src="./assets/<name>.js"></script>
 *   <img data-asset="<name>" alt="...">
 */

/** Keep each asset under Community Hosting's 512KB/file cap, with headroom
 * for the module wrapper around the data URL */
const MAX_ASSET_BYTES = 480 * 1024;

/** Size/quality ladder, walked until the encoded image fits the cap. The top
 * rung keeps real photos crisp on phones; the lower rungs trade fidelity for
 * getting large screenshots and posters in at all. */
const COMPRESSION_LADDER: ReadonlyArray<readonly [number, number]> = [
  [1600, 0.8],
  [1400, 0.72],
  [1200, 0.65],
  [1000, 0.6],
  [800, 0.55],
];

export interface AddedAsset {
  name: string;
  path: string;
  bytes: number;
}

function slugify(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'photo';
}

function assetModule(name: string, dataUrl: string): string {
  return [
    `// Photo asset "${name}" — added by the builder (their own real, local image).`,
    '// Use it in any page with:',
    `//   <script src="./assets/${name}.js"></script>`,
    `//   <img data-asset="${name}" alt="describe the photo">`,
    `window.ASSETS = Object.assign(window.ASSETS || {}, { ${JSON.stringify(name)}: ${JSON.stringify(dataUrl)} });`,
    '(function () {',
    `  function apply() { document.querySelectorAll('img[data-asset=${JSON.stringify(name)}]').forEach(function (img) { img.src = window.ASSETS[${JSON.stringify(name)}]; }); }`,
    "  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply); else apply();",
    '})();',
    '',
  ].join('\n');
}

/** Compress a photo down the ladder to a data URL that fits the asset cap. */
export async function compressToDataUrl(file: File): Promise<string> {
  for (const [maxEdge, quality] of COMPRESSION_LADDER) {
    const candidate = await fileToDataUrl(file, maxEdge, quality);
    if (candidate.length <= MAX_ASSET_BYTES) return candidate;
  }
  throw new Error('That image is too large even after compression — try a smaller crop');
}

/**
 * Swap the photo behind an existing asset name — same name, same
 * references, new picture. Callers checkpoint first.
 */
export function replacePhotoAsset(name: string, dataUrl: string): boolean {
  const store = useProjectStore.getState();
  const existing = store
    .getAllFiles()
    .find(f => f.path.replace(/^\//, '') === `assets/${name}.js`);
  if (!existing) return false;
  store.writeFile(existing.path, assetModule(name, dataUrl), 'js');
  return true;
}

/**
 * Add an already-compressed photo (see `compressToDataUrl`) to the project as
 * assets/<name>.js. `nameHint` is the original file name; the asset name is
 * its slug, suffixed if the project already has one by that name.
 */
export function addPhotoAssetFromDataUrl(dataUrl: string, nameHint: string): AddedAsset {
  const store = useProjectStore.getState();
  let name = slugify(nameHint);
  // Avoid clobbering an existing asset with the same name
  const existing = new Set(store.getAllFiles().map(f => f.path.replace(/^\//, '')));
  let candidate = name;
  let n = 2;
  while (existing.has(`assets/${candidate}.js`)) {
    candidate = `${name}-${n++}`;
  }
  name = candidate;

  const path = `assets/${name}.js`;
  store.writeFile(path, assetModule(name, dataUrl), 'js');
  return { name, path, bytes: dataUrl.length };
}

/** Compress and add a photo to the project as assets/<name>.js */
export async function addPhotoAsset(file: File): Promise<AddedAsset> {
  const dataUrl = await compressToDataUrl(file);
  return addPhotoAssetFromDataUrl(dataUrl, file.name);
}

/** Asset name behind an `assets/<name>.js` path */
export function photoAssetName(path: string): string {
  return path.replace(/^\/?assets\//, '').replace(/\.js$/, '');
}

/**
 * The wiring instructions handed to the AI when a photo lands, whichever
 * door it came through (a photo attached to a chat message, Add photo in
 * the Files tab, a generated image). Two things a static template got wrong
 * in a real build: it told the AI to add a `<script src>` tag (only right for
 * plain HTML pages — framework apps inline asset modules automatically, and
 * the AI had to spend its reply correcting us), and it said nothing about
 * placeholder slots the build had already left waiting, so a photo named
 * "mural-art" sat beside an empty slot named "mural" until the person
 * reconciled them by hand.
 */
export function photoWiringNote(asset: AddedAsset, files: FileEntry[]): string {
  const kind = detectPreviewKind(files);

  // Placeholder slots already in the app with no matching asset behind them
  const assetNames = new Set(
    files.filter(f => isPhotoAssetPath(f.path)).map(f => photoAssetName(f.path)),
  );
  const emptySlots = new Set<string>();
  for (const f of files) {
    if (isPhotoAssetPath(f.path)) continue;
    for (const m of f.content.matchAll(/data-asset=["']([\w-]+)["']/g)) {
      if (!assetNames.has(m[1])) emptySlots.add(m[1]);
    }
  }

  const wiring =
    kind === 'framework'
      ? `add <img data-asset="${asset.name}" alt="..."> where it belongs (no script tag — the builder loads photo assets automatically in this app)`
      : `include <script src="./${asset.path}"></script> and <img data-asset="${asset.name}" alt="...">`;
  const slotNote =
    emptySlots.size > 0
      ? ` The app already has empty photo slots waiting (${[...emptySlots].join(', ')}) — if this photo belongs in one of them, change that slot's data-asset to "${asset.name}" instead of adding a new img.`
      : '';
  return `Use it where it fits: ${wiring}.${slotNote}`;
}

/**
 * The note that rides with a chat message whose attached photos were stored
 * in the project. The person's own words say where each photo goes; this
 * says what the file is called and how to reference it, so the model never
 * has to guess a path or invent an image.
 */
export function attachedPhotosNote(assets: AddedAsset[], files: FileEntry[]): string {
  const lines = assets.map((a, i) => {
    const which = assets.length > 1 ? `Attached photo ${i + 1}` : 'The attached photo';
    return `${which} is now stored in this project as the asset "${a.name}" (file ${a.path}) — the builder's own real image, not a mockup. ${photoWiringNote(a, files)}`;
  });
  return `[${lines.join(' ')} Put it where the message above asks; if the message doesn't say, choose the most fitting place and say where it went. Never re-output the asset file.]`;
}

/** Asset modules are mostly base64 — never worth showing the AI in full */
export function isPhotoAssetPath(path: string): boolean {
  return /^\/?assets\/[\w-]+\.js$/.test(path);
}

/**
 * Shrink an oversized repo image (bare base64) under `maxBytes` by
 * re-encoding through the same ladder builder photo uploads use. Returns
 * bare base64, or null when the bytes don't decode as an image or won't fit
 * even at the smallest rung. The re-encoded bytes may be JPEG behind a .png
 * path — fine for previews, where browsers sniff content, and these entries
 * never push back to the repo (the repo keeps its original files).
 */
export async function compressBase64Image(
  base64: string,
  mime: string,
  maxBytes: number,
): Promise<string | null> {
  let bytes: Uint8Array<ArrayBuffer>;
  try {
    const bin = atob(base64);
    bytes = new Uint8Array(new ArrayBuffer(bin.length));
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } catch {
    return null;
  }
  const file = new File([bytes], 'image', { type: mime });
  for (const [maxEdge, quality] of COMPRESSION_LADDER) {
    try {
      const dataUrl = await fileToDataUrl(file, maxEdge, quality);
      const b64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      if (b64.length * 0.75 <= maxBytes) return b64;
    } catch {
      return null; // not decodable as an image (or canvas unavailable)
    }
  }
  return null;
}
