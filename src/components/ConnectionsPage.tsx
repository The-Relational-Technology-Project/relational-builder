import { useEffect, useState } from 'react';
import { useUIStore } from '@/store/ui-store';
import { useAuthStore } from '@/store/auth-store';
import { useConnectionsStore } from '@/store/connections-store';
import { Button } from '@/components/ui/button';
import { BuildersDirectory } from '@/components/BuildersDirectory';
import { ConnectionSettings } from '@/components/ConnectionSettings';
import { HeartHandshake, X, Loader2, MailPlus } from 'lucide-react';

/**
 * The Connections page — a full-width space for the relational layer of the
 * network: requests waiting on you, RTP steward support, the directory of
 * builders who opted into connecting, and your own connection settings
 * (inline, not tucked in a dialog). Reached through the account menu — the
 * nav stays about building; the badge on your name says when there's
 * something here to check.
 */
export function ConnectionsPage() {
  const setConnectionsOpen = useUIStore(s => s.setConnectionsOpen);
  const user = useAuthStore(s => s.user);
  const refreshInbox = useConnectionsStore(s => s.refreshInbox);

  useEffect(() => {
    if (user) refreshInbox();
  }, [user, refreshInbox]);

  return (
    <div className="flex-1 overflow-y-auto h-full">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 md:py-12 space-y-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <HeartHandshake className="size-6 text-primary shrink-0" />
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Connections</h1>
              <p className="text-sm text-muted-foreground">
                Find other builders, get a hand from RTP stewards, and choose how
                you show up to the network.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs shrink-0" onClick={() => setConnectionsOpen(false)}>
            <X className="size-3.5" />
            Close
          </Button>
        </div>

        <PendingRequests />

        <BuildersDirectory />

        {user && <ConnectionSettings />}
      </div>
    </div>
  );
}

/**
 * Requests waiting on the signed-in builder — the in-app twin of the
 * accept/decline email. Same consent rules: accepting sends both people an
 * intro email with each other's addresses; declining is silent.
 */
function PendingRequests() {
  const inbox = useConnectionsStore(s => s.inbox);
  const respond = useConnectionsStore(s => s.respond);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (inbox.length === 0) return null;

  async function answer(id: string, decision: 'accept' | 'decline') {
    setBusy(`${id}-${decision}`);
    setError(null);
    const r = await respond(id, decision);
    if (r.error) setError(r.error);
    setBusy(null);
  }

  return (
    <section className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Waiting for you
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {inbox.map(r => (
          <div key={r.id} className="border border-primary/30 bg-primary/5 rounded-lg p-3 space-y-2">
            <div className="flex items-center gap-1.5 text-sm font-medium">
              <MailPlus className="size-3.5 text-primary shrink-0" />
              {r.from_name || 'A builder'} would like to connect
            </div>
            {r.message && <p className="text-xs text-muted-foreground">“{r.message}”</p>}
            <p className="text-xs text-muted-foreground">
              If you accept, you both get an intro email with each other's
              addresses. Declining is silent — they aren't notified.
            </p>
            <div className="flex gap-2 pt-0.5">
              <Button
                size="sm"
                className="h-7 text-xs"
                disabled={busy !== null}
                onClick={() => answer(r.id, 'accept')}
              >
                {busy === `${r.id}-accept` ? <Loader2 className="size-3 animate-spin" /> : 'Yes, introduce us'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={busy !== null}
                onClick={() => answer(r.id, 'decline')}
              >
                {busy === `${r.id}-decline` ? <Loader2 className="size-3 animate-spin" /> : 'No thanks'}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
