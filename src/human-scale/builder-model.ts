/**
 * The open models the Builder itself builds with, when the flag is on.
 *
 * The picks come from the bench board (docs/human-scale/BENCH-BOARD.md),
 * not from a model's reputation: a model is listed here when it has
 * produced a working app on the two comparison prompts often enough, with
 * the guard and hints on, to be worth a neighbor's minute. The order is
 * the order of evidence as of the date on each line: clean rate first,
 * then human design review where the rates are close (Nov 5: Gemma and
 * GLM are within a few points on clean builds, and Gemma's designs are
 * clearly ahead). Change this file and
 * the model menu, the community default and the bench's "first choice"
 * all follow.
 */

export interface OpenBuilderModel {
  /** OpenRouter id */
  id: string;
  /** How the menu names it */
  name: string;
  /** Active parameters when public, for the footprint estimate */
  activeParams?: number;
  /** One line a person can check against the board */
  evidence: string;
}

export const OPEN_BUILDER_MODELS: OpenBuilderModel[] = [
  {
    id: 'google/gemma-4-26b-a4b-it',
    name: 'Gemma 4 26B (open)',
    activeParams: 4e9,
    evidence: 'Nov 5: best design of the open models by a clear margin (Josh, reviewing the board); 9 of 12 clean off the one host that serves it broken; 4B active parameters, runs on a 16 GB box',
  },
  {
    id: 'z-ai/glm-4.5-air',
    name: 'GLM 4.5 Air (open)',
    evidence: 'Nov 4: 71% clean over 24 guarded builds on the comparison prompts, 86s median, under a cent a build',
  },
  {
    id: 'openai/gpt-oss-120b',
    name: 'GPT-OSS 120B (open)',
    evidence: 'Nov 4: 5 of 6 clean with the router guard; 57% over 30 builds including the days before it',
  },
];

/** The open model the community default builds with (first entry, by evidence) */
export const OPEN_BUILDER_DEFAULT = OPEN_BUILDER_MODELS[0].id;

export function isOpenBuilderModel(id: string): boolean {
  return OPEN_BUILDER_MODELS.some(m => m.id === id);
}

/**
 * OpenRouter upstream hosts the board has shown serving a model broken
 * (Nov 3: every gemma build from Darkbloom wrote `from ''react'`; every
 * build from the other hosts compiled). Kept out of the rotation for every
 * Builder call that goes through OpenRouter while the flag is on. Reviewed
 * weekly against the by-host table; a host comes off the list when it has
 * three clean builds in a row there.
 */
export const OPENROUTER_IGNORE_HOSTS: string[] = ['Darkbloom'];

/** The request-body fields that tell OpenRouter which hosts to skip */
export function openRouterRoutingBody(ignore: string[] = OPENROUTER_IGNORE_HOSTS): Record<string, unknown> {
  return ignore.length ? { provider: { ignore: [...ignore] } } : {};
}
