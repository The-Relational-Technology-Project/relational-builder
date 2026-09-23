import { useState } from 'react';
import { requestConnection, type DirectoryBuilder } from '@/knowledge/connections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CalendarClock, MailPlus, Loader2, Check, CircleUser } from 'lucide-react';

/**
 * The consent-first ways to act on a suggested connection — the builder's
 * page, their shared cal link, and a double-opt-in intro request. Shared by
 * the in-chat suggestion card and the Notepad desk, so a saved offer can be
 * acted on exactly as the pop-up could.
 */
export function ConnectionActions({
  builder,
  sent,
  onRequested,
}: {
  builder: DirectoryBuilder;
  /** An intro request already went out from this card */
  sent: boolean;
  /** The request was sent — the caller retires or marks the card */
  onRequested: () => void;
}) {
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendRequest() {
    setBusy(true);
    setError(null);
    try {
      await requestConnection(builder.id, message);
      setRequesting(false);
      onRequested();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-x-3 gap-y-1 items-center">
        {builder.profile_url && (
          <a
            href={builder.profile_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <CircleUser className="size-3" />
            Builder page
          </a>
        )}
        {builder.cal_link && (
          <a
            href={builder.cal_link}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <CalendarClock className="size-3" />
            Book a call
          </a>
        )}
        {builder.allow_requests && (sent ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Check className="size-3" />
            Request sent — if they accept, you'll both get an intro email
          </span>
        ) : !requesting && (
          <button
            onClick={() => setRequesting(true)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <MailPlus className="size-3" />
            Request intro
          </button>
        ))}
      </div>
      {requesting && (
        <div className="space-y-1.5 pt-0.5">
          <Input
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={500}
            placeholder={`A short note for ${builder.name} — what you're building, why you'd like to connect`}
            className="h-8 text-xs"
          />
          <div className="flex gap-2 justify-end">
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setRequesting(false)} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" className="h-6 text-xs" onClick={sendRequest} disabled={busy || !message.trim()}>
              {busy ? <Loader2 className="size-3 animate-spin" /> : 'Send request'}
            </Button>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}
