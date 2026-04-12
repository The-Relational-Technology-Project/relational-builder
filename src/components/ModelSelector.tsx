import { useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ModelSelector() {
  const { activeProviderId, activeModelId, availableModels, setActiveModel, refreshModels } =
    useProviderStore();

  useEffect(() => {
    refreshModels();
  }, [activeProviderId]); // eslint-disable-line react-hooks/exhaustive-deps

  const models = availableModels.filter(m => m.provider === activeProviderId);

  const activeModel = models.find(m => m.id === activeModelId);

  return (
    <Select
      value={activeModelId}
      onValueChange={(value) => { if (value) setActiveModel(value); }}
    >
      <SelectTrigger className="w-[200px] h-8 text-xs">
        <SelectValue placeholder="Select model...">
          {activeModel?.name ?? activeModelId}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {models.map(model => (
          <SelectItem key={model.id} value={model.id} className="text-xs">
            {model.name}
          </SelectItem>
        ))}
        {models.length === 0 && (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            No models available
          </div>
        )}
      </SelectContent>
    </Select>
  );
}
