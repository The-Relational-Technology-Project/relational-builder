import { useState } from 'react';
import { useCommunityStore } from '@/store/community-store';
import { useProviderStore } from '@/store/provider-store';
import { ProviderSettings } from '@/components/ProviderSettings';
import { Button } from '@/components/ui/button';
import { KeyRound, X } from 'lucide-react';

/**
 * The community plan's edge, handled with warmth. Free building has a daily
 * token budget (server-enforced in the llm-proxy). When someone gets close
 * to it — or hits it — this banner explains what happened and offers the
 * two honest paths: come back tomorrow (the budget resets), or add a
 * personal API key and keep going without limits.
 *
 * The "almost there" nudge is dismissible per day; the "you've hit it"
 * state stays until the day rolls over, because the composer genuinely
 * won't work and silence would read as breakage.
 */

const NUDGE_AT = 0.8;
const DISMISS_KEY = 'rb-budget-nudge-dismissed';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function CommunityBudgetBanner() {
  const active = useCommunityStore(s => s.active);
  const dailyBudget = useCommunityStore(s => s.dailyBudget);
  const usedToday = useCommunityStore(s => s.usedToday);
  const hasOwnKey = useProviderStore(s => !!s.apiKeys['claude']);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === today(),
  );

  // Builders on their own key never see budget talk
  if (!active || hasOwnKey || dailyBudget <= 0) return null;

  const ratio = usedToday / dailyBudget;
  const exhausted = ratio >= 1;
  if (!exhausted && (ratio < NUDGE_AT || dismissed)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, today());
    setDismissed(true);
  };

  return (
    <div
      className={`mx-4 mb-2 flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
        exhausted
          ? 'border-primary/40 bg-primary/10'
          : 'border-amber-500/40 bg-amber-500/10'
      }`}
    >
      <div className="flex-1 space-y-1">
        <p className="text-sm">
          {exhausted
            ? "You've used today's free community building — it resets tomorrow."
            : `You've used ${Math.min(99, Math.round(ratio * 100))}% of today's free community building.`}
        </p>
        <p className="text-xs text-muted-foreground">
          {exhausted
            ? 'Your project is safe — you can keep editing files and previewing. To keep building with AI today, add your own API key (you pay your provider directly, no daily cap).'
            : 'Big builds use more of it than small edits. If you want to keep going past the daily budget, you can add your own API key anytime.'}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="shrink-0"
        onClick={() => setSettingsOpen(true)}
      >
        <KeyRound className="size-3.5 mr-1.5" />
        Add your own key
      </Button>
      {!exhausted && (
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          title="Dismiss for today"
        >
          <X className="size-3.5" />
        </button>
      )}
      {settingsOpen && (
        <ProviderSettings open={settingsOpen} onOpenChange={setSettingsOpen} hideTrigger />
      )}
    </div>
  );
}
