import { isHumanScale } from './flag';
import { OPEN_BUILDER_DEFAULT, isOpenBuilderModel } from './builder-model';

/**
 * Two decisions about open models in the Builder, kept in one place.
 *
 * 1. Which builds get the open-model build path: the import and scaffold
 *    repairs, the design guidance and library screens, the static checks
 *    and second fix pass, the runaway guard. On behind the human-scale
 *    flag, and for anyone building with an open builder model (Gemma
 *    picked in the model menu with their own OpenRouter key, or the
 *    community default once it switches). Claude builds off the flag are
 *    untouched.
 *
 * 2. Whether the free community plan builds and edits on an open model.
 *    Off by default. Planning stays on Claude either way. Switching it on
 *    is one build setting, VITE_COMMUNITY_OPEN_BUILDS=1 (and optionally
 *    VITE_COMMUNITY_OPEN_BUILD_MODEL to pick which open model), once the
 *    keyless community route is live: see docs/human-scale/COMMUNITY-OPEN-BUILDS.md.
 *    The human-scale flag turns it on too, for testing.
 */

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};

/** Community builds and edits run on an open model */
export function communityOpenBuilds(): boolean {
  return isHumanScale() || env.VITE_COMMUNITY_OPEN_BUILDS === '1';
}

/** The open model community builds use when the switch is on */
export function communityOpenBuildModel(): string {
  const chosen = env.VITE_COMMUNITY_OPEN_BUILD_MODEL;
  return chosen && isOpenBuilderModel(chosen) ? chosen : OPEN_BUILDER_DEFAULT;
}

// The active model, registered by the provider store, so modules that
// can't import the store (the code extractor) can still ask
let activeModel: () => string | null = () => null;
export function setActiveBuilderModelSource(source: () => string | null): void {
  activeModel = source;
}

/** Whether this build takes the open-model build path. `modelId` defaults
 *  to the model active in the Builder. */
export function openModelBuildPath(modelId?: string | null): boolean {
  if (isHumanScale()) return true;
  const id = modelId ?? activeModel();
  return !!id && isOpenBuilderModel(id);
}
