/**
 * Workstream 4, the data half of a complete export: the files that carry an
 * app's Community Cloud data out with its code, in open formats (JSON plus
 * one CSV per collection). Pure: takes the object `exportBackend` returns
 * (src/cloud/community-cloud.ts) and gives back files for the export zip.
 * Wiring into the zip and the delete path is the next step; this module is
 * what the tests prove.
 */

import { documentsToCsv, type CloudExportDocument } from '@/cloud/community-cloud';

export interface AppDataExport {
  app: { id: string; name: string };
  exported_at: string;
  collections: Array<{ name: string; spec?: unknown; version?: number }>;
  members: Array<{ id: string; email?: string | null; name?: string | null; created_at?: string }>;
  documents: CloudExportDocument[];
}

export interface ExportFile {
  path: string;
  content: string;
}

export const APP_DATA_EXPORT_DIR = '/data/export';

/** A safe file name for a collection: letters, digits, dashes, underscores */
export function collectionFileName(name: string): string {
  const safe = name.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return safe || 'collection';
}

/**
 * The files for the zip. Members are written without email addresses: an
 * export travels (a USB stick, a repo), and neighbors signed into an app did
 * not sign up to have their addresses copied around with its code. Their
 * names and join dates stay, so the record of who took part is kept.
 */
export function appDataExportFiles(data: AppDataExport): ExportFile[] {
  const byCollection = new Map<string, CloudExportDocument[]>();
  for (const doc of data.documents) {
    const list = byCollection.get(doc.collection) ?? [];
    list.push(doc);
    byCollection.set(doc.collection, list);
  }
  const names = [...new Set([...data.collections.map(c => c.name), ...byCollection.keys()])].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  const files: ExportFile[] = [];
  files.push({
    path: `${APP_DATA_EXPORT_DIR}/app-data.json`,
    content: JSON.stringify(
      {
        app: data.app,
        exported_at: data.exported_at,
        collections: data.collections,
        members: data.members.map(m => ({ id: m.id, name: m.name ?? null, created_at: m.created_at ?? null })),
        documents: data.documents,
      },
      null,
      2,
    ) + '\n',
  });
  const usedFileNames = new Set<string>();
  for (const name of names) {
    const docs = byCollection.get(name) ?? [];
    let file = collectionFileName(name);
    let n = 2;
    while (usedFileNames.has(file)) file = `${collectionFileName(name)}-${n++}`;
    usedFileNames.add(file);
    files.push({ path: `${APP_DATA_EXPORT_DIR}/${file}.csv`, content: documentsToCsv(docs) });
  }
  files.push({
    path: `${APP_DATA_EXPORT_DIR}/README.md`,
    content: [
      `# ${data.app.name}: the app's data`,
      '',
      `Exported ${data.exported_at.slice(0, 10)} from Community Cloud (app id \`${data.app.id}\`).`,
      'Everything the app stored is here, in open formats, so it can move to any other',
      'backend or be read without one:',
      '',
      '- `app-data.json`: every document with its collection, visibility, who wrote it',
      '  and when; the collection specs; and the members (names and join dates; email',
      '  addresses are not exported).',
      ...names.map(name => `- \`${collectionFileName(name)}.csv\`: the \`${name}\` collection (${(byCollection.get(name) ?? []).length} rows), one row per document, data keys as columns.`),
      '',
      'This export is complete as of the date above. Deleting the project in Relational',
      'Builder removes the app and all of this data from Community Cloud; this folder is',
      'then the only copy.',
      '',
    ].join('\n'),
  });
  return files;
}
