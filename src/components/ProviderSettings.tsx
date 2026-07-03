import { useState, useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import { useKnowledgeStore } from '@/store/knowledge-store';
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
import { ChevronDown, ChevronRight, BookOpen, Radio, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';

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
  const [showKB, setShowKB] = useState(false);

  const entries = registry.getAllEntries();
  const communityActive = useCommunityStore(s => s.active);
  const dailyBudget = useCommunityStore(s => s.dailyBudget);
  const usedToday = useCommunityStore(s => s.usedToday);

  const tools = useKnowledgeStore(s => s.tools);
  const stories = useKnowledgeStore(s => s.stories);
  const networkEntries = useKnowledgeStore(s => s.networkEntries);
  const kbLoading = useKnowledgeStore(s => s.loading);
  const kbError = useKnowledgeStore(s => s.error);
  const loadAll = useKnowledgeStore(s => s.loadAll);

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
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        {/* Model Providers */}
        <div className="space-y-4 mt-2">
          <h3 className="text-sm font-semibold">Model Providers</h3>
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
                  disabled={
                    requiresApiKey &&
                    !apiKeys[provider.id] &&
                    !(provider.id === 'claude' && communityActive)
                  }
                >
                  {activeProviderId === provider.id ? 'Active' : 'Use'}
                </Button>
              </div>

              {provider.id === 'claude' && communityActive && (
                <div className="rounded-md bg-green-600/10 border border-green-600/30 px-2.5 py-1.5">
                  <p className="text-xs text-foreground">
                    <span className="font-medium">Community access active</span> — free building
                    courtesy of the Relational Tech Project. Opus 4.8 (the best builder),
                    Sonnet 5, and Haiku 4.5 are all covered by your daily budget.
                  </p>
                  {dailyBudget > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Today: {Math.round(usedToday / 1000)}k of {Math.round(dailyBudget / 1000)}k tokens used.
                      Add your own key below anytime to use other models.
                    </p>
                  )}
                </div>
              )}

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

        <Separator className="my-2" />

        {/* Knowledge Base */}
        <div className="space-y-3">
          <button
            onClick={() => setShowKB(!showKB)}
            className="flex items-center gap-2 text-sm font-semibold hover:text-foreground transition-colors w-full text-left"
          >
            {showKB ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            <BookOpen className="size-3.5" />
            RTP Knowledge Base
            {!kbLoading && !kbError && (
              <span className="text-xs font-normal text-muted-foreground">
                ({tools.length} tools, {stories.length} stories)
              </span>
            )}
          </button>

          {showKB && (
            <div className="pl-6 space-y-2">
              {kbLoading && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <Loader2 className="size-3 animate-spin" />
                  Loading knowledge base...
                </div>
              )}
              {kbError && (
                <div className="flex items-center gap-2 text-xs py-2">
                  <AlertTriangle className="size-3 text-amber-500" />
                  <span className="text-muted-foreground">{kbError}</span>
                  <button
                    onClick={() => {
                      useKnowledgeStore.setState({ loaded: false, error: null });
                      loadAll();
                    }}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    <RefreshCw className="size-3" />
                    Retry
                  </button>
                </div>
              )}
              {!kbLoading && !kbError && (
                <>
                  <div className="text-xs text-muted-foreground">
                    {tools.length} tools and {stories.length} stories loaded from the RTP library.
                    Relevant context is automatically injected into AI prompts.
                  </div>
                  {networkEntries.length > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Radio className="size-3" />
                      {networkEntries.length} recent network updates
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
