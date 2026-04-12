import { useState, useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import { registry } from '@/providers/registry';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

const TIER_LABELS: Record<number, string> = {
  1: 'Free',
  2: 'Bring Your Own Key',
  3: 'Community Access',
};

export function ProviderSettings() {
  const { apiKeys, setApiKey, removeApiKey, activeProviderId, setActiveProvider } =
    useProviderStore();
  const [open, setOpen] = useState(false);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  const entries = registry.getAllEntries();

  useEffect(() => {
    const inputs: Record<string, string> = {};
    for (const { provider } of entries) {
      inputs[provider.id] = apiKeys[provider.id] ?? '';
    }
    setKeyInputs(inputs);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSaveKey(providerId: string) {
    const key = keyInputs[providerId]?.trim();
    if (key) {
      setApiKey(providerId, key);
    } else {
      removeApiKey(providerId);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
        Settings
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Model Providers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {entries.map(({ provider, tier, requiresApiKey }) => (
            <div key={provider.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{provider.name}</span>
                  <Badge variant={tier === 1 ? 'default' : 'secondary'} className="text-xs">
                    {TIER_LABELS[tier]}
                  </Badge>
                </div>
                <Button
                  variant={activeProviderId === provider.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveProvider(provider.id)}
                  disabled={requiresApiKey && !apiKeys[provider.id]}
                >
                  {activeProviderId === provider.id ? 'Active' : 'Use'}
                </Button>
              </div>

              {requiresApiKey && (
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Label htmlFor={`key-${provider.id}`} className="sr-only">
                      API Key
                    </Label>
                    <Input
                      id={`key-${provider.id}`}
                      type="password"
                      placeholder="Enter API key..."
                      value={keyInputs[provider.id] ?? ''}
                      onChange={e =>
                        setKeyInputs(prev => ({ ...prev, [provider.id]: e.target.value }))
                      }
                      onBlur={() => handleSaveKey(provider.id)}
                      onKeyDown={e => e.key === 'Enter' && handleSaveKey(provider.id)}
                    />
                  </div>
                  {apiKeys[provider.id] && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        removeApiKey(provider.id);
                        setKeyInputs(prev => ({ ...prev, [provider.id]: '' }));
                      }}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              )}

              {provider.id !== entries[entries.length - 1].provider.id && (
                <Separator className="mt-3" />
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
