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

const MEMORY_KEY = 'rb-connection-suggestions';

/**
 * How many times we'll ever raise the same person, unprompted.
 *
 * An introduction you didn't ask for is worth making once, maybe twice — a
 * conversation about mutual aid will keep matching the same builder's note
 * forever, and a suggestion that returns on every reload stops reading as an
 * offer and starts reading as a nag. Two is the whole budget, for good.
 */
const MAX_OFFERS_PER_BUILDER = 2;

interface BuilderMemory {
  /** Times this builder's card has actually been put in front of this person */
  offers: number;
  /** They waved it off by hand — a stronger signal than simply not acting */
  dismissed?: boolean;
}

type Memory = Record<string, BuilderMemory>;

/**
 * localStorage, not sessionStorage: dismissal used to die with the tab, so
 * every reload resurrected someone the person had already declined — which is
 * exactly the "I've x'ed this out a few times" complaint. Saying no once has
 * to still mean no tomorrow.
 */
function readMemory(): Memory {
  try {
    const raw = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? '{}');
    return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Memory) : {};
  } catch {
    return {};
  }
}

function writeMemory(memory: Memory): void {
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
  } catch {
    // A full or blocked localStorage shouldn't take the chat down with it
  }
}

/** Builders we've said our piece about: waved off, or already offered twice */
function retiredIds(memory: Memory): Set<string> {
  return new Set(
    Object.entries(memory)
      .filter(([, m]) => m.dismissed || m.offers >= MAX_OFFERS_PER_BUILDER)
      .map(([id]) => id),
  );
}

/** An explicit "not this person" — permanent, and it means it */
function retire(id: string): void {
  const memory = readMemory();
  memory[id] = { offers: memory[id]?.offers ?? 0, dismissed: true };
  writeMemory(memory);
}

/**
 * Spending one of a builder's two offers. Module-level rather than per-mount
 * so that re-renders, a re-run effect as the conversation grows, and React's
 * double-invoked effects in development all count as the one showing they
 * really are.
 */
const countedThisSession = new Set<string>();

function countOffer(id: string): void {
  if (countedThisSession.has(id)) return;
  countedThisSession.add(id);
  const memory = readMemory();
  memory[id] = { ...memory[id], offers: (memory[id]?.offers ?? 0) + 1 };
  writeMemory(memory);
}

/**
 * When a conversation overlaps with what another opted-in builder is up
 * for, offer the connection right in the chat — their directory card
 * inline, with the same consent-first actions (book via their shared cal
 * link, or a double-opt-in intro request). Appears only on a genuine
 * topical match, one builder at a time, and at most twice per builder ever —
 * dismissing or acting on one retires them for good.
 */
export function ConnectionSuggestion({ conversationText }: { conversationText: string }) {
  const user = useAuthStore(s => s.user);
  const eventCode = useAuthStore(s => s.profile?.event_code ?? null);
  const [suggestion, setSuggestion] = useState<{ builder: DirectoryBuilder; matched: string[]; sameEvent: boolean } | null>(null);
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
      const next = suggestConnection(conversationText, builders, retiredIds(readMemory()), eventCode);
      // Showing it is what spends an offer — a match we never render (because
      // this builder is already retired) costs nothing.
      if (next) countOffer(next.builder.id);
      setSuggestion(next);
    });
    return () => { cancelled = true; };
  }, [user, conversationText, eventCode]);

  if (!suggestion) return null;
  const { builder } = suggestion;

  async function sendRequest() {
    setBusy(true);
    setError(null);
    try {
      await requestConnection(builder.id, message);
      // The introduction has been made — there is nothing left to suggest
      retire(builder.id);
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
          {suggestion.sameEvent
            ? `${builder.name} is at your event — go find them`
            : `${builder.name} might be good to talk to`}
        </span>
        {builder.neighborhood && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
            <MapPin className="size-2.5" />
            {builder.neighborhood}
          </span>
        )}
        <button
          onClick={() => { retire(builder.id); setSuggestion(null); }}
          className="ml-auto text-muted-foreground hover:text-foreground shrink-0"
          title={`Don't suggest ${builder.name} again`}
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
