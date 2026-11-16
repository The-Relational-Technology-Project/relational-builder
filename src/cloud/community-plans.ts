import { communityOpenBuildModel, communityOpenBuilds } from '@/human-scale/open-build';
import { isOpenBuilderModel } from '@/human-scale/builder-model';

/**
 * The two paths the free community plan can offer, in one table.
 *
 * - **Open-Weight Models**: every job runs on a model whose weights are
 *   published, with different open models taking different jobs.
 * - **Frontier Models**: the closed models from the big labs. Claude today;
 *   the stage table below is the one place to change when that moves
 *   (Pareto is the leading candidate).
 *
 * Routing (src/store/community-store.ts), the note in chat, the model menu
 * and the steward's spend view all read from here, so a plan's models
 * change in one place.
 *
 * The choice is behind a switch, VITE_COMMUNITY_PLAN_CHOICE=1, and is
 * **off**. Off, nothing here is consulted and the community plan behaves
 * as before. On, a person picks a plan in the model menu and a new person
 * starts on DEFAULT_COMMUNITY_PLAN. See docs/human-scale/COMMUNITY-OPEN-BUILDS.md.
 */

export type CommunityModelStage = 'plan' | 'first-build' | 'edit';
export type CommunityPlanId = 'open-weight' | 'frontier';

export interface StageModel {
  providerId: 'claude' | 'openrouter';
  model: string;
}

export interface CommunityPlan {
  id: CommunityPlanId;
  name: string;
  /** What this kind of model is, in a sentence a newcomer can use */
  about: string;
  stages: Record<CommunityModelStage, StageModel>;
}

// The Frontier plan's models, one per stage. The reasoning and the bench
// results behind each are written up in src/store/community-store.ts.
export const COMMUNITY_PLAN_MODEL = 'claude-fable-5-2';
export const COMMUNITY_FIRST_BUILD_MODEL = 'claude-opus-5-5';
export const COMMUNITY_EDIT_MODEL = 'claude-opus-5-5';

/** The open model that plans (owner decision, Nov 16: Gemma 4 31B. On the
 *  Nov 15 planning screen it marked level with the Claude references at a
 *  third of the wait of the top-marked open model; docs/human-scale/MODELS-BY-TASK.md) */
export const OPEN_WEIGHT_PLAN_MODEL = 'google/gemma-4-31b-it';

/** The plan a person is on until they choose (owner decision, Nov 16) */
export const DEFAULT_COMMUNITY_PLAN: CommunityPlanId = 'open-weight';

export function communityPlans(): CommunityPlan[] {
  const openBuild: StageModel = { providerId: 'openrouter', model: communityOpenBuildModel() };
  return [
    {
      id: 'open-weight',
      name: 'Open-Weight Models',
      about:
        'Models whose weights are published, so anyone can run them, study them, or host them, including a community on its own machine.',
      stages: {
        plan: { providerId: 'openrouter', model: OPEN_WEIGHT_PLAN_MODEL },
        'first-build': openBuild,
        edit: openBuild,
      },
    },
    {
      id: 'frontier',
      name: 'Frontier Models',
      about:
        'The most capable models from the big AI labs. They are closed: only the lab that made them can run them.',
      stages: {
        plan: { providerId: 'claude', model: COMMUNITY_PLAN_MODEL },
        'first-build': { providerId: 'claude', model: COMMUNITY_FIRST_BUILD_MODEL },
        edit: { providerId: 'claude', model: COMMUNITY_EDIT_MODEL },
      },
    },
  ];
}

export function isCommunityPlanId(value: unknown): value is CommunityPlanId {
  return value === 'open-weight' || value === 'frontier';
}

export function communityPlan(id: CommunityPlanId): CommunityPlan {
  return communityPlans().find(p => p.id === id)!;
}

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

/** Whether people on the community plan choose between the two plans */
export function communityPlanChoice(): boolean {
  return env.VITE_COMMUNITY_PLAN_CHOICE === '1';
}

/** Whether the keyless community route to open models is offered at all:
 *  either the plan choice is on, or community builds were switched to an
 *  open model the earlier way */
export function communityOpenRoute(): boolean {
  return communityPlanChoice() || communityOpenBuilds();
}

/** "Gemma 4 31B plans; Gemma 4 26B builds and edits": who does what on a
 *  plan, naming a model once when it holds several jobs */
export function planJobsLine(plan: CommunityPlan, nameOf: (modelId: string) => string): string {
  const jobs: [CommunityModelStage, string][] = [
    ['plan', 'plans'],
    ['first-build', 'builds'],
    ['edit', 'edits'],
  ];
  const byModel = new Map<string, string[]>();
  for (const [stage, verb] of jobs) {
    const model = plan.stages[stage].model;
    byModel.set(model, [...(byModel.get(model) ?? []), verb]);
  }
  const join = (verbs: string[]) =>
    verbs.length < 3 ? verbs.join(' and ') : `${verbs.slice(0, -1).join(', ')} and ${verbs[verbs.length - 1]}`;
  return [...byModel].map(([model, verbs]) => `${nameOf(model)} ${join(verbs)}`).join('; ');
}

/** The note in chat when a plan's default takes over a turn */
export function planModelNote(plan: CommunityPlan, stage: CommunityModelStage, modelName: string): string {
  const what = stage === 'plan' ? 'Planning runs' : stage === 'first-build' ? 'This build runs' : 'Edits and fixes run';
  return `${what} on **${modelName}**, part of the **${plan.name}** plan. ${plan.about} You can switch plans in the model menu, or pick a single model there and it will stick for this project.`;
}

/** Which plan a metered model belongs to, for the steward's spend view.
 *  By the model that ran, not the plan the person was on: a Frontier
 *  builder who picks Gemma by hand counts as open-weight spend. */
export function planOfModel(model: string): CommunityPlanId | null {
  // The proxy meters some traffic as "<model>:<purpose>" (e.g. ":profile")
  const base = model.replace(/:[a-z-]+$/, '');
  if (isOpenBuilderModel(base)) return 'open-weight';
  if (base.startsWith('claude-') || base.startsWith('anthropic/') || base === 'pareto') return 'frontier';
  return null;
}
