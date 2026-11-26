import { describe, it, expect } from 'vitest';
import { assessNoChange } from './no-change';

const none = { attempted: 0, changed: 0, warnings: [] };

describe('assessNoChange', () => {
  it('says nothing when files changed', () => {
    expect(assessNoChange('**What changed**\n- a map', { attempted: 1, changed: 1, warnings: [] }, true)).toBeNull();
  });

  it('says nothing about a plain answer with no claim', () => {
    expect(assessNoChange('The map lives on the Land page. Want it moved?', none, true)).toBeNull();
  });

  it('catches a summary with no code and retries once', () => {
    const r = assessNoChange('Adding the map now.\n\n**What changed**\n- The Land page shows a map', none, true);
    expect(r?.kind).toBe('described');
    expect(r?.retryPrompt).toBeTruthy();
    expect(assessNoChange('**What changed**\n- map', none, false)?.retryPrompt).toBeNull();
  });

  it('notes a bare claim without retrying', () => {
    const r = assessNoChange("I've added the map to the Land page. Take a look!", none, true);
    expect(r?.kind).toBe('mentioned');
    expect(r?.retryPrompt).toBeNull();
  });

  it('ignores claims that only appear inside code', () => {
    expect(assessNoChange('Here is a snippet:\n```js\n// I have added a map\n```', none, true)).toBeNull();
  });

  it('catches edits that did not apply', () => {
    const r = assessNoChange('Done.', { attempted: 1, changed: 0, warnings: ["Edits to /a.js didn't match."] }, true);
    expect(r?.kind).toBe('unapplied');
    expect(r?.retryPrompt).toContain("didn't match");
  });

  it('catches files identical to what was there', () => {
    expect(assessNoChange('Done.', { attempted: 2, changed: 0, warnings: [] }, true)?.kind).toBe('identical');
  });

  it('tells the person when a second try also missed', () => {
    expect(assessNoChange('Done.', { attempted: 1, changed: 0, warnings: [] }, false)?.note).toMatch(/missed twice/);
  });
});
