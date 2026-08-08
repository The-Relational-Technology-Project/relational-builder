import { useEffect, useState } from 'react';
import {
  fetchShowcase,
  removeFromShowcase,
  type ShowcaseEntry,
} from '@/cloud/event-showcase';
import { useAuthStore } from '@/store/auth-store';
import { Presentation, ExternalLink, X, PartyPopper } from 'lucide-react';

/**
 * The event demo wall — what the room built, pinned by the builders
 * themselves via Share Live. One section per event, newest events first.
 * Entries fade with their deck links (30 days), so outside event season
 * this renders nothing at all.
 */
export function EventShowcaseSection() {
  const user = useAuthStore(s => s.user);
  const [entries, setEntries] = useState<ShowcaseEntry[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchShowcase().then(setEntries);
  }, []);

  if (entries.length === 0) return null;

  // Group by event, keeping the fetch's newest-first order between events
  const byEvent = new Map<string, ShowcaseEntry[]>();
  for (const e of entries) {
    const list = byEvent.get(e.event_name) ?? [];
    list.push(e);
    byEvent.set(e.event_name, list);
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await removeFromShowcase(id);
      setEntries(list => list.filter(e => e.id !== id));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {[...byEvent.entries()].map(([eventName, items]) => (
        <section key={eventName} className="rounded-xl border border-dashed p-4 space-y-3">
          <div className="flex items-center gap-2">
            <PartyPopper className="size-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold">{eventName} — what the room built</h2>
            <span className="text-xs text-muted-foreground ml-auto shrink-0">
              {items.length} {items.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(entry => (
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
                        title="Take your project off the wall"
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
        </section>
      ))}
    </div>
  );
}
