import { useState, useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import { useCommunityStore } from '@/store/community-store';
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

/** Covered models, in the order the community proxy prefers them */
const COMMUNITY_MODEL_NAMES = 'Claude Opus 5 (the default builder), Fable 5, Opus 4.8, Sonnet 5, and Haiku 4.5';

/** 161_000 → "161k", 5_000_000 → "5M" */
function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${Math.round(n / 1000)}k`;
}

interface ProviderSettingsProps {
  /** Controlled open state — when provided, the internal trigger is hidden */
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  hideTrigger?: boolean;
}

export function ProviderSettings({ open: controlledOpen, onOpenChange, hideTrigger }: ProviderSettingsProps = {}) {
  const { apiKeys, setApiKey, removeApiKey, activeProviderId, setActiveProvider } =
    useProviderStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});

  const entries = registry.getAllEntries();
  const freeEntries = entries.filter(e => e.tier === 1);
  const byokEntries = entries.filter(e => e.tier !== 1);
  const communityActive = useCommunityStore(s => s.active);
  const dailyBudget = useCommunityStore(s => s.dailyBudget);
  const usedToday = useCommunityStore(s => s.usedToday);

  // Community access and Claude BYOK share the claude provider under the
  // hood — a saved personal key wins, otherwise the community path runs.
  // The two settings rows reflect that split.
  const claudeKeySet = !!apiKeys['claude'];
  const communityInUse = communityActive && activeProviderId === 'claude' && !claudeKeySet;
  const rowActive = (id: string) =>
    activeProviderId === id && !(id === 'claude' && communityInUse);

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
      {!hideTrigger && (
        <DialogTrigger className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          Settings
        </DialogTrigger>
      )}
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <h3 className="text-sm font-semibold">Model Providers</h3>

          {/* Community Access — its own category, not a mode of the Claude BYOK
              row. Active when signed in as an approved member; routes through
              the claude provider without a personal key (the RTP key stays
              server-side). */}
          {communityActive && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Community Access
              </p>
              <div className="rounded-md bg-green-600/10 border border-green-600/30 px-3 py-2.5 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-medium text-sm truncate">Community</span>
                  <Badge className="text-xs shrink-0">Free</Badge>
                </div>
                <Button
                  variant={communityInUse ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveProvider('claude')}
                  disabled={claudeKeySet}
                >
                  {communityInUse ? 'Active' : 'Use'}
                </Button>
              </div>
              <p className="text-xs text-foreground">
                Free building, covered by the Relational Tech Project. Your daily
                token budget works across {COMMUNITY_MODEL_NAMES}.
              </p>
              {dailyBudget > 0 && (
                <p className="text-xs text-muted-foreground">
                  Today: {formatTokens(usedToday)} of {formatTokens(dailyBudget)} tokens used.
                </p>
              )}
              {claudeKeySet && (
                <p className="text-xs text-muted-foreground">
                  Your own Anthropic key is set below, so builds use it instead. Clear
                  it to build on the community budget again.
                </p>
              )}
              </div>
            </div>
          )}

          {/* Tier 1: RTP-hosted, no key — only registered once its endpoint is live */}
          {freeEntries.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Free
              </p>
              {freeEntries.map(({ provider }) => (
                <div key={provider.id} className="flex items-center justify-between">
                  <span className="font-medium text-sm">{provider.name}</span>
                  <Button
                    variant={rowActive(provider.id) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveProvider(provider.id)}
                  >
                    {rowActive(provider.id) ? 'Active' : 'Use'}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Every BYOK provider has the same shape — Claude (Anthropic) is
              simply one of them */}
          <div className="space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Bring Your Own Key
            </p>
            {byokEntries.map(({ provider, requiresApiKey }) => (
            <div key={provider.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{provider.name}</span>
                <Button
                  variant={rowActive(provider.id) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveProvider(provider.id)}
                  disabled={requiresApiKey && !apiKeys[provider.id]}
                >
                  {rowActive(provider.id) ? 'Active' : 'Use'}
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

              {provider.id !== byokEntries[byokEntries.length - 1].provider.id && (
                <Separator className="mt-3" />
              )}
            </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
