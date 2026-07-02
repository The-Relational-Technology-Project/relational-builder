import { useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, HeartHandshake } from 'lucide-react';

/**
 * Connection settings — fully opt-in and transparent. A builder chooses to
 * appear in the directory, what note shows, whether their calendar link is
 * public, and whether others may request a double-opt-in email intro.
 * Email addresses are never shown anywhere; intros only happen when both
 * people say yes.
 */
export function ConnectionsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const profile = useAuthStore(s => s.profile);
  const saveProfile = useAuthStore(s => s.saveProfile);

  const [optIn, setOptIn] = useState(profile?.open_to_connecting ?? false);
  const [note, setNote] = useState(profile?.connect_note ?? '');
  const [calLink, setCalLink] = useState(profile?.cal_link ?? '');
  const [allowRequests, setAllowRequests] = useState(profile?.allow_requests ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const r = await saveProfile({
      open_to_connecting: optIn,
      connect_note: note.trim() || null,
      cal_link: calLink.trim() || null,
      allow_requests: optIn ? allowRequests : false,
    });
    setSaving(false);
    if (r.error) setError(r.error);
    else onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HeartHandshake className="size-4" />
            Connections
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={optIn}
              onChange={e => setOptIn(e.target.checked)}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <span>
              <span className="text-sm font-medium block">Show me to other builders</span>
              <span className="text-xs text-muted-foreground">
                Your name, neighborhood, and the note below appear in the builders
                directory for signed-in builders. Your email is never shown.
              </span>
            </span>
          </label>

          {optIn && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="conn-note" className="text-xs">What you're up for (shown in the directory)</Label>
                <Input
                  id="conn-note"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  maxLength={140}
                  placeholder="Happy to talk tool libraries, phone trees, and first builds"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="conn-cal" className="text-xs">Calendar link (optional)</Label>
                <Input
                  id="conn-cal"
                  value={calLink}
                  onChange={e => setCalLink(e.target.value)}
                  placeholder="https://cal.com/you or Calendly"
                />
                <p className="text-[11px] text-muted-foreground">
                  Sharing this shows a "Book a call" button on your card — leave it
                  empty if you'd rather not be bookable directly.
                </p>
              </div>
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowRequests}
                  onChange={e => setAllowRequests(e.target.checked)}
                  className="mt-0.5 accent-[var(--primary)]"
                />
                <span>
                  <span className="text-sm font-medium block">Allow intro requests</span>
                  <span className="text-xs text-muted-foreground">
                    Builders can send you a short note by email. You get accept/decline
                    links; only if you accept do you both receive an intro email with
                    each other's addresses. Declining is silent.
                  </span>
                </span>
              </label>
            </>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : 'Save'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
