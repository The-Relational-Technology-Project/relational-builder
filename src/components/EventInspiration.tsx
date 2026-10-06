import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchEventShelfItems, type EventShelfItem } from '@/cloud/event-shelf-items';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, GitBranch, Lightbulb, Loader2 } from 'lucide-react';

/**
 * The inspiration shelf under an event's demo wall: the real neighborhood
 * tools a steward curated for the room, as they actually run. Cards only,
 * for looking at and visiting; nothing here is a deck, so the presentation
 * page never picks it up. Stays hidden (renders nothing) for events with no
 * curated shelf, so a room that only has its wall sees only its wall.
 */
export function EventInspiration({ code, name }: { code: string; name: string }) {
  // Keyed by the code it was fetched for, so switching rooms shows the
  // loading line rather than the last room's shelf for a beat
  const [loaded, setLoaded] = useState<{ code: string; items: EventShelfItem[] } | null>(null);
  const [open, setOpen] = useState<EventShelfItem | null>(null);
  const items = loaded?.code === code ? loaded.items : null;

  useEffect(() => {
    let cancelled = false;
    fetchEventShelfItems(code).then(list => { if (!cancelled) setLoaded({ code, items: list }); });
    return () => { cancelled = true; };
  }, [code]);

  if (items === null) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="size-3 animate-spin" /> Looking for inspiration…
      </p>
    );
  }
  if (items.length === 0) return null;

  return (
    <section className="space-y-3 pt-2">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Lightbulb className="size-3.5 text-primary" /> For inspiration
        </h2>
        <p className="text-xs text-muted-foreground">
          Neighborhood tools that already run where {name} is happening — the
          real sites, not the generic cards. Look, visit, borrow ideas. These
          are not part of the room's presentation.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <InspirationCard key={item.id} item={item} onOpen={() => setOpen(item)} />
        ))}
      </div>
      <Dialog open={open !== null} onOpenChange={o => { if (!o) setOpen(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>{open.title}</DialogTitle>
              </DialogHeader>
              {open.attribution && (
                <p className="text-xs text-muted-foreground -mt-2">{open.attribution}</p>
              )}
              {open.image_url && (
                <a href={open.site_url ?? open.image_url} target="_blank" rel="noreferrer" className="block rounded-lg border overflow-hidden">
                  <img src={open.image_url} alt={open.title} className="w-full object-cover object-top" />
                </a>
              )}
              {open.body ? (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{open.body}</ReactMarkdown>
                </div>
              ) : open.summary ? (
                <p className="text-sm text-muted-foreground">{open.summary}</p>
              ) : null}
              <ItemLinks item={open} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ItemLinks({ item }: { item: EventShelfItem }) {
  if (!item.site_url && !item.repo_url) return null;
  return (
    <div className="flex flex-wrap gap-3 pt-1">
      {item.site_url && (
        <a
          href={item.site_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="size-3" /> {hostOf(item.site_url)}
        </a>
      )}
      {item.repo_url && (
        <a
          href={item.repo_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <GitBranch className="size-3" /> Repo
        </a>
      )}
    </div>
  );
}

function hostOf(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname !== '/' ? u.pathname : '');
  } catch {
    return url;
  }
}

function InspirationCard({ item, onOpen }: { item: EventShelfItem; onOpen: () => void }) {
  const [imgBroken, setImgBroken] = useState(false);
  return (
    <div className="group border rounded-xl overflow-hidden flex flex-col bg-background hover:border-foreground/25 transition-colors">
      {item.image_url && !imgBroken && (
        <button onClick={onOpen} className="block w-full aspect-[16/10] bg-muted overflow-hidden">
          <img
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform"
          />
        </button>
      )}
      <div className="p-3.5 flex-1 flex flex-col gap-1.5">
        <button onClick={onOpen} className="font-medium text-[15px] hover:underline text-left leading-snug">
          {item.title}
        </button>
        {item.attribution && (
          <p className="text-[11px] text-muted-foreground/80 -mt-0.5">{item.attribution}</p>
        )}
        {item.summary && (
          <p className="text-sm text-muted-foreground line-clamp-4 flex-1">{item.summary}</p>
        )}
        <ItemLinks item={item} />
        <div className="pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs w-full" onClick={onOpen}>
            How it works
          </Button>
        </div>
      </div>
    </div>
  );
}
