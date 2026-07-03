import { useEffect, useState } from 'react';
import {
  fetchDirectoryCached,
  suggestConnection,
  requestConnection,
  type DirectoryBuilder,
} from '@/knowledge/connections';
import { useAuthStore } from '@/store/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HeartHandshake, CalendarClock, MailPlus, MapPin, X, Loader2, Check } from 'lucide-react';

const DISMISSED_KEY = 'rb-connection-suggestions-dismissed';

function getDismissed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(DISMISSED_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function addDismissed(id: string) {
  const next = getDismissed();
  next.add(id);
  sessionStorage.setItem(DISMISSED_KEY, JSON.stringify([...next]));
}

/**
 * When a conversation overlaps with what another opted-in builder is up
 * for, offer the connection right in the chat — their directory card
 * inline, with the same consent-first actions (book via their shared cal
 * link, or a double-opt-in intro request). Appears only on a genuine
 * topical match, one builder at a time, dismissible for the session.
 */
export function ConnectionSuggestion({ conversationText }: { conversationText: string }) {
  const user = useAuthStore(s => s.user);
  const [suggestion, setSuggestion] = useState<{ builder: DirectoryBuilder; matched: string[] } | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !conversationText.trim()) {
      setSuggestion(null);
      return;
    }
    let cancelled = false;
    fetchDirectoryCached().then(builders => {
      if (cancelled) return;
      setSuggestion(suggestConnection(conversationText, builders, getDismissed()));
    });
    return () => { cancelled = true; };
  }, [user, conversationText]);

  if (!suggestion) return null;
  const { builder } = suggestion;

  async function sendRequest() {
    setBusy(true);
    setError(null);
    try {
      await requestConnection(builder.id, message);
      setSent(true);
      setRequesting(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[85%] border border-dashed border-primary/40 rounded-xl p-3 space-y-1.5 bg-primary/5">
      <div className="flex items-center gap-1.5">
        <HeartHandshake className="size-3.5 text-primary shrink-0" />
        <span className="text-xs font-medium truncate">
          {builder.name} might be good to talk to
        </span>
        {builder.neighborhood && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <MapPin className="size-2.5" />
            {builder.neighborhood}
          </span>
        )}
        <button
          onClick={() => { addDismissed(builder.id); setSuggestion(null); }}
          className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
          title="Not now"
        >
          <X className="size-3" />
        </button>
      </div>
      {builder.note && (
        <p className="text-xs text-muted-foreground">"{builder.note}"</p>
      )}
      <div className="flex gap-3 items-center">
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
    </div>
  );
}
