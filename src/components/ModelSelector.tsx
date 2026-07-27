import { useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import { useCommunityStore, COMMUNITY_MODELS } from '@/store/community-store';
import { registry } from '@/providers/registry';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/** Short, human descriptions so choosing a model doesn't require model trivia */
const MODEL_HINTS: Record<string, string> = {
  'claude-fable-5': 'The best builder — does your first build, great for big changes',
  'claude-opus-5': 'The new Opus — strong builds and edits at half Fable\'s cost',
  'claude-opus-4-8': 'Deep and dependable — the default for edits and fixes',
  'claude-sonnet-5': 'Fast and sharp — a lighter pick for small tweaks',
  'claude-haiku-4-5': 'Quickest and lightest',
};

export function ModelSelector({ className }: { className?: string }) {
  const { activeProviderId, activeModelId, availableModels, apiKeys, pinModel, refreshModels } =
    useProviderStore();
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

  return (
    <Select
      value={activeModelId}
      // A choice made here is deliberate: it pins the model for this project,
      // so the automatic first-build/edit defaults step aside
      onValueChange={(value) => { if (value) pinModel(value); }}
    >
      <SelectTrigger className={className ?? 'w-auto max-w-[200px] h-8 text-xs gap-1.5'}>
        <SelectValue placeholder="Select model...">
          {activeModel?.name ?? activeModelId}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-64 max-w-72">
        {onCommunityKey && (
          <p className="px-2 py-1.5 text-xs leading-snug text-muted-foreground">
            Included with community access — every model draws on the same
            daily budget. First builds use Fable, edits default to Opus;
            picking one here makes it stick for this project.
          </p>
        )}
        {models.map(model => {
          const covered = !onCommunityKey || COMMUNITY_MODELS.includes(model.id);
          const hint = MODEL_HINTS[model.id];
          return (
            <SelectItem
              key={model.id}
              value={model.id}
              className="text-xs"
              disabled={!covered}
            >
              <span className="flex flex-col gap-0.5 py-0.5">
                <span>{model.name}</span>
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
      </SelectContent>
    </Select>
  );
}
