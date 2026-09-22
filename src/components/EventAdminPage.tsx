import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  fetchMyAdminEvents,
  fetchEventParticipants,
  addEventParticipant,
  removeEventParticipant,
  setEventActive,
  type AdminEvent,
  type EventParticipant,
} from '@/cloud/event-admin';
import { eventInviteLink } from '@/cloud/event-codes';
import { eventShowLink, fetchEventShow } from '@/cloud/event-join';
import { removeFromShowcase, type ShowcaseEntry } from '@/cloud/event-showcase';
import { openRoomKey } from '@/project/room-key';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  PartyPopper, Loader2, Copy, Check, Printer, Presentation, Users, X, Mail, ExternalLink, RefreshCw,
} from 'lucide-react';

/**
 * The Event Admin page — running a build-a-thon room without a steward.
 * A steward names admins by email on the Codes tab; this is what they get:
 * the room key and the presentation link, who has joined (add by email,
 * remove), the shelf (take any deck down), and the key's on/off switch.
 * Minting, dating and archiving codes stay on the Steward page. Every
 * action is a security-definer function that checks is_event_admin() —
 * this page is its hands, not its gate.
 */
export function EventAdminPage() {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [picked, setPicked] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMyAdminEvents().then(list => { if (!cancelled) setEvents(list); });
    return () => { cancelled = true; };
  }, []);

  const event = events?.find(e => e.code === picked) ?? events?.[0] ?? null;

  if (events === null) {
    return (
      <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3.5 animate-spin" /> Loading your events…
      </div>
    );
  }
  if (!event) {
    return (
      <div className="p-6 max-w-lg space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">Event admin</h1>
        <p className="text-sm text-muted-foreground">
          You aren't an admin of any event yet. A steward names event admins by
          email from the Steward page's Codes tab.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <PartyPopper className="size-5 text-primary" /> Event admin
          </h1>
          {events.length > 1 && (
            <select
              value={event.code}
              onChange={e => setPicked(e.target.value)}
              className="h-8 rounded-md border bg-background px-2 text-sm"
            >
              {events.map(e => (
                <option key={e.code} value={e.code}>{e.name} ({e.code})</option>
              ))}
            </select>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <EventConsole
          key={event.code}
          event={event}
          onEventChange={patch => setEvents(list => (list ?? []).map(e => (e.code === event.code ? { ...e, ...patch } : e)))}
          onError={setError}
        />
      </div>
    </div>
  );
}

function fmtDay(iso: string): string {
  return new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function EventConsole({
  event,
  onEventChange,
  onError,
}: {
  event: AdminEvent;
  onEventChange: (patch: Partial<AdminEvent>) => void;
  onError: (msg: string | null) => void;
}) {
  const [people, setPeople] = useState<EventParticipant[] | null>(null);
  const [decks, setDecks] = useState<ShowcaseEntry[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    onError(null);
    try {
      const [p, s] = await Promise.all([fetchEventParticipants(event.code), fetchEventShow(event.code)]);
      setPeople(p);
      setDecks([...s.entries].reverse());
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not load the event');
    }
  }, [event.code, onError]);

  useEffect(() => { void load(); }, [load]);

  const expired = !!event.expires_at && new Date(event.expires_at).getTime() < Date.now();
  const status = event.archived_at ? 'archived' : !event.active ? 'off' : expired ? 'expired' : 'live';

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(eventInviteLink(event));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError('Could not copy — the link is ' + eventInviteLink(event));
    }
  }

  async function toggleActive() {
    setBusy('active');
    onError(null);
    try {
      await setEventActive(event.code, !event.active);
      onEventChange({ active: !event.active });
    } catch (e) {
      onError(e instanceof Error ? e.message : 'That change did not save');
    } finally {
      setBusy(null);
    }
  }

  async function add(e: FormEvent) {
    e.preventDefault();
    const addr = email.trim().toLowerCase();
    if (!addr) return;
    setBusy('add');
    onError(null);
    setNote(null);
    try {
      const found = await addEventParticipant(event.code, addr);
      if (found) {
        setEmail('');
        setNote(`${addr} is in.`);
        const p = await fetchEventParticipants(event.code);
        setPeople(p);
        onEventChange({ joined: p.length });
      } else {
        setNote(`No Builder account uses ${addr} yet. Send them the room key — it makes the account and joins the event in one step.`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not add them');
    } finally {
      setBusy(null);
    }
  }

  async function remove(p: EventParticipant) {
    if (!window.confirm(`Remove ${p.display_name ?? p.email} from ${event.name}? Their account stays; their decks come off the shelf.`)) return;
    setBusy(`rm-${p.id}`);
    onError(null);
    try {
      await removeEventParticipant(event.code, p.id);
      setPeople(list => (list ?? []).filter(x => x.id !== p.id));
      setDecks(list => (list ?? []).filter(d => d.owner_id !== p.id));
      onEventChange({ joined: Math.max(0, event.joined - 1) });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not remove them');
    } finally {
      setBusy(null);
    }
  }

  async function removeDeck(d: ShowcaseEntry) {
    setBusy(`deck-${d.id}`);
    onError(null);
    try {
      await removeFromShowcase(d.id);
      setDecks(list => (list ?? []).filter(x => x.id !== d.id));
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not take that deck down');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* The event itself: what it is, whether the key works, the links */}
      <section className="rounded-xl border p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-base font-semibold tracking-wide">{event.code}</span>
          <span className="text-base">{event.name}</span>
          {event.studio_label && <Badge variant="outline" className="text-[10px]">{event.studio_label}</Badge>}
          <Badge
            variant="outline"
            className={`text-[10px] ${status === 'live' ? 'text-green-600 border-green-600/40' : 'text-muted-foreground'}`}
          >
            {status}
          </Badge>
          {event.event_date && (
            <span className="text-xs text-muted-foreground">
              {fmtDay(event.event_date)}{event.expires_at ? ` · open until ${fmtDay(event.expires_at)}` : ''}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
          <button onClick={copyLink} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />} {copied ? 'Copied' : 'Copy join link'}
          </button>
          <button
            onClick={() => {
              if (!openRoomKey({ name: event.name, code: event.code, link: eventInviteLink(event) })) {
                onError('The room key opens in a new tab — allow pop-ups for this site');
              }
            }}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <Printer className="size-3" /> Room key
          </button>
          <a
            href={eventShowLink(event.code)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            title="Every deck on the shelf, back to back, in the order they were shared — no sign-in needed to open it"
          >
            <Presentation className="size-3" /> Presentation
          </a>
          {!event.archived_at && (
            <button
              onClick={toggleActive}
              disabled={busy !== null}
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground underline decoration-dotted"
              title={event.active ? 'Stop the code from admitting anyone new' : 'Let the code admit people again'}
            >
              {busy === 'active' ? <Loader2 className="size-3 animate-spin" /> : null}
              {event.active ? 'turn the key off' : 'turn the key on'}
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          The presentation link opens without a sign-in, so it can go to whoever runs the projector.
        </p>
      </section>

      {/* The room */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">In the room</h2>
          <span className="text-xs text-muted-foreground">{people ? `${people.length} joined` : ''}</span>
          <button onClick={() => { void load(); }} className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <RefreshCw className="size-3" /> Refresh
          </button>
        </div>
        <form onSubmit={add} className="flex flex-wrap gap-1.5">
          <Input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Add a builder by email"
            className="h-8 text-sm w-72"
          />
          <Button type="submit" size="sm" className="h-8 text-xs" disabled={busy !== null || !email.trim()}>
            {busy === 'add' ? <Loader2 className="size-3 mr-1 animate-spin" /> : <Mail className="size-3 mr-1" />}
            Add
          </Button>
        </form>
        {note && <p className="text-xs text-muted-foreground">{note}</p>}
        {people === null ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-3.5 animate-spin" /> Loading…</p>
        ) : people.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody has joined yet. Share the room key.</p>
        ) : (
          <div className="space-y-1.5">
            {people.map(p => (
              <div key={p.id} className="rounded-lg border px-3 py-2 flex items-center gap-3 flex-wrap text-sm">
                <span className="font-medium">{p.display_name ?? p.full_name ?? p.email}</span>
                <span className="text-xs text-muted-foreground">{p.email}</span>
                {p.neighborhood && <span className="text-xs text-muted-foreground/70">{p.neighborhood}</span>}
                <button
                  onClick={() => void remove(p)}
                  disabled={busy !== null}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  title="Remove from the event"
                >
                  {busy === `rm-${p.id}` ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />} remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* The shelf */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Presentation className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">On the shelf</h2>
          <span className="text-xs text-muted-foreground">{decks ? `${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}` : ''}</span>
        </div>
        {decks === null ? null : decks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No decks yet. They appear as builders use Share Live and pin to the event.
          </p>
        ) : (
          <div className="space-y-1.5">
            {decks.map(d => (
              <div key={d.id} className="rounded-lg border px-3 py-2 flex items-center gap-3 flex-wrap text-sm">
                <span className="font-medium">{d.project_name}</span>
                {d.builder_name && <span className="text-xs text-muted-foreground">by {d.builder_name}</span>}
                <span className="text-xs text-muted-foreground/70">{fmtDay(d.created_at)}</span>
                <a href={d.deck_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                  <ExternalLink className="size-3" /> Slides
                </a>
                <button
                  onClick={() => void removeDeck(d)}
                  disabled={busy !== null}
                  className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                  title="Take this deck off the shelf and the presentation"
                >
                  {busy === `deck-${d.id}` ? <Loader2 className="size-3 animate-spin" /> : <X className="size-3" />} take down
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
