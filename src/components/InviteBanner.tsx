import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useCloudStore } from '@/store/cloud-store';
import { useUIStore } from '@/store/ui-store';
import {
  clearPendingInvite,
  getPendingInvite,
  inviteMatches,
  requestProjectAccess,
  type PendingInvite,
} from '@/cloud/invite-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Users, Loader2, Check, X } from 'lucide-react';

/**
 * What an invite link lands on.
 *
 * Three arrivals, and until now only the happy one worked — and only by
 * accident, because membership is matched on the JWT's email and the project
 * just quietly appeared in the list:
 *
 *   - Signed out → the sign-in dialog, prefilled with the invited address.
 *   - Signed in as the invited address → open the project. No ceremony.
 *   - Signed in as someone else → say so, in both addresses. This is the case
 *     that used to be indistinguishable from a broken link: the project isn't
 *     yours to see, so nothing rendered, so nothing had gone wrong as far as
 *     the screen was concerned.
 *
 * The third case is the whole point. Naming both addresses is most of the fix
 * — "you're signed in as the wrong one" is a thing a person can act on — and
 * the ask-for-access button covers the case where the invited address isn't
 * one they actually want to use.
 */
export function InviteBanner() {
  const user = useAuthStore(s => s.user);
  const openProject = useCloudStore(s => s.openProject);
  const setView = useUIStore(s => s.setView);

  const [invite, setInvite] = useState<PendingInvite | null>(() => getPendingInvite());
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matches = !!invite && inviteMatches(invite, user?.email);

  // Signed out: the invite is what they came for, so the sign-in dialog opens
  // with the right address already in it rather than an empty field they have
  // to remember the answer to.
  useEffect(() => {
    if (!invite || user) return;
    useAuthStore.getState().promptSignIn(invite.email);
  }, [invite, user]);

  // Right address: just open it. The banner isn't the destination.
  useEffect(() => {
    if (!invite || !user || !matches || opening) return;
    setOpening(true);
    openProject(invite.projectId).then(({ error: err }) => {
      if (err) {
        // Membership is applied at first sign-in by a trigger; a brand-new
        // account can beat it here. Say so rather than clearing the invite —
        // a reload will find it waiting.
        setOpenError(err);
        return;
      }
      clearPendingInvite();
      setInvite(null);
      setView('builder');
    });
  }, [invite, user, matches, opening, openProject, setView]);

  if (!invite || !user) return null;

  const dismiss = () => {
    clearPendingInvite();
    setInvite(null);
  };

  if (matches) {
    if (!openError) return null;
    return (
      <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
        <p className="text-sm flex-1">
          You're signed in as the invited address, but the project didn't open
          yet — an invitation can take a moment to attach to a brand-new
          account. Reloading usually sorts it.
        </p>
        <Button size="sm" variant="outline" className="shrink-0" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground shrink-0" title="Dismiss">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  async function send() {
    if (!invite) return;
    setBusy(true);
    setError(null);
    try {
      await requestProjectAccess(invite, message);
      setSent(true);
      setAsking(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-4 mt-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <Users className="size-4 text-primary shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm">
            This invitation was sent to <strong className="break-all">{invite.email}</strong>.
            You're signed in as <strong className="break-all">{user.email}</strong>, so the
            project isn't in this account.
          </p>
          {sent ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="size-3 text-green-600 shrink-0" />
              Asked the project's owner to invite {user.email} — you'll get the
              usual invite email if they add you.
            </p>
          ) : (
            !asking && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                <button
                  onClick={() => {
                    // Signing out first, so the magic link doesn't land back
                    // in the account that can't see the project
                    const invited = invite.email;
                    useAuthStore.getState().signOut().then(() => {
                      useAuthStore.getState().promptSignIn(invited);
                    });
                  }}
                  className="text-xs text-primary hover:underline"
                >
                  Sign in as {invite.email}
                </button>
                <button
                  onClick={() => setAsking(true)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Ask to be added as {user.email}
                </button>
              </div>
            )
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-muted-foreground hover:text-foreground shrink-0"
          title="Dismiss"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {asking && (
        <div className="space-y-1.5 pl-6">
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={500}
            placeholder="Optional: a line for them — “this is the account I actually build from”"
            className="h-8 text-xs"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAsking(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={send} disabled={busy}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : 'Send request'}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive pl-6">{error}</p>}
    </div>
  );
}
