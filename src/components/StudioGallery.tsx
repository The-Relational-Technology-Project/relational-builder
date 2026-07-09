import { useCallback, useEffect, useMemo, useState } from 'react';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useStudioStore } from '@/store/studio-store';
import { fetchPrompts, searchItems } from '@/knowledge/queries';
import { fetchGalleryLinks, studioSlugsForTool, type GalleryLink } from '@/cloud/gallery-links';
import { startFromStudioTool } from '@/project/start-from-tool';
import { NetworkUpdates } from '@/components/StudioUpdates';
import type { Tool, Prompt } from '@/knowledge/types';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, ExternalLink, GitBranch, GitFork, Globe, Hammer,
  ImageOff, Loader2, ScrollText, ChevronDown, ChevronRight,
} from 'lucide-react';

/**
 * The Studio Gallery — the RT Studio library as a first-class space in the
 * Builder, outside Home. Rich cards (screenshots, lineage, hosted links)
 * absorbed from RT Studio's Library, with the Builder's own take-up path
 * front and center: every tool distills into a place-adaptable build prompt.
 */

const CATEGORIES = [
  { key: 'all', label: 'Everything' },
  { key: 'relational_tech', label: 'Relational tech' },
  { key: 'tech_for_building', label: 'Tech for building' },
] as const;

export interface StudioBadge {
  slug: string;
  label: string;
  color: string | null;
}

