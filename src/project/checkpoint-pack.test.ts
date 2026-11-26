import { describe, it, expect } from 'vitest';
import { packCheckpoints, unpackCheckpoints } from './checkpoint-pack';
import type { Checkpoint } from '@/store/project-store';

const file = (path: string, content: string) => ({ path, content, language: 'html', createdAt: 1, updatedAt: 2 });
const big = 'x'.repeat(5000);
const versions: Checkpoint[] = Array.from({ length: 20 }, (_, i) => ({
  id: `ckpt-${i}`,
  msgId: `m${i}`,
  label: `Version ${i}`,
  timestamp: i,
  files: [file('/photo.js', big), file('/index.html', `<h1>${i}</h1>`)],
}));

describe('checkpoint pack', () => {
  it('round-trips exactly', () => {
    expect(unpackCheckpoints(JSON.parse(JSON.stringify(packCheckpoints(versions))))).toEqual(versions);
  });

  it('stores an unchanged file once', () => {
    const pack = packCheckpoints(versions);
    expect(pack.pool.filter(c => c === big)).toHaveLength(1);
    expect(JSON.stringify(pack).length).toBeLessThan(JSON.stringify(versions).length / 8);
  });

  it('returns no versions for a damaged pack', () => {
    expect(unpackCheckpoints(null)).toEqual([]);
    expect(unpackCheckpoints({ pool: [], checkpoints: [{ id: 'a', files: [{ path: '/a', c: 3 }] }] })).toEqual([]);
  });
});
