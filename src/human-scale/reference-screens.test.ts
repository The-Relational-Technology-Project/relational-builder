import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { REFERENCE_SCREENS, pickReferenceScreen, referenceNote } from './reference-screens';

describe('reference screens', () => {
  it('every screen has its file', () => {
    for (const s of REFERENCE_SCREENS) expect(existsSync(`public/human-scale/references/${s.file}`)).toBe(true);
  });
  it('picks by shape', () => {
    expect(pickReferenceScreen('a meal train with dinner slots neighbors can claim').id).toBe('schedule');
    expect(pickReferenceScreen('an oral history archive of interviews about our street').id).toBe('archive');
    expect(pickReferenceScreen('a plain-language guide to tenant rights and resources').id).toBe('guide');
    expect(pickReferenceScreen('a wall where neighbors post ideas and answers').id).toBe('content-wall');
  });
  it('never shows the prompt its own subject', () => {
    expect(pickReferenceScreen('Build a community fridge app with stock updates and shifts').id).not.toBe('status-tool');
    expect(pickReferenceScreen('Build a neighborhood listening wall with questions and responses').id).not.toBe('content-wall');
    expect(pickReferenceScreen('a ballot guide explaining how to vote').id).not.toBe('guide');
  });
  it('falls back to the status tool', () => {
    expect(pickReferenceScreen('something else entirely').id).toBe('status-tool');
  });
  it('tells the model quality, not subject', () => {
    expect(referenceNote(REFERENCE_SCREENS[0])).toContain('not subject');
  });
});

describe('reference note', () => {
  it('names the layout beside the image', () => {
    const screen = REFERENCE_SCREENS.find(s => s.id === 'schedule')!;
    expect(referenceNote(screen)).toContain('The screen, described: At laptop width');
  });
});
