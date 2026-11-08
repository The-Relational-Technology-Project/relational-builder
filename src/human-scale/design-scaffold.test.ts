import { afterEach, describe, expect, it } from 'vitest';
import { VISUAL_DIRECTIONS, contrastRatio, designScaffoldPrompt, designScaffoldVariant } from './design-scaffold';

afterEach(() => {
  delete process.env.BENCH_DESIGN_SCAFFOLD;
});

describe('design scaffolding', () => {
  it('defaults to direction (Josh, Nov 6) and still reads the bench control', () => {
    expect(designScaffoldVariant()).toBe('direction');
    process.env.BENCH_DESIGN_SCAFFOLD = 'none';
    expect(designScaffoldVariant()).toBe('none');
    process.env.BENCH_DESIGN_SCAFFOLD = 'nonsense';
    expect(designScaffoldVariant()).toBe('direction');
  });

  it('none adds nothing; recipe and direction add their blocks', () => {
    expect(designScaffoldPrompt('none')).toBe('');
    expect(designScaffoldPrompt('recipe')).toContain('Design recipe');
    expect(designScaffoldPrompt('recipe')).not.toContain('Visual directions');
    const d = designScaffoldPrompt('direction');
    expect(d).toContain('Design recipe');
    for (const v of VISUAL_DIRECTIONS) expect(d).toContain(v.name);
    const r = designScaffoldPrompt('reference');
    expect(r.startsWith(d)).toBe(true);
    expect(r).toContain('Reference first screens');
    expect(d).not.toContain('Reference first screens');
    expect(d).toContain('Finished, not tidy');
  });

  it('every direction meets 4.5:1 for its text pairings', () => {
    for (const v of VISUAL_DIRECTIONS) {
      const t = v.tokens;
      const pairs: Array<[string, string, string]> = [
        ['foreground on background', t.foreground, t.background],
        ['foreground on card', t.foreground, t.card],
        ['muted-foreground on background', t.mutedForeground, t.background],
        ['muted-foreground on muted', t.mutedForeground, t.muted],
        ['primary-foreground on primary', t.primaryForeground, t.primary],
        ['secondary-foreground on secondary', t.secondaryForeground, t.secondary],
        ['accent-foreground on accent', t.accentForeground, t.accent],
      ];
      for (const [what, fg, bg] of pairs) {
        expect(contrastRatio(fg, bg), `${v.name}: ${what}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
