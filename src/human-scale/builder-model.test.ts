import { describe, expect, it } from 'vitest';
import { OPEN_BUILDER_DEFAULT, OPEN_BUILDER_MODELS, OPENROUTER_IGNORE_HOSTS, isOpenBuilderModel, openRouterRoutingBody } from './builder-model';

describe('open builder models', () => {
  it('every pick carries evidence a person can check against the board', () => {
    for (const m of OPEN_BUILDER_MODELS) {
      expect(m.id).toMatch(/^[a-z0-9-]+\/[a-z0-9.-]+$/i);
      expect(m.evidence).toMatch(/\d/);
    }
  });
  it('the default is the first pick and counts as an open builder model', () => {
    expect(OPEN_BUILDER_DEFAULT).toBe(OPEN_BUILDER_MODELS[0].id);
    expect(isOpenBuilderModel(OPEN_BUILDER_DEFAULT)).toBe(true);
    expect(isOpenBuilderModel('anthropic/claude-sonnet-5')).toBe(false);
  });
  it('routing body names the hosts to skip and is empty when there are none', () => {
    expect(openRouterRoutingBody()).toEqual({ provider: { ignore: OPENROUTER_IGNORE_HOSTS } });
    expect(openRouterRoutingBody([])).toEqual({});
  });
});
