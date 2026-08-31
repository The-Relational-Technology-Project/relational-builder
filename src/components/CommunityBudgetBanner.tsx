import { useState } from 'react';
import { useCommunityStore } from '@/store/community-store';
import { useProviderStore } from '@/store/provider-store';
import { useAuthStore } from '@/store/auth-store';
import { sendBudgetFeedback } from '@/cloud/contact';
import { ProviderSettings } from '@/components/ProviderSettings';
import { Button } from '@/components/ui/button';
import { KeyRound, MessageCircleHeart, X } from 'lucide-react';

/**
 * The community plan's edge, handled with warmth. Free building has a daily
 * token budget (server-enforced in the llm-proxy). When someone gets close
 * to it — or hits it — this banner explains what happened and offers the
 * two honest paths: come back when the budget resets, or add a personal API
 * key and keep going without limits.
 *
 * The "almost there" nudge is dismissible per day; the "you've hit it"
 * state stays until the day rolls over, because the composer genuinely
 * won't work and silence would read as breakage.
 *
 * Hitting the budget is also the one moment someone truly feels how it's
 * sized — so the exhausted state invites feedback and offers to send the
 * team a note (email included only if they opt in).
 */

const NUDGE_AT = 0.8;
const DISMISS_KEY = 'rb-budget-nudge-dismissed';

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The budget day is the UTC calendar date (mirrors the llm-proxy gate), so
 *  it resets at midnight UTC — evening in the Americas. Saying "tomorrow"
 *  reads wrong to someone who hit it at 9am; say the actual local time. */
function resetLabel(): string {
  const reset = new Date();
  reset.setUTCHours(24, 0, 0, 0);
  const time = reset.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return reset.getDate() === new Date().getDate() ? `${time} today` : `${time} tonight`;
}

export function CommunityBudgetBanner() {
  const active = useCommunityStore(s => s.active);
  const dailyBudget = useCommunityStore(s => s.dailyBudget);
  const usedToday = useCommunityStore(s => s.usedToday);
  const hasOwnKey = useProviderStore(s => !!s.apiKeys['claude']);
  const userEmail = useAuthStore(s => s.user?.email);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === today(),
  );
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [includeEmail, setIncludeEmail] = useState(false);
  const [noteState, setNoteState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  // Builders on their own key never see budget talk
  if (!active || hasOwnKey || dailyBudget <= 0) return null;

  const ratio = usedToday / dailyBudget;
  const exhausted = ratio >= 1;
  if (!exhausted && (ratio < NUDGE_AT || dismissed)) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, today());
    setDismissed(true);
  };

  const sendNote = async () => {
    if (!note.trim() || noteState === 'sending') return;
    setNoteState('sending');
    try {
      await sendBudgetFeedback({
        message: note.trim(),
        email: includeEmail ? userEmail : undefined,
      });
      setNoteState('sent');
    } catch {
      setNoteState('error');
    }
  };

  return (
    <div
      className={`mx-4 mb-2 rounded-lg border px-3 py-2.5 ${
        exhausted
          ? 'border-primary/40 bg-primary/10'
          : 'border-amber-500/40 bg-amber-500/10'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-1">
          <p className="text-sm">
            {exhausted
              ? `You've used today's free community building — it resets at ${resetLabel()}.`
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
      </div>

      {exhausted && (
        <div className="mt-2.5 border-t border-primary/20 pt-2.5 space-y-2">
          {noteState === 'sent' ? (
            <p className="text-xs text-muted-foreground">
              Thank you — your note is on its way to the team. It genuinely
              helps us size the daily budget well.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Also: is your project at a good stage to share with neighbors?
                Would a bigger daily budget help, or being able to pull from a
                weekly budget? We'd appreciate feedback as we try to allocate
                resources thoughtfully.
              </p>
              {!noteOpen ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs"
                  onClick={() => setNoteOpen(true)}
                >
                  <MessageCircleHeart className="size-3.5 mr-1.5" />
                  Send the team a note
                </Button>
              ) : (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="How is the daily budget working for you? What would help?"
                    rows={3}
                    maxLength={4000}
                    className="w-full resize-none rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {userEmail && (
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={includeEmail}
                          onChange={e => setIncludeEmail(e.target.checked)}
                          className="size-3.5 accent-primary"
                        />
                        Include my email ({userEmail}) so the team can follow up
                      </label>
                    )}
                    <Button
                      size="sm"
                      className="h-7 px-3 text-xs"
                      disabled={!note.trim() || noteState === 'sending'}
                      onClick={sendNote}
                    >
                      {noteState === 'sending' ? 'Sending…' : 'Send to the team'}
                    </Button>
                    {noteState === 'error' && (
                      <span className="text-xs text-destructive">
                        Couldn't send just now — try again in a moment.
                      </span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {settingsOpen && (
        <ProviderSettings open={settingsOpen} onOpenChange={setSettingsOpen} hideTrigger />
      )}
    </div>
  );
}
