import { describe, it, expect } from 'vitest';
import { appDataExportFiles, collectionFileName } from './export-data';
import type { CloudExportDocument } from '@/cloud/community-cloud';

const doc = (over: Partial<CloudExportDocument> & { collection: string }): CloudExportDocument => ({
  id: 'd1',
  data: { title: 'Gate meeting', when: '2026-10-03' },
  member_id: null,
  member_name: 'Mara',
  visibility: 'public',
  created_at: '2026-10-03T10:00:00Z',
  updated_at: '2026-10-03T10:00:00Z',
  ...over,
} as CloudExportDocument);

const sample = {
  app: { id: 'app_1', name: 'Garden Notes' },
  exported_at: '2026-10-30T11:30:00Z',
  collections: [{ name: 'notes', spec: { fields: [] }, version: 1 }],
  members: [{ id: 'm1', email: 'mara@example.org', name: 'Mara', created_at: '2026-09-01T00:00:00Z' }],
  documents: [
    doc({ id: 'd1', collection: 'notes' }),
    doc({ id: 'd2', collection: 'notes', data: { title: 'Compost', when: '2026-10-10' } }),
    doc({ id: 'd3', collection: 'Ride Offers!', data: { seats: 3 } }),
  ],
};

describe('appDataExportFiles', () => {
  it('writes one JSON, one CSV per collection, and a README, under /data/export', () => {
    const files = appDataExportFiles(sample);
    expect(files.map(f => f.path)).toEqual([
      '/data/export/app-data.json',
      '/data/export/notes.csv',
      '/data/export/ride-offers.csv',
      '/data/export/README.md',
    ]);
  });

  it('keeps every document and collection spec, and names members without their email', () => {
    const json = JSON.parse(appDataExportFiles(sample)[0].content);
    expect(json.documents).toHaveLength(3);
    expect(json.collections[0].name).toBe('notes');
    expect(json.members).toEqual([{ id: 'm1', name: 'Mara', created_at: '2026-09-01T00:00:00Z' }]);
    expect(JSON.stringify(json)).not.toContain('mara@example.org');
  });

  it('puts the right rows in each CSV', () => {
    const files = appDataExportFiles(sample);
    const notes = files.find(f => f.path.endsWith('notes.csv'))!.content;
    expect(notes).toContain('Gate meeting');
    expect(notes).toContain('Compost');
    expect(notes).not.toContain('seats');
    const rides = files.find(f => f.path.endsWith('ride-offers.csv'))!.content;
    expect(rides).toContain('3');
  });

  it('says in the README what is there and that delete is real', () => {
    const readme = appDataExportFiles(sample).at(-1)!.content;
    expect(readme).toMatch(/`notes.csv`: the `notes` collection \(2 rows\)/);
    expect(readme).toMatch(/email\s+addresses are not exported/);
    expect(readme).toMatch(/removes the app and all of this data/);
  });

  it('still writes a CSV for a declared collection with no documents', () => {
    const files = appDataExportFiles({ ...sample, documents: [] });
    expect(files.map(f => f.path)).toContain('/data/export/notes.csv');
  });
});

describe('collectionFileName', () => {
  it('makes a safe, readable file name', () => {
    expect(collectionFileName('Ride Offers!')).toBe('ride-offers');
    expect(collectionFileName('   ')).toBe('collection');
  });
});
