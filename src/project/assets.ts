import { fileToDataUrl } from '@/lib/image';
import { useProjectStore } from '@/store/project-store';

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

/** Keep each asset well under Community Hosting's 512KB/file cap */
const MAX_ASSET_BYTES = 380 * 1024;

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

/** Compress and add a photo to the project as assets/<name>.js */
export async function addPhotoAsset(file: File): Promise<AddedAsset> {
  // 1600px long edge keeps real photos crisp on phones while fitting caps
  let dataUrl = await fileToDataUrl(file, 1600);
  if (dataUrl.length > MAX_ASSET_BYTES) {
    dataUrl = await fileToDataUrl(file, 1000);
  }
  if (dataUrl.length > MAX_ASSET_BYTES) {
    throw new Error('That photo is too large even after compression — try a smaller crop');
  }

  const store = useProjectStore.getState();
  let name = slugify(file.name);
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

/** Asset modules are mostly base64 — never worth showing the AI in full */
export function isPhotoAssetPath(path: string): boolean {
  return /^\/?assets\/[\w-]+\.js$/.test(path);
}
