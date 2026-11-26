import { describe, it, expect } from 'vitest';
import { versionRef, parseVersionPointer, stripVersionPointer, findVersion } from './version-pointer';
import type { Checkpoint } from '@/store/project-store';

const ck = (id: string): Checkpoint => ({ id, msgId: null, label: id, timestamp: 0, files: [] });

describe('version pointer', () => {
  it('gives each kind of version a distinct short ref', () => {
    const refs = ['ckpt-1795666936968', 'ckpt-1795666936968-base', 'ckpt-1795666936969', 'ckpt-1795666936968-manual'].map(id => versionRef(ck(id)));
    expect(new Set(refs).size).toBe(4);
    for (const r of refs) expect(r).toMatch(/^[a-z0-9]{1,8}$/);
  });

  it('reads the pointer line however the model dresses it', () => {
    const ref = versionRef(ck('ckpt-1795666936968'));
    for (const line of [`REVERT-TO: ${ref}`, `\`REVERT-TO: ${ref}\``, `**REVERT-TO:** ${ref}`.replace('**REVERT-TO:**', 'REVERT-TO:'), `> revert-to: ${ref.toUpperCase()}`]) {
      expect(parseVersionPointer(`Go back to the one before the map.\n\n${line}`)).toBe(ref);
    }
  });

  it('is not fooled by prose', () => {
    expect(parseVersionPointer('You can revert to: the earlier version in History.')).toBeNull();
  });

  it('strips the line for display and finds the version', () => {
    const c = ck('ckpt-1795666936968');
    const ref = versionRef(c);
    expect(stripVersionPointer(`Pick this one.\n\nREVERT-TO: ${ref}\n`)).toBe('Pick this one.\n\n');
    expect(findVersion([ck('ckpt-1'), c], ref)).toBe(c);
    expect(findVersion([ck('ckpt-1')], ref)).toBeUndefined();
  });
});
