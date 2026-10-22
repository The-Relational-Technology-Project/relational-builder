import { useState, useEffect } from 'react';
import { useProviderStore } from '@/store/provider-store';
import { useCommunityStore } from '@/store/community-store';
import { registry } from '@/providers/registry';
import { LOCAL_MODEL_DEFAULT_URL } from '@/providers/openai-compatible';
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
const COMMUNITY_MODEL_NAMES = 'Claude Opus 5.5 (the default builder), Fable 5.1 (the default planner), Opus 5, Opus 4.8, Sonnet 5, and Haiku 4.5';

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
  const localEntry = entries.find(e => e.provider.id === 'local');
  const byokEntries = entries.filter(e => e.tier !== 1 && e.provider.id !== 'local');
  const communityActive = useCommunityStore(s => s.active);
  const weeklyBudget = useCommunityStore(s => s.weeklyBudget);
  const usedThisWeek = useCommunityStore(s => s.usedThisWeek);
  const refreshUsage = useCommunityStore(s => s.refreshUsage);

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

  // The meter reads fresh when the dialog opens and keeps up while it's open
  // — a build running in the background meters on the proxy, not here
  useEffect(() => {
    if (!open || !communityActive) return;
    void refreshUsage();
    const timer = setInterval(() => { void refreshUsage(); }, 30_000);
    return () => clearInterval(timer);
  }, [open, communityActive, refreshUsage]);

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
                Free building, covered by the Relational Tech Project. Your weekly
                token budget works across {COMMUNITY_MODEL_NAMES}.
              </p>
              {weeklyBudget > 0 && (
                <p className="text-xs text-muted-foreground">
                  This week: {formatTokens(usedThisWeek)} of {formatTokens(weeklyBudget)} tokens used (resets Monday 00:00 UTC).
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

          {/* Local: a model on this computer or a box in the room. No key and
              no cloud, so it gets its own section with a URL instead of a key */}
          {localEntry && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                On your computer or network
              </p>
              <LocalModelRow
                name={localEntry.provider.name}
                active={rowActive('local')}
                onUse={() => setActiveProvider('local')}
              />
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

type LocalCheck =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'ok'; models: string[] }
  | { state: 'fail'; reason: string };

/**
 * The local preset's row: where the model server is, a one-click check that
 * it answers, and honest expectations. The check runs the same request the
 * model picker uses, so "found 3 models" means the picker will show them.
 */
function LocalModelRow({ name, active, onUse }: { name: string; active: boolean; onUse: () => void }) {
  const savedUrl = useProviderStore(s => s.baseUrls['local']);
  const setBaseUrl = useProviderStore(s => s.setBaseUrl);
  const [url, setUrl] = useState(savedUrl ?? LOCAL_MODEL_DEFAULT_URL);
  const [check, setCheck] = useState<LocalCheck>({ state: 'idle' });

  const cleanUrl = url.trim().replace(/\/$/, '');

  async function save() {
    if (cleanUrl && cleanUrl !== (savedUrl ?? LOCAL_MODEL_DEFAULT_URL)) await setBaseUrl('local', cleanUrl);
  }

  async function runCheck() {
    await save();
    setCheck({ state: 'checking' });
    try {
      const res = await fetch(`${cleanUrl}/v1/models`, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error(`the server answered ${res.status}`);
      const data = await res.json();
      const models: string[] = (data.data ?? []).map((m: { id: string }) => m.id);
      setCheck({ state: 'ok', models });
    } catch (err) {
      setCheck({ state: 'fail', reason: explainLocalFailure(cleanUrl, err) });
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-medium text-sm">{name}</span>
        <Button variant={active ? 'default' : 'outline'} size="sm" onClick={onUse}>
          {active ? 'Active' : 'Use'}
        </Button>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Label htmlFor="local-url" className="sr-only">Model server address</Label>
          <Input
            id="local-url"
            type="url"
            placeholder={LOCAL_MODEL_DEFAULT_URL}
            value={url}
            onChange={e => setUrl(e.target.value)}
            onBlur={() => { void save(); }}
            onKeyDown={e => { if (e.key === 'Enter') void runCheck(); }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={() => { void runCheck(); }} disabled={check.state === 'checking'}>
          {check.state === 'checking' ? 'Checking…' : 'Check'}
        </Button>
      </div>
      {check.state === 'ok' && (
        <p className="text-xs text-foreground">
          {check.models.length === 0
            ? 'Connected, but no models are installed yet. In a terminal: ollama pull qwen2.5-coder:7b'
            : `Connected. ${check.models.length} model${check.models.length === 1 ? '' : 's'} ready: ${check.models.slice(0, 6).join(', ')}${check.models.length > 6 ? '…' : ''}`}
        </p>
      )}
      {check.state === 'fail' && (
        <p className="text-xs text-destructive">{check.reason}</p>
      )}
      <p className="text-xs text-muted-foreground">
        Runs Ollama, LM Studio, or any OpenAI-compatible server on your machine or a box on
        the same network. No key, no cloud, keeps working in an outage. A model that fits on
        one computer handles simple tools and edits well; expect less than the cloud default
        on a big multi-file build.
      </p>
    </div>
  );
}

/** Turn a failed probe into the one thing the person should try next */
function explainLocalFailure(url: string, err: unknown): string {
  const pageIsHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const target = (() => { try { return new URL(url); } catch { return null; } })();
  if (!target) return 'That address does not look like a URL. Try http://localhost:11434';
  const isLocalhost = ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname);
  if (pageIsHttps && target.protocol === 'http:' && !isLocalhost) {
    return `Browsers block this https page from calling http://${target.host}. Either open the Builder from that same machine, or put https in front of the model server.`;
  }
  if (err instanceof Error && err.name === 'TimeoutError') {
    return `No answer from ${target.host} after 5 seconds. Is the model server running, and is this the right address?`;
  }
  const detail = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(detail)) {
    return `Could not reach ${target.host}. If Ollama is running, it may need to allow this site: set OLLAMA_ORIGINS=${window.location.origin} and restart it.`;
  }
  return `Could not reach ${target.host}: ${detail}`;
}
