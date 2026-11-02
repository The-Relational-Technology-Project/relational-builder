import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/cloud/community-cloud', () => ({
  exportBackend: vi.fn(),
  deleteApp: vi.fn(),
  documentsToCsv: (docs: Array<{ data: Record<string, unknown> }>) => docs.map(d => JSON.stringify(d.data)).join('\n'),
}));
vi.mock('@/store/cloud-store', () => ({
  useCloudStore: { getState: () => ({ currentProjectId: 'p-open' }) },
}));
vi.mock('@/store/env-store', () => {
  const state = {
    vars: [{ key: 'APP_ID', value: 'app_open', isSecret: false }],
    stash: { 'p-other': [{ key: 'APP_ID', value: 'app_other', isSecret: false }], 'p-none': [] },
  };
  return { useEnvStore: { getState: () => state } };
});

import { appIdIn, appIdForProject, appDataFilesForExport, deleteAppForProject, describeDelete } from './data-export';

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => vi.stubEnv('VITE_HUMAN_SCALE', '1'));

describe('appIdForProject', () => {
  it('reads the live vars for the open project and the stash for others', () => {
    expect(appIdIn([])).toBeNull();
    expect(appIdForProject('p-open')).toBe('app_open');
    expect(appIdForProject(null)).toBe('app_open');
    expect(appIdForProject('p-other')).toBe('app_other');
    expect(appIdForProject('p-none')).toBeNull();
    expect(appIdForProject('p-unknown')).toBeNull();
  });
});

describe('appDataFilesForExport', () => {
  const sample = {
    app: { id: 'app_open', name: 'Garden' }, exported_at: '2026-11-02T00:00:00Z',
    collections: [{ name: 'notes', spec: {}, version: 1 }], members: [],
    documents: [{ id: 'd1', collection: 'notes', data: { t: 'hi' }, member_id: null, member_name: null, visibility: 'public', created_at: '', updated_at: '' }],
  };

  it('adds the data files under /data/export when the flag is on and the app exists', async () => {
    const files = await appDataFilesForExport(async () => sample as never);
    expect(files.map(f => f.path)).toEqual(['/data/export/app-data.json', '/data/export/notes.csv', '/data/export/README.md']);
    expect(files[0].language).toBe('json');
  });

  it('is empty with the flag off, and when the pull fails', async () => {
    vi.stubEnv('VITE_HUMAN_SCALE', '0');
    expect(await appDataFilesForExport(async () => sample as never)).toEqual([]);
    vi.stubEnv('VITE_HUMAN_SCALE', '1');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(await appDataFilesForExport(async () => { throw new Error('offline'); })).toEqual([]);
    warn.mockRestore();
  });
});

describe('deleteAppForProject and describeDelete', () => {
  it('deletes the app the project names, and only with the flag on', async () => {
    const remove = vi.fn(async () => ({ ok: true }));
    expect(await deleteAppForProject('p-other', remove)).toBe(true);
    expect(remove).toHaveBeenCalledWith('app_other');
    expect(await deleteAppForProject('p-none', remove)).toBe(false);
    vi.stubEnv('VITE_HUMAN_SCALE', '0');
    expect(await deleteAppForProject('p-other', remove)).toBe(false);
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('says what goes', () => {
    expect(describeDelete('Garden', null)).toMatch(/^Delete "Garden"\?/);
    expect(describeDelete('Garden', { name: 'Garden app', documents: 212 })).toMatch(/212 documents neighbors wrote/);
  });
});
