import { useCallback, useEffect, useState } from 'react';
import { fetchEventShow, type EventShow } from '@/cloud/event-join';
import type { ShowcaseEntry } from '@/cloud/event-showcase';
import { ShowcaseContact } from '@/components/EventShowcase';
import { LANDING_COLORS as C } from '@/components/Landing';
import {
  Presentation,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  X,
  RefreshCw,
  Loader2,
} from 'lucide-react';

/**
 * /show/CODE — one event's Share Live decks, back to back, in the order
 * they were shared. The page a steward puts on the projector at demo time:
 * a running order to read from, and a Present mode that walks every deck
 * in sequence (each deck's own three slides, then the next builder's).
 *
 * Public, like /buildathon: the projector laptop needn't be signed in. The
 * wall rows it reads are public already; the code only picks the event.
 * It re-reads itself every minute, so decks pinned during the event appear
 * without a reload.
 */
export function EventShowPage({ code }: { code: string }) {
  const [show, setShow] = useState<EventShow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [presenting, setPresenting] = useState<number | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setShow(await fetchEventShow(code));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load the event');
    } finally {
      setRefreshing(false);
    }
  }, [code]);

  useEffect(() => {
    void load();
    const t = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    document.title = show?.name ? `${show.name} — Share Live` : 'Share Live';
  }, [show?.name]);

  if (presenting !== null && show && show.entries.length > 0) {
    return (
      <Presenter
        entries={show.entries}
        index={Math.min(presenting, show.entries.length - 1)}
        onIndex={setPresenting}
        onExit={() => setPresenting(null)}
      />
    );
  }

  return (
    <div
      className="min-h-dvh overflow-y-auto"
      style={{ background: C.bg, color: C.ink, fontFamily: "'Inter Variable', system-ui, sans-serif" }}
    >
      <div className="max-w-3xl mx-auto px-6 py-10 sm:py-14 space-y-8">
        <header className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em]" style={{ color: C.orange }}>
            Share Live
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {show?.name ?? (show ? 'No event with this code' : 'Loading…')}
          </h1>
          {show && show.name && (
            <p className="text-sm" style={{ color: C.muted }}>
              {show.entries.length === 0
                ? 'Nothing shared yet. Decks appear here as builders Share Live and pin to the wall.'
                : `${show.entries.length} ${show.entries.length === 1 ? 'deck' : 'decks'}, in the order they were shared. Room key ${code}.`}
            </p>
          )}
        </header>

        {error && <p className="text-sm" style={{ color: C.orangeDeep }}>{error}</p>}

        {show && show.entries.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPresenting(0)}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white"
              style={{ background: C.orange }}
            >
              <Presentation className="size-4" />
              Present from the start
            </button>
            <button
              onClick={() => { void load(); }}
              className="inline-flex items-center gap-1.5 text-sm"
              style={{ color: C.muted }}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              Refresh
            </button>
          </div>
        )}

        {show && show.entries.length > 0 && (
          <ol className="space-y-3">
            {show.entries.map((entry, i) => (
              <li
                key={entry.id}
                className="flex gap-4 rounded-xl border p-3 sm:p-4"
                style={{ background: C.card, borderColor: C.border }}
              >
                <div
                  className="w-8 shrink-0 text-lg font-semibold tabular-nums pt-0.5"
                  style={{ color: C.orange }}
                >
                  {i + 1}
                </div>
                {entry.screenshot_url ? (
                  <img
                    src={entry.screenshot_url}
                    alt=""
                    className="hidden sm:block w-36 h-24 object-cover object-top rounded-md shrink-0"
                    style={{ border: `1px solid ${C.border}` }}
                  />
                ) : null}
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h2 className="font-semibold truncate">{entry.project_name}</h2>
                    {entry.builder_name && (
                      <span className="text-sm" style={{ color: C.muted }}>by {entry.builder_name}</span>
                    )}
                  </div>
                  {entry.one_liner && <p className="text-sm" style={{ color: C.body }}>{entry.one_liner}</p>}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 text-xs" style={{ color: C.muted }}>
                    <span>{formatTime(entry.created_at)}</span>
                    <ShowcaseContact entry={entry} className="max-w-full" />
                    <button
                      onClick={() => setPresenting(i)}
                      className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                      style={{ color: C.orangeDeep }}
                    >
                      <Presentation className="size-3" /> Present from here
                    </button>
                    <a
                      href={entry.deck_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                    >
                      <ExternalLink className="size-3" /> Slides
                    </a>
                    {entry.demo_url && (
                      <a
                        href={entry.demo_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 hover:underline underline-offset-4"
                      >
                        <ExternalLink className="size-3" /> Open the app
                      </a>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}

        <p className="text-xs" style={{ color: C.muted }}>
          A deck is on this list when its builder ticked "pin to the demo wall" in
          Share Live. Re-sharing a project moves it to the end. Links lapse 30 days
          after sharing, and the list fades with them.
        </p>
      </div>
    </div>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/**
 * Present mode: the current deck fills the screen in an iframe; the strip
 * below moves between builders. Decks made after this page shipped post
 * rb-deck-next / rb-deck-prev when clicked past their last or first slide,
 * so one clicker walks the whole event; older decks wrap on themselves and
 * the strip's arrows do the moving.
 */
function Presenter({
  entries,
  index,
  onIndex,
  onExit,
}: {
  entries: ShowcaseEntry[];
  index: number;
  onIndex: (i: number) => void;
  onExit: () => void;
}) {
  const entry = entries[index];
  const next = useCallback(() => onIndex(Math.min(entries.length - 1, index + 1)), [entries.length, index, onIndex]);
  const prev = useCallback(() => onIndex(Math.max(0, index - 1)), [index, onIndex]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const type = (e.data as { type?: string } | null)?.type;
      if (type === 'rb-deck-next') next();
      if (type === 'rb-deck-prev') prev();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onExit();
      // The iframe owns the arrow keys once focused; these cover the strip
      if (e.key === 'ArrowRight' || e.key === 'PageDown') next();
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') prev();
    };
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('message', onMessage);
      window.removeEventListener('keydown', onKey);
    };
  }, [next, prev, onExit]);

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: '#2A1F18' }}>
      <iframe
        key={entry.id}
        src={entry.deck_url}
        title={entry.project_name}
        className="flex-1 w-full border-0 bg-white"
        allow="fullscreen"
      />
      <div
        className="flex items-center gap-3 px-3 py-2 text-sm text-white/90"
        style={{ background: '#2A1F18' }}
      >
        <button onClick={prev} disabled={index === 0} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" aria-label="Previous builder">
          <ChevronLeft className="size-5" />
        </button>
        <span className="tabular-nums text-white/60">{index + 1} / {entries.length}</span>
        <span className="truncate">
          <strong>{entry.project_name}</strong>
          {entry.builder_name ? <span className="text-white/60"> by {entry.builder_name}</span> : null}
        </span>
        <button onClick={next} disabled={index === entries.length - 1} className="p-1.5 rounded hover:bg-white/10 disabled:opacity-30" aria-label="Next builder">
          <ChevronRight className="size-5" />
        </button>
        <button onClick={onExit} className="ml-auto inline-flex items-center gap-1 p-1.5 rounded hover:bg-white/10 text-white/70" aria-label="Exit">
          <X className="size-4" /> <span className="hidden sm:inline">Esc</span>
        </button>
      </div>
    </div>
  );
}
