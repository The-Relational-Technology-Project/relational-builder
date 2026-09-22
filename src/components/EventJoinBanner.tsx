import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { useStudioStore } from '@/store/studio-store';
import { takePendingEvent, joinEvent, type JoinedEvent } from '@/cloud/event-join';
import { PartyPopper, X } from 'lucide-react';

/**
 * What a room key lands on when the scanner already has an account.
 *
 * The landing stashed the ?ref=CODE; here, once someone is signed in, the
 * code is spent on join_event(). A live event code stamps their profile and
 * seats them in the event's studio — from then on Share Live offers the
 * event's demo wall, and the steward's count includes them. Anything else
 * (a builder's personal code, a switched-off event) is cleared quietly: a
 * newcomer already spent it at the door, and there is nothing else to say.
 */
export function EventJoinBanner() {
  const user = useAuthStore(s => s.user);
  const [joined, setJoined] = useState<JoinedEvent | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const code = takePendingEvent();
    if (!code) return;
    let cancelled = false;
    joinEvent(code)
      .then(result => {
        if (cancelled || !result) return;
        setJoined(result);
        void useAuthStore.getState().refreshProfile();
        if (result.studio_slug) void useStudioStore.getState().loadMemberships();
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Could not join the event');
      });
    return () => { cancelled = true; };
  }, [user]);

  if (!user || (!joined && !error)) return null;

  const dismiss = () => { setJoined(null); setError(null); };

  if (error) {
    return (
      <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
        <p className="text-sm flex-1">
          The event code didn't take: {error}. Scan the room key again, or ask the host.
        </p>
        <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5">
      <PartyPopper className="size-4 text-primary shrink-0" />
      <p className="text-sm flex-1">
        You're in <strong>{joined!.name}</strong>
        {joined!.studio_label ? <> and a member of <strong>{joined!.studio_label}</strong></> : null}.
        When you Share Live, your build can go on the event's demo wall.
      </p>
      <button onClick={dismiss} className="text-muted-foreground hover:text-foreground" aria-label="Dismiss">
        <X className="size-4" />
      </button>
    </div>
  );
}
