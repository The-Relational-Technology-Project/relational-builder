import { useProjectStore } from '@/store/project-store';

/**
 * Data files — the builder's real records, added as files the app loads at
 * runtime. A parcel export, a spreadsheet of sites saved as CSV, a GeoJSON
 * layer. They live in the project under /data/ (so preview, publish, zip
 * and repo all carry them) but the model never types them: the snapshot
 * shows a large data file as a one-line description (see snapshot-split),
 * and the prompt says to load it, never re-output it.
 *
 * This is the other half of reference documents (project/references): a
 * reference is read for context and stays out of the app; a data file IS
 * the app's data and ships with it.
 */

export type DataKind = 'json' | 'geojson' | 'csv';

/** Past this, a browser-only app is the wrong shape (and localStorage the
 *  wrong store) — that's a database's job (Community Cloud). */
const MAX_DATA_BYTES = 4 * 1024 * 1024;

/** Community Hosting refuses files over this; Netlify/Vercel don't mind */
export const HOSTING_FILE_CAP_BYTES = 512 * 1024;

/** A data file this long is described, not inlined, in the prompt */
export const DATA_INLINE_CHARS = 6000;

export const DATA_ACCEPT = '.json,.geojson,.csv,application/json,application/geo+json,text/csv';

export function dataKindFor(file: File): DataKind | null {
  const ext = file.name.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? '';
  if (ext === 'json') return 'json';
  if (ext === 'geojson') return 'geojson';
  if (ext === 'csv') return 'csv';
  if (file.type === 'application/json') return 'json';
  if (file.type === 'application/geo+json') return 'geojson';
  if (file.type === 'text/csv') return 'csv';
  return null;
}

export function isDataFile(file: File): boolean {
  return dataKindFor(file) !== null;
}

/** Project paths that get the data-file treatment */
export const DATA_PATH_RE = /^\/?data\/[^/]+\.(json|geojson|csv)$/i;

export function isDataPath(path: string): boolean {
  return DATA_PATH_RE.test(path);
}

function slugify(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'data';
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

/** Split one CSV line — quotes and escaped quotes, nothing fancier */
function csvCells(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { cells.push(cur); cur = ''; }
    else cur += ch;
  }
  cells.push(cur);
  return cells.map(c => c.trim());
}

/**
 * One line that tells the model what's in a data file without showing it:
 * shape, count, keys, and a first record. Shared by the upload notice, the
 * drafted chat line, and the prompt snapshot.
 */
export function describeDataFile(path: string, content: string): string {
  const kb = Math.max(1, Math.round(content.length / 1024));
  if (/\.csv$/i.test(path)) {
    const lines = content.split(/\r?\n/).filter(l => l.trim());
    const header = lines[0] ? csvCells(lines[0]) : [];
    const first = lines[1] ? csvCells(lines[1]) : [];
    return `CSV, ${Math.max(0, lines.length - 1)} rows, ~${kb} KB; columns: ${clip(header.join(', '), 240)}${first.length ? `; first row: ${clip(first.join(' | '), 200)}` : ''}`;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return `${/\.geojson$/i.test(path) ? 'GeoJSON' : 'JSON'} (~${kb} KB; does not parse as JSON — check the file)`;
  }
  const describeRecord = (rec: unknown) =>
    rec && typeof rec === 'object' ? clip(JSON.stringify(rec), 260) : clip(JSON.stringify(rec), 80);
  if (Array.isArray(parsed)) {
    const first = parsed[0];
    const keys = first && typeof first === 'object' && !Array.isArray(first) ? Object.keys(first as object) : [];
    return `JSON array of ${parsed.length} records, ~${kb} KB${keys.length ? `; keys: ${clip(keys.join(', '), 240)}` : ''}${parsed.length ? `; first record: ${describeRecord(first)}` : ''}`;
  }
  if (parsed && typeof parsed === 'object') {
    const obj = parsed as Record<string, unknown>;
    if (obj.type === 'FeatureCollection' && Array.isArray(obj.features)) {
      const feats = obj.features as Array<{ geometry?: { type?: string }; properties?: Record<string, unknown> }>;
      const geoms = [...new Set(feats.map(f => f.geometry?.type).filter(Boolean))].join('/');
      const props = feats[0]?.properties ? Object.keys(feats[0].properties) : [];
      return `GeoJSON FeatureCollection, ${feats.length} features${geoms ? ` (${geoms})` : ''}, ~${kb} KB${props.length ? `; property keys: ${clip(props.join(', '), 240)}` : ''}${feats[0]?.properties ? `; first feature's properties: ${describeRecord(feats[0].properties)}` : ''}`;
    }
    const keys = Object.keys(obj).map(k => {
      const v = obj[k];
      return Array.isArray(v) ? `${k} (array of ${v.length})` : k;
    });
    return `JSON object, ~${kb} KB; top-level keys: ${clip(keys.join(', '), 280)}`;
  }
  return `JSON value (${typeof parsed}), ~${kb} KB`;
}

/** How an app should read a data file — both engines, so the model picks
 *  the one matching the app it is building. */
export function dataLoadHint(path: string): string {
  const rel = path.replace(/^\//, '');
  const name = rel.replace(/^data\//, '').replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]+/g, '_');
  if (/\.csv$/i.test(path)) {
    return `plain HTML apps: \`fetch('./${rel}').then(r => r.text())\` then split lines and commas; framework apps: \`import ${name}Csv from '../${rel}'\` (relative to the importing file; it arrives as a string)`;
  }
  return `plain HTML apps: \`fetch('./${rel}').then(r => r.json())\`; framework apps: \`import ${name} from '../${rel}'\` (relative to the importing file — from /src/pages/X.tsx it is '../../${rel}')`;
}

export interface AddedDataFile {
  path: string;
  kind: DataKind;
  bytes: number;
  summary: string;
  /** Larger than Community Hosting allows per file */
  overHostingCap: boolean;
}

/** Validate, write into the project under /data/, and describe. */
export async function addDataFile(file: File): Promise<AddedDataFile> {
  const kind = dataKindFor(file);
  if (!kind) throw new Error('Add a JSON, GeoJSON, or CSV file.');
  if (file.size > MAX_DATA_BYTES) {
    throw new Error(
      `That file is ${Math.round(file.size / 1024 / 1024)} MB — too big to ship inside a browser app. Data this size belongs in Community Cloud (a database the app queries); ask the Builder to set that up.`,
    );
  }
  let content = await file.text();
  if (kind !== 'csv') {
    try {
      const parsed = JSON.parse(content);
      // Normalize spacing so the file is compact and stable
      content = JSON.stringify(parsed, null, 1);
    } catch (e) {
      throw new Error(`That file isn't valid JSON — ${e instanceof Error ? e.message : 'could not parse it'}.`);
    }
  } else if (!content.trim()) {
    throw new Error('That CSV file is empty.');
  }
  const project = useProjectStore.getState();
  const base = slugify(file.name);
  let path = `/data/${base}.${kind}`;
  // Never silently overwrite a file already there under the same name
  for (let i = 2; project.fs.getFile(path); i++) path = `/data/${base}-${i}.${kind}`;
  project.writeFile(path, content, kind === 'csv' ? 'csv' : 'json');
  return {
    path,
    kind,
    bytes: content.length,
    summary: describeDataFile(path, content),
    overHostingCap: content.length > HOSTING_FILE_CAP_BYTES,
  };
}
