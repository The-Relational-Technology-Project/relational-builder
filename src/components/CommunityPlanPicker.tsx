import { DEFAULT_COMMUNITY_PLAN, communityPlans, planJobsLine } from '@/cloud/community-plans';
import { OPEN_BUILDER_MODELS } from '@/human-scale/builder-model';
import { CLAUDE_MODELS } from '@/providers/claude';
import { shortModelName } from '@/providers/model-label';
import { chooseCommunityPlan } from '@/store/community-store';
import { useCommunityPlanStore } from '@/store/community-plan-store';

/** Named the way the model menu names them, without the "(open)" tag the
 *  plan's own name already carries */
function modelName(id: string): string {
  const full = CLAUDE_MODELS.find(m => m.id === id)?.name ?? OPEN_BUILDER_MODELS.find(m => m.id === id)?.name ?? id;
  return shortModelName(full).replace(/\s*\(open\)$/, '');
}

/**
 * The two community plans, at the top of the model menu. Each says what
 * kind of model it is and which model does which job, in view rather than
 * behind a hover, so the choice explains itself on a phone too.
 */
export function CommunityPlanPicker() {
  const chosen = useCommunityPlanStore(s => s.plan) ?? DEFAULT_COMMUNITY_PLAN;
  return (
    <div className="px-1 pt-1 pb-1.5 space-y-1.5" role="radiogroup" aria-label="Community plan">
      <p className="px-1 text-xs leading-snug text-muted-foreground">
        Included with community access. Both plans draw on the same weekly budget.
      </p>
      {communityPlans().map(plan => {
        const active = plan.id === chosen;
        return (
          <button
            key={plan.id}
            type="button"
            role="radio"
            aria-checked={active}
            // The menu is a listbox: keep its own pointer and key handling
            // from treating this as an option pick or closing on the press
            onPointerDown={e => e.stopPropagation()}
            onClick={() => { if (!active) void chooseCommunityPlan(plan.id); }}
            className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${
              active ? 'border-foreground bg-accent' : 'hover:bg-accent/60'
            }`}
          >
            <span className="flex items-center gap-1.5 text-xs font-medium">
              {plan.name}
              {active && (
                <span className="rounded-full border px-1.5 py-px text-[10px] leading-none text-muted-foreground">
                  Your plan
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground whitespace-normal">
              {plan.about}
            </span>
            <span className="mt-0.5 block text-xs leading-snug text-muted-foreground whitespace-normal">
              {planJobsLine(plan, modelName)}.
            </span>
          </button>
        );
      })}
      <p className="px-1 text-xs leading-snug text-muted-foreground">
        Or pick one model below and it sticks for this project.
      </p>
    </div>
  );
}
