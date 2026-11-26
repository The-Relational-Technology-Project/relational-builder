/**
 * Saved versions, packed for storage.
 *
 * A version is a full copy of every file, but one version differs from the
 * next by a file or two. Stored as they are, ten versions cost ten projects
 * of browser storage, which is why only three used to survive a reload: a
 * builder who made one change and then asked twice for it back had already
 * pushed the original out. Packed, each distinct file content is stored once
 * and versions point into that pool, so forty versions cost little more than
 * one project plus what actually changed.
 */

import type { FileEntry } from '@/project/virtual-fs';
import type { Checkpoint } from '@/store/project-store';

interface PackedFile extends Omit<FileEntry, 'content'> {
  /** Index into the pool */
  c: number;
}

export interface CheckpointPack {
  pool: string[];
  checkpoints: (Omit<Checkpoint, 'files'> & { files: PackedFile[] })[];
}

export function packCheckpoints(checkpoints: Checkpoint[]): CheckpointPack {
  const pool: string[] = [];
  const seen = new Map<string, number>();
  return {
    checkpoints: checkpoints.map(({ files, ...rest }) => ({
      ...rest,
      files: files.map(({ content, ...file }) => {
        let c = seen.get(content);
        if (c === undefined) {
          c = pool.push(content) - 1;
          seen.set(content, c);
        }
        return { ...file, c };
      }),
    })),
    pool,
  };
}

/** Anything that is not a well-formed pack comes back as no versions, never a throw */
export function unpackCheckpoints(pack: unknown): Checkpoint[] {
  const p = pack as Partial<CheckpointPack> | null;
  if (!p || !Array.isArray(p.pool) || !Array.isArray(p.checkpoints)) return [];
  const pool = p.pool;
  return p.checkpoints
    .filter(c => Array.isArray(c?.files) && c.files.every(f => typeof pool[f.c] === 'string'))
    .map(({ files, ...rest }) => ({
      ...rest,
      files: files.map(({ c, ...file }) => ({ ...file, content: pool[c] })),
    }));
}
