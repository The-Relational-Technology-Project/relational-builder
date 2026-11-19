import { CLAUDE_MODELS } from '@/providers/claude';
import { shortModelName } from '@/providers/model-label';
import { OPEN_BUILDER_MODELS } from '@/human-scale/builder-model';

/** A community plan's model, named the way the model menu names it, without
 *  the "(open)" tag the plan's own name already carries. Used by the plan
 *  cards in Settings and the Community AI copy in the Services tab. */
export function communityModelName(id: string): string {
  const full = CLAUDE_MODELS.find(m => m.id === id)?.name ?? OPEN_BUILDER_MODELS.find(m => m.id === id)?.name ?? id;
  return shortModelName(full).replace(/\s*\(open\)$/, '');
}
