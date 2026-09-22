import { useCallback, useEffect, useState } from 'react';
import { removeFromShowcase, type ShowcaseEntry } from '@/cloud/event-showcase';
import { fetchEventShow, eventShowLink } from '@/cloud/event-join';
import { useAuthStore } from '@/store/auth-store';
import { Presentation, ExternalLink, X, RefreshCw, Loader2 } from 'lucide-react';

/** The gallery's scope value for the viewer's event shelf — a token no
 *  studio slug can collide with (slugs are [a-z0-9-]) */
export const EVENT_SCOPE = 'event:wall';

/**
 * An event's demo wall as a gallery shelf — what the room built, pinned by
 * the builders themselves via Share Live. Only the event's participants
 * have this shelf (RLS keeps the rows to them too). Newest first here, the
 * way a wall reads; the presentation page walks the same decks in the
 * order they were shared.
 */
export function EventShelf({ code, name }: { code: string; name: string }) {
  const user = useAuthStore(s => s.user);
  const [entries, setEntries] = useState<ShowcaseEntry[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const show = await fetchEventShow(code);
      setEntries([...show.entries].reverse());
    } finally {
      setRefreshing(false);
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  async function remove(id: string) {
    setBusyId(id);
    try {
      await removeFromShowcase(id);
      setEntries(list => (list ?? []).filter(e => e.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <a
          href={eventShowLink(code)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
          title="Every deck on this shelf, back to back, in the order they were shared"
        >
          <Presentation className="size-3" /> Present the room's decks
        </a>
        <button
          onClick={() => { void load(); }}
          disabled={refreshing}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          {refreshing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Refresh
        </button>
      </div>

      {entries === null ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="size-3.5 animate-spin" /> Loading the shelf…
        </p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing on the {name} shelf yet. When someone at the event uses Share
          Live and pins their build, it shows up here for the whole room.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(entry => (
            <div key={entry.id} className="rounded-lg border overflow-hidden flex flex-col bg-background">
              {entry.screenshot_url && (
                <a href={entry.deck_url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={entry.screenshot_url}
                    alt={`${entry.project_name} screenshot`}
                    loading="lazy"
                    className="w-full h-32 object-cover object-top border-b"
                  />
                </a>
              )}
              <div className="p-3 space-y-1 flex-1 flex flex-col">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-medium leading-snug">{entry.project_name}</span>
                  {user?.id === entry.owner_id && (
                    <button
                      onClick={() => void remove(entry.id)}
                      disabled={busyId !== null}
                      className="ml-auto text-muted-foreground hover:text-destructive shrink-0"
                      title="Take your project off the shelf"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                {entry.one_liner && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{entry.one_liner}</p>
                )}
                {entry.builder_name && (
                  <p className="text-xs text-muted-foreground/70">by {entry.builder_name}</p>
                )}
                <div className="flex gap-3 pt-1.5 mt-auto">
                  <a
                    href={entry.deck_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <Presentation className="size-3" />
                    Slides
                  </a>
                  {entry.demo_url && (
                    <a
                      href={entry.demo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <ExternalLink className="size-3" />
                      Try it
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
