import { describe, expect, it } from 'vitest';
import { OTHER_REFERENCE, OTHER_NOTE, SAME_NOTE, userContent } from './reference';

const P = 'Build a thing.';

describe('reference arms', () => {
  it('leaves the prompt alone with no arm', () => {
    expect(userContent('hs-community-fridge', P, null)).toBe(P);
  });
  it('spec appends the written spec as text', () => {
    const c = userContent('hs-community-fridge', P, 'spec');
    expect(typeof c).toBe('string');
    expect(c as string).toContain('## UI spec');
    expect(c as string).toContain('Judah St Fridge');
  });
  it('same attaches this prompt\'s screenshot with the remix wording', () => {
    const c = userContent('hs-listening-wall', P, 'same') as Array<{ type: string; text?: string; image_url?: { url: string } }>;
    expect(c[0].text).toContain(SAME_NOTE);
    expect(c[1].image_url?.url.startsWith('data:image/png;base64,')).toBe(true);
  });
  it('both carries spec and screenshot', () => {
    const c = userContent('hs-ballot-guide', P, 'both') as Array<{ type: string; text?: string }>;
    expect(c[0].text).toContain('## UI spec');
    expect(c[1].type).toBe('image_url');
  });
  it('other shows a different subject, never its own', () => {
    for (const [task, other] of Object.entries(OTHER_REFERENCE)) {
      expect(other).not.toBe(task);
      const c = userContent(task, P, 'other') as Array<{ type: string; text?: string }>;
      expect(c[0].text).toContain(OTHER_NOTE);
      expect(c[0].text).not.toContain('## UI spec');
    }
  });
});

describe('library arm', () => {
  it('attaches the Builder\'s pick with its wording', () => {
    const c = userContent('hs-ballot-guide', 'Build a ballot guide for our neighborhood, a guide to how to vote.', 'library') as Array<{ type: string; text?: string }>;
    expect(c[0].text).toContain("reference screen from the Builder's library");
    expect(c[0].text).not.toContain('a plain-language guide with logistics');
    expect(c[1].type).toBe('image_url');
  });
});
