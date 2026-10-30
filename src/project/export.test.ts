import { describe, it, expect } from 'vitest';
import { generateManifest } from './export';

describe('generateManifest runtime block', () => {
  it('writes no runtime block when the project has none (today\'s manifest, byte for byte)', () => {
    const before = generateManifest('Block Library', null, null);
    const withNull = generateManifest('Block Library', null, null, null);
    expect(withNull).toBe(before);
    expect(before).not.toContain('runtime:');
  });

  it('writes the runtime between lineage and prompt', () => {
    const yml = generateManifest(
      'Block Library',
      { source: 'prompt', promptTitle: 'A lending library' },
      { title: 'A lending library', body: 'Neighbors lend tools.' },
      { kind: 'local', endpoint: 'http://localhost:11434/v1', model: 'qwen2.5:7b', fallback: 'community' },
    );
    const lineage = yml.indexOf('lineage:');
    const runtime = yml.indexOf('runtime:');
    const prompt = yml.indexOf('\nprompt:');
    expect(lineage).toBeGreaterThan(-1);
    expect(runtime).toBeGreaterThan(lineage);
    expect(prompt).toBeGreaterThan(runtime);
    expect(yml).toContain('runtime:\n  kind: local\n  endpoint: "http://localhost:11434/v1"\n  model: "qwen2.5:7b"\n  fallback: community\n');
  });
});
