import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchEventShelfItems, type EventShelfItem } from '@/cloud/event-shelf-items';
import { startFromEventShelfItem } from '@/project/start-from-event-item';
import { useUIStore } from '@/store/ui-store';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ExternalLink, GitBranch, Hammer, Lightbulb, Loader2 } from 'lucide-react';

/**
 * The inspiration shelf under an event's demo wall: the real neighborhood
 * tools a steward curated for the room, as they actually run. The cards
 * work like the commons' tool cards — Details opens the full entry with its
 * attribution and links, Build it seeds Plan mode with the tool as a remix
 * for the builder's own place. Nothing here is a deck, so the presentation
 * page never picks it up. Renders nothing for events with no curated shelf.
 */
export function EventInspiration({ code, name }: { code: string; name: string }) {
  const setView = useUIStore(s => s.setView);
  // Keyed by the code it was fetched for, so switching rooms shows the
  // loading line rather than the last room's shelf for a beat
  const [loaded, setLoaded] = useState<{ code: string; items: EventShelfItem[] } | null>(null);
  const [open, setOpen] = useState<EventShelfItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const items = loaded?.code === code ? loaded.items : null;

  useEffect(() => {
    let cancelled = false;
    fetchEventShelfItems(code).then(list => { if (!cancelled) setLoaded({ code, items: list }); });
    return () => { cancelled = true; };
  }, [code]);

  function build(item: EventShelfItem) {
    setBusyId(item.id);
    try {
      startFromEventShelfItem(item, name);
      setOpen(null);
      setView('builder'); // the fresh Plan-mode draft is waiting in the composer
    } finally {
      setBusyId(null);
    }
  }

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
          real sites, not the generic cards. Look, visit, or build your own
          version. These are not part of the room's presentation.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(item => (
          <InspirationCard
            key={item.id}
            item={item}
            busy={busyId === item.id}
            anyBusy={busyId !== null}
            onOpen={() => setOpen(item)}
            onBuild={() => build(item)}
          />
        ))}
      </div>
      {open && (
        <InspirationDetailDialog
          item={open}
          eventName={name}
          busy={busyId === open.id}
          onBuild={() => build(open)}
          onOpenChange={o => { if (!o) setOpen(null); }}
        />
      )}
    </section>
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

function InspirationCard({
  item, busy, anyBusy, onOpen, onBuild,
}: {
  item: EventShelfItem; busy: boolean; anyBusy: boolean;
  onOpen: () => void; onBuild: () => void;
}) {
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
        <div className="flex items-center gap-1.5">
          <Lightbulb className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">For inspiration</span>
          <Badge variant="outline" className="ml-auto text-[9px] shrink-0">live tool</Badge>
        </div>
        <button onClick={onOpen} className="font-medium text-[15px] hover:underline text-left leading-snug">
          {item.title}
        </button>
        {item.attribution && (
          <p className="text-[11px] text-muted-foreground/80 -mt-0.5">{item.attribution}</p>
        )}
        {item.summary && (
          <p className="text-sm text-muted-foreground line-clamp-4 flex-1">{item.summary}</p>
        )}
        <div className="flex flex-wrap gap-3 text-xs">
          {item.site_url && (
            <a href={item.site_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <ExternalLink className="size-3" /> {hostOf(item.site_url)}
            </a>
          )}
          {item.repo_url && (
            <a href={item.repo_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
              <GitBranch className="size-3" /> Repo
            </a>
          )}
        </div>
        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={onOpen}>
            Details
          </Button>
          <Button size="sm" className="h-7 text-xs flex-1" disabled={anyBusy} onClick={onBuild}>
            {busy ? <Loader2 className="size-3 animate-spin mr-1" /> : <Hammer className="size-3 mr-1" />}
            Build it
          </Button>
        </div>
      </div>
    </div>
  );
}

function InspirationDetailDialog({
  item, eventName, busy, onBuild, onOpenChange,
}: {
  item: EventShelfItem; eventName: string; busy: boolean;
  onBuild: () => void; onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 flex items-center gap-2">
            <span>{item.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">live tool</Badge>
          </DialogTitle>
        </DialogHeader>

        {item.image_url && (
          <div className="rounded-lg overflow-hidden border bg-muted">
            <img src={item.image_url} alt={item.title} className="w-full object-contain max-h-[30rem]" />
          </div>
        )}

        {item.summary && <p className="text-sm leading-relaxed">{item.summary}</p>}

        {/* Attribution and lineage lead, the way the commons credits its sources */}
        <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <GitBranch className="size-3" /> Attribution & lineage
          </p>
          {item.attribution && <p>{item.attribution}</p>}
          <p className="text-muted-foreground text-xs">On the {eventName} shelf, as it runs today</p>
          <div className="flex flex-wrap gap-3">
            {item.site_url && (
              <a
                href={item.site_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs underline decoration-dotted hover:text-primary"
              >
                <ExternalLink className="size-3" /> Live site
              </a>
            )}
            {item.repo_url && (
              <a
                href={item.repo_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs underline decoration-dotted hover:text-primary"
              >
                <GitBranch className="size-3" /> Source code
              </a>
            )}
          </div>
        </div>

        {item.body && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={busy} onClick={onBuild}>
            {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Hammer className="size-3.5 mr-1.5" />}
            Build it
          </Button>
          {item.site_url && (
            <a
              href={item.site_url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-3.5 mr-1.5" /> Visit the site
            </a>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          "Build it" opens this tool in Plan mode as a remix for your own place
          {item.image_url ? ', with the screenshot attached as visual reference' : ''}
          {item.repo_url ? ' and the source code noted for the model to consult' : ''}.
          Attribution travels with it.
        </p>
      </DialogContent>
    </Dialog>
  );
}
