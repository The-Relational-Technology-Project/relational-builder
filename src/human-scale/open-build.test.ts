import { afterEach, describe, expect, it } from 'vitest';
import { communityOpenBuildModel, communityOpenBuilds, openModelBuildPath, setActiveBuilderModelSource } from './open-build';

describe('open-model build path', () => {
  afterEach(() => setActiveBuilderModelSource(() => null));
  it('follows the model: on for Gemma, off for Claude, off with no model', () => {
    expect(openModelBuildPath('google/gemma-4-26b-a4b-it')).toBe(true);
    expect(openModelBuildPath('google/gemma-4-31b-it')).toBe(true);
    expect(openModelBuildPath('claude-opus-5-5')).toBe(false);
    expect(openModelBuildPath()).toBe(false);
  });
  it('reads the active model when none is given', () => {
    setActiveBuilderModelSource(() => 'google/gemma-4-26b-a4b-it');
    expect(openModelBuildPath()).toBe(true);
    setActiveBuilderModelSource(() => 'anthropic/claude-sonnet-5');
    expect(openModelBuildPath()).toBe(false);
  });
});

describe('community open builds switch', () => {
  it('is off by default and builds on the default open model when on', () => {
    expect(communityOpenBuilds()).toBe(false);
    expect(communityOpenBuildModel()).toBe('google/gemma-4-26b-a4b-it');
  });
});
