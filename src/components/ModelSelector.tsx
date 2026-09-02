import { useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import { useCommunityStore, COMMUNITY_MODELS } from '@/store/community-store';
import { registry } from '@/providers/registry';
import { modelLabel } from '@/providers/model-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Short, human descriptions so choosing a model doesn't require model trivia */
const MODEL_HINTS: Record<string, string> = {
  'claude-opus-5': 'Deep and complete — the everyday pick for builds and edits',
  'claude-fable-5-1': 'The deepest thinker — plans by default; worth it for the biggest, hardest builds',
  'claude-opus-4-8': 'The previous default — dependable for edits and fixes',
  'claude-sonnet-5': 'Fast and sharp — a lighter pick for small tweaks',
  'claude-haiku-4-5': 'Quickest and lightest',
};

export function ModelSelector({ className }: { className?: string }) {
  const {
    activeProviderId,
    activeModelId,
    availableModels,
    apiKeys,
    modelPinned,
    pinModel,
    refreshModels,
  } = useProviderStore();
  const communityActive = useCommunityStore(s => s.active);

  useEffect(() => {
    refreshModels();
  }, [activeProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Use available models for this provider, falling back to defaults if empty
  let models = availableModels.filter(m => m.provider === activeProviderId);
  if (models.length === 0) {
    models = registry.getDefaultModels(activeProviderId);
  }

  const activeModel = models.find(m => m.id === activeModelId);

  // On community access without a personal key, only covered models will work
  const onCommunityKey =
    communityActive && activeProviderId === 'claude' && !apiKeys['claude'];

  // The chip names the model, not its maker — "Opus 5", not "Claude Opus 5".
  // The full name is one hover (or one open menu) away, so nothing is hidden;
  // it just stops being the loudest thing in the composer.
  const label = activeModel ? modelLabel(activeModel) : activeModelId;

  return (
    <Select
      value={activeModelId}
      // A choice made here is deliberate: it pins the model for this project,
      // so the automatic first-build/edit defaults step aside
      onValueChange={(value) => { if (value) pinModel(value); }}
    >
      <SelectTrigger
        className={className ?? 'w-auto max-w-[200px] h-8 text-xs gap-1.5'}
        aria-label={`Model: ${activeModel?.name ?? activeModelId}${modelPinned ? '' : ' (default)'}`}
        title={
          modelPinned
            ? `${activeModel?.name ?? activeModelId} — your pick for this project`
            : `${activeModel?.name ?? activeModelId} — the default. Pick another and it sticks for this project.`
        }
      >
        <SelectValue placeholder="Select model...">
          {label}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-64 max-w-72">
        {onCommunityKey && (
          <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
            Included with community access — every model draws on the same
            daily budget. Builds and edits pick a sensible default; choosing
            here makes it stick for this project.
          </p>
        )}
        {models.map(model => {
          const covered = !onCommunityKey || COMMUNITY_MODELS.includes(model.id);
          const hint = MODEL_HINTS[model.id];
          // Nothing pinned means whatever is active is what you get by
          // default — say so, so "Opus 5" on the chip isn't a mystery
          const isDefault = !modelPinned && model.id === activeModelId;
          return (
            <SelectItem
              key={model.id}
              value={model.id}
              className="text-xs"
              disabled={!covered}
            >
              <span className="flex flex-col gap-0.5 py-0.5">
                <span className="flex items-center gap-1.5">
                  {modelLabel(model)}
                  {isDefault && (
                    <span className="rounded-full border px-1.5 py-px text-[10px] leading-none text-muted-foreground">
                      Default
                    </span>
                  )}
                </span>
                {hint && (
                  <span className="text-xs text-muted-foreground whitespace-normal">
                    {covered ? hint : 'Needs your own API key'}
                  </span>
                )}
              </span>
            </SelectItem>
          );
        })}
        {models.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No models available
          </div>
        )}
        {/* The vendor gets said once, where the choice is actually made —
            de-centered, not concealed */}
        {activeProviderId === 'claude' && models.length > 0 && (
          <p className="border-t mt-1 px-2 pt-1.5 pb-0.5 text-[11px] leading-snug text-muted-foreground">
            Anthropic's Claude models. Other providers live in Settings →
            Model Providers.
          </p>
        )}
      </SelectContent>
    </Select>
  );
}
