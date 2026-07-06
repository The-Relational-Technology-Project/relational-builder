import { useCallback, useEffect, useState } from 'react';
import {
  adminListRequests,
  adminDecideRequest,
  type AccountRequest,
} from '@/cloud/account-requests';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, Loader2 } from 'lucide-react';

/**
 * The steward's door list: pending account requests with one-tap approve /
 * decline, plus recent decisions for context. Visibility is gated by email
 * client-side for convenience; the admin-requests edge function is the real
 * boundary.
 */
export function SuperAdminDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(await adminListRequests());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  async function decide(id: string, action: 'approve' | 'decline') {
    setBusyId(id);
    setError(null);
    try {
      await adminDecideRequest(id, action);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'That decision did not save');
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter(r => r.status === 'pending');
  const decided = requests.filter(r => r.status !== 'pending').slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Account requests</DialogTitle>
        </DialogHeader>

        {error && <p className="text-xs text-destructive">{error}</p>}

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading…
          </p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No pending requests — the door is quiet.
          </p>
        ) : (
          <div className="space-y-3">
            {pending.map(r => (
              <div key={r.id} className="rounded-lg border p-3 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{r.name || r.email}</span>
                  {r.name && (
                    <span className="text-xs text-muted-foreground truncate">{r.email}</span>
                  )}
                  <span className="ml-auto text-xs text-muted-foreground/70 shrink-0">
                    {new Date(r.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                </div>
                {r.neighborhood && (
                  <p className="text-xs text-muted-foreground">From {r.neighborhood}</p>
                )}
                {r.reason && (
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{r.reason}</p>
                )}
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-7 text-xs"
                    disabled={busyId !== null}
                    onClick={() => decide(r.id, 'approve')}
                  >
                    {busyId === r.id ? (
                      <Loader2 className="size-3 mr-1 animate-spin" />
                    ) : (
                      <Check className="size-3 mr-1" />
                    )}
                    Approve — sends welcome email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={busyId !== null}
                    onClick={() => decide(r.id, 'decline')}
                  >
                    <X className="size-3 mr-1" />
                    Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {decided.length > 0 && (
          <div className="space-y-1.5 pt-1">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Recent decisions</p>
            {decided.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-xs">
                <Badge
                  variant="outline"
                  className={r.status === 'approved' ? 'text-green-600 border-green-600/40' : 'text-muted-foreground'}
                >
                  {r.status}
                </Badge>
                <span className="truncate">{r.name || r.email}</span>
                {r.decided_at && (
                  <span className="ml-auto text-muted-foreground/60 shrink-0">
                    {new Date(r.decided_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
