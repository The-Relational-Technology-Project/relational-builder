import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { checkImports } from '@/project/import-check';
import { KIT_FILES } from '@/kit';

const ROOT = path.join(__dirname, '..', 'fixtures', 'clean');

function readTree(dir: string, base = dir, out: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) readTree(p, base, out);
    else out['/' + path.relative(base, p).split(path.sep).join('/')] = readFileSync(p, 'utf8');
  }
  return out;
}

const builds = readdirSync(ROOT).filter(n => statSync(path.join(ROOT, n)).isDirectory());

describe('static checks on builds known to work', () => {
  it('has fixtures', () => {
    expect(builds.length).toBeGreaterThanOrEqual(3);
  });
  for (const name of builds) {
    it(`finds nothing in ${name}`, () => {
      expect(checkImports(readTree(path.join(ROOT, name)), { kitFiles: KIT_FILES })).toEqual([]);
    });
  }
});
