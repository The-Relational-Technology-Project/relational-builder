import { describe, expect, it } from 'vitest';
import {
  DEFAULT_COMMUNITY_PLAN,
  communityOpenRoute,
  communityPlan,
  communityPlanChoice,
  communityPlans,
  isCommunityPlanId,
  planJobsLine,
  planModelNote,
  planOfModel,
} from './community-plans';
import { isOpenBuilderModel } from '@/human-scale/builder-model';

describe('community plans', () => {
  it('is off by default, and the open route with it', () => {
    expect(communityPlanChoice()).toBe(false);
    expect(communityOpenRoute()).toBe(false);
  });

  it('defaults to open-weight', () => {
    expect(DEFAULT_COMMUNITY_PLAN).toBe('open-weight');
  });

  it('runs every open-weight job on an open model the community route covers', () => {
    for (const s of Object.values(communityPlan('open-weight').stages)) {
      expect(s.providerId).toBe('openrouter');
      expect(isOpenBuilderModel(s.model)).toBe(true);
    }
    expect(communityPlan('open-weight').stages.plan.model).toBe('google/gemma-4-31b-it');
  });

  it('runs no frontier job on an open model', () => {
    for (const s of Object.values(communityPlan('frontier').stages)) {
      expect(isOpenBuilderModel(s.model)).toBe(false);
    }
  });

  it('recognises only its own plan ids', () => {
    expect(communityPlans().every(p => isCommunityPlanId(p.id))).toBe(true);
    expect(isCommunityPlanId('burrito')).toBe(false);
    expect(isCommunityPlanId(null)).toBe(false);
  });

  it('says who does what, naming a model once', () => {
    const name = (id: string) => id.split('/').pop()!;
    expect(planJobsLine(communityPlan('open-weight'), name)).toBe(
      'gemma-4-31b-it plans, builds and edits',
    );
    expect(planJobsLine(communityPlan('frontier'), name)).toBe(
      'claude-fable-5-2 plans; claude-opus-5-5 builds and edits',
    );
    const one = { ...communityPlan('frontier') };
    one.stages = { plan: one.stages.edit, 'first-build': one.stages.edit, edit: one.stages.edit };
    expect(planJobsLine(one, name)).toBe('claude-opus-5-5 plans, builds and edits');
  });

  it('names the plan and the model in the chat note, per stage', () => {
    const note = planModelNote(communityPlan('open-weight'), 'plan', 'Gemma 4 31B');
    expect(note).toContain('Planning runs on **Gemma 4 31B**');
    expect(note).toContain('**Open-Weight Models**');
    expect(planModelNote(communityPlan('frontier'), 'edit', 'Opus 5.5')).toContain('Edits and fixes run on **Opus 5.5**');
  });

  it('sorts metered models into the plan they belong to', () => {
    expect(planOfModel('google/gemma-4-31b-it')).toBe('open-weight');
    expect(planOfModel('claude-opus-5-5')).toBe('frontier');
    expect(planOfModel('claude-fable-5-2:profile')).toBe('frontier');
    expect(planOfModel('pareto')).toBe('frontier');
    expect(planOfModel('untracked')).toBeNull();
  });
});