export function StudioGallery({ onClose }: { onClose: () => void }) {
  const tools = useKnowledgeStore(s => s.tools);
  const loaded = useKnowledgeStore(s => s.loaded);
  const memberships = useStudioStore(s => s.memberships);
  const activeStudio = useStudioStore(s => s.activeStudio);
  const studios = useStudioStore(s => s.studios);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [detail, setDetail] = useState<Tool | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [links, setLinks] = useState<GalleryLink[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts().then(setPrompts).catch(() => {});
    fetchGalleryLinks().then(setLinks).catch(() => {});
  }, []);

  // The viewer's studios: the frame they're building in plus everywhere they belong
  const mySlugs = useMemo(() => {
    const slugs = new Set(memberships.map(m => m.studio_slug));
    if (activeStudio) slugs.add(activeStudio.slug);
    return slugs;
  }, [memberships, activeStudio]);

  const studioMeta = useMemo(() => {
    const map = new Map<string, StudioBadge>();
    for (const s of studios) map.set(s.slug, { slug: s.slug, label: s.label, color: s.color });
    if (activeStudio && !map.has(activeStudio.slug)) {
      map.set(activeStudio.slug, { slug: activeStudio.slug, label: activeStudio.label, color: activeStudio.color });
    }
    for (const m of memberships) {
      if (!map.has(m.studio_slug)) {
        map.set(m.studio_slug, { slug: m.studio_slug, label: m.studio_label, color: null });
      }
    }
    return map;
  }, [studios, activeStudio, memberships]);

  /** Badges for a tool, scoped to the viewer's own studios */
  const badgesFor = useCallback(
    (tool: Tool): StudioBadge[] =>
      studioSlugsForTool(tool, links)
        .filter(slug => mySlugs.has(slug))
        .map(slug => studioMeta.get(slug) ?? { slug, label: slug, color: null }),
    [links, mySlugs, studioMeta],
  );

  const anyStudioTools = useMemo(
    () => tools.some(t => badgesFor(t).length > 0),
    [tools, badgesFor],
  );

  const filtered = useMemo(() => {
    const byCat =
      category === 'all' ? tools
      : category === 'mine' ? tools.filter(t => badgesFor(t).length > 0)
      : tools.filter(t => t.tool_category === category);
    // Relational tech leads, tech-for-building trails, uncategorized between
    const catRank = (t: Tool) =>
      t.tool_category === 'relational_tech' ? 0
      : t.tool_category === 'tech_for_building' ? 2
      : 1;
    // Your studios' tools surface first, then relational tech before tech for building
    return [...searchItems(byCat, query)].sort(
      (a, b) =>
        Number(badgesFor(b).length > 0) - Number(badgesFor(a).length > 0) ||
        catRank(a) - catRank(b),
    );
  }, [tools, query, category, badgesFor]);

  const promptsFor = (tool: Tool) => prompts.filter(p => p.parent_tool_id === tool.id);

  async function buildIt(tool: Tool) {
    setBusyId(tool.id);
    setError(null);
    try {
      await startFromStudioTool(tool);
      setDetail(null);
      onClose(); // the fresh Plan-mode draft is waiting in the composer
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start from that tool');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="sm" className="h-8 gap-1 -ml-2 shrink-0" onClick={onClose}>
            <ArrowLeft className="size-3.5" />
            Back
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight">Studio Gallery</h1>
            <p className="text-sm text-muted-foreground">
              Tools built across the relational tech network — see them running, trace their
              lineage, and grow your own version for your neighborhood.
            </p>
          </div>
        </div>

        {/* The network's life alongside its library — recent shares, publishes,
            and new members across the studios you belong to. */}
        <NetworkUpdates />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the gallery…"
            className="h-8 w-56 text-sm"
          />
          <div className="flex gap-1">
            {[...CATEGORIES, ...(anyStudioTools ? [{ key: 'mine', label: 'Your studios' } as const] : [])].map(c => (
              <button
                key={c.key}
                onClick={() => setCategory(c.key)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  category === c.key
                    ? 'bg-foreground text-background border-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loaded ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading the gallery…
          </p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(tool => (
              <GalleryCard
                key={tool.id}
                tool={tool}
                studioBadges={badgesFor(tool)}
                busy={busyId === tool.id}
                anyBusy={busyId !== null}
                onOpen={() => setDetail(tool)}
                onBuild={() => buildIt(tool)}
              />
            ))}
          </div>
        )}
      </div>

      {detail && (
        <ToolDetailDialog
          tool={detail}
          childPrompts={promptsFor(detail)}
          busy={busyId === detail.id}
          onBuild={() => buildIt(detail)}
          onOpenChange={open => { if (!open) setDetail(null); }}
        />
      )}
    </div>
  );
}

function GalleryCard({
  tool, studioBadges, busy, anyBusy, onOpen, onBuild,
}: {
  tool: Tool; studioBadges: StudioBadge[]; busy: boolean; anyBusy: boolean;
  onOpen: () => void; onBuild: () => void;
}) {
  const highlight = studioBadges[0]?.color ?? null;
  const [imgBroken, setImgBroken] = useState(false);
  return (
    <div
      className="group border rounded-xl overflow-hidden flex flex-col bg-background hover:border-foreground/25 transition-colors"
      style={highlight ? { borderColor: highlight } : undefined}
    >
      <button onClick={onOpen} className="block w-full aspect-[16/10] bg-muted overflow-hidden">
        {tool.image_url && !imgBroken ? (
          <img
            src={tool.image_url}
            alt={tool.name}
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-muted-foreground/40">
            <ImageOff className="size-6" />
          </span>
        )}
      </button>
      <div className="p-3.5 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <button onClick={onOpen} className="font-medium text-[15px] truncate hover:underline text-left">
            {tool.name}
          </button>
          <span className="ml-auto flex gap-1 shrink-0">
            {tool.hosted_url && <Badge variant="outline" className="text-[9px]">hosted</Badge>}
            {tool.github_url && <Badge variant="outline" className="text-[9px]">open&nbsp;source</Badge>}
          </span>
        </div>
        {tool.creator_name && (
          <p className="text-xs text-muted-foreground -mt-1">by {tool.creator_name}</p>
        )}
        {studioBadges.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {studioBadges.map(b => (
              <span
                key={b.slug}
                className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground"
              >
                <span
                  className="size-1.5 rounded-full shrink-0"
                  style={{ background: b.color ?? 'hsl(var(--muted-foreground))' }}
                />
                {b.label}
              </span>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground line-clamp-3 flex-1">
          {tool.summary ?? tool.description}
        </p>
        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={onOpen}>
            Details
          </Button>
          {tool.github_url && (
            <Button size="sm" className="h-7 text-xs flex-1" disabled={anyBusy} onClick={onBuild}>
              {busy ? <Loader2 className="size-3 animate-spin mr-1" /> : <Hammer className="size-3 mr-1" />}
              Build it
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ToolDetailDialog({
  tool, childPrompts, busy, onBuild, onOpenChange,
}: {
  tool: Tool; childPrompts: Prompt[]; busy: boolean;
  onBuild: () => void; onOpenChange: (open: boolean) => void;
}) {
  const [openPrompt, setOpenPrompt] = useState<string | null>(null);
  const screenshots = [
    ...(tool.image_url ? [tool.image_url] : []),
    ...((tool.screenshot_urls ?? []).filter(u => u && u !== tool.image_url)),
  ];
  const [shot, setShot] = useState(0);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{tool.name}</DialogTitle>
        </DialogHeader>

        {screenshots.length > 0 && (
          <div className="space-y-1.5">
            <div className="rounded-lg overflow-hidden border bg-muted">
              <img
                src={screenshots[Math.min(shot, screenshots.length - 1)]}
                alt={tool.name}
                className="w-full object-contain max-h-80"
              />
            </div>
            {screenshots.length > 1 && (
              <div className="flex gap-1.5">
                {screenshots.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setShot(i)}
                    className={`h-12 w-20 rounded border overflow-hidden ${i === shot ? 'ring-2 ring-primary' : 'opacity-70'}`}
                  >
                    <img src={s} alt="" className="w-full h-full object-cover object-top" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-sm leading-relaxed">{tool.summary ?? tool.description}</p>
        {tool.summary && tool.description && tool.description !== tool.summary && (
          <p className="text-sm text-muted-foreground leading-relaxed">{tool.description}</p>
        )}

        {(tool.lineage_note || tool.creator_name) && (
          <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <GitBranch className="size-3" /> Lineage
            </p>
            {tool.lineage_note && <p className="text-muted-foreground">{tool.lineage_note}</p>}
            {tool.creator_name && (
              <p>
                Grown by{' '}
                {tool.creator_url ? (
                  <a href={tool.creator_url} target="_blank" rel="noreferrer" className="underline decoration-dotted hover:text-primary">
                    {tool.creator_name}
                  </a>
                ) : (
                  tool.creator_name
                )}
              </p>
            )}
          </div>
        )}

        {childPrompts.length > 0 && (
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
              <ScrollText className="size-3" /> The recipe — prompts that nearly build it
            </p>
            {childPrompts.map(p => (
              <div key={p.id} className="border rounded-md">
                <button
                  onClick={() => setOpenPrompt(openPrompt === p.id ? null : p.id)}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-muted/60"
                >
                  {openPrompt === p.id ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                  <span className="font-medium truncate">{p.title}</span>
                </button>
                {openPrompt === p.id && (
                  <p className="px-2.5 pb-2 text-xs text-muted-foreground whitespace-pre-wrap">
                    {p.example_prompt}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          {tool.github_url && (
            <Button size="sm" disabled={busy} onClick={onBuild}>
              {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <Hammer className="size-3.5 mr-1.5" />}
              Build your version
            </Button>
          )}
          {tool.url && (
            <a
              href={tool.url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <ExternalLink className="size-3.5 mr-1.5" /> Visit
            </a>
          )}
          {tool.hosted_url && (
            <a
              href={tool.hosted_url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <Globe className="size-3.5 mr-1.5" />
              {tool.hosted_by ? `Hosted by ${tool.hosted_by}` : 'Use the hosted version'}
            </a>
          )}
          {tool.github_url && (
            <a
              href={tool.github_url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <GitFork className="size-3.5 mr-1.5" /> Source
            </a>
          )}
        </div>
        {tool.github_url && (
          <p className="text-xs text-muted-foreground">
            "Build your version" distills this tool into a place-adaptable prompt and opens it
            in Plan mode — you shape it for your neighborhood, and the lineage travels with it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
