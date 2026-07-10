import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useStudioStore } from '@/store/studio-store';
import { fetchPrompts, searchItems } from '@/knowledge/queries';
import { fetchGalleryLinks, studioSlugsForTool, type GalleryLink } from '@/cloud/gallery-links';
import { searchCommons } from '@/knowledge/commons-search';
import {
  fetchCivicMediaCards, fetchNeighboringRecipeCards, fetchCommonsItemDetail,
  type CommonsCard, type CommonsItemDetail,
} from '@/knowledge/commons-items';
import { startFromStudioTool } from '@/project/start-from-tool';
import { startFromCommonsItem } from '@/project/start-from-commons';
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
import { useUIStore } from '@/store/ui-store';
import {
  BookOpen, ExternalLink, GitBranch, GitFork, Globe, Hammer,
  ImageOff, Loader2, Map as MapIcon, Newspaper, ScrollText, Sprout,
  ChevronDown, ChevronRight,
} from 'lucide-react';

/**
 * The Commons Gallery — the civic commons as a first-class space in the
 * Builder. Three shelves side by side: Relational Tech Tools (the Studio
 * KB's built software), Civic Media Recipes (the News Futures / Civic Media
 * Cookbook practices), and Neighboring Recipes (the canonical neighboring
 * practices) — every card remixable for your place, with attribution and
 * lineage kept front and center.
 *
 * Tech-for-building entries stay out of the gallery: they serve as build
 * context in the AI's knowledge, not as things to remix.
 */

const CATEGORIES = [
  { key: 'all', label: 'Everything' },
  { key: 'relational_tech', label: 'Relational tech tools' },
  { key: 'civic_media', label: 'Civic media recipes' },
  { key: 'neighboring', label: 'Neighboring recipes' },
] as const;

/**
 * KB rows whose stored category doesn't match where they belong in the
 * gallery (the KB is read-only from the Builder). The Process Guide is a
 * relational tech practice, not building infrastructure.
 */
const RELATIONAL_TECH_OVERRIDES = new Set(['relational tech process guide']);

function displayCategory(tool: Tool): string | null {
  if (RELATIONAL_TECH_OVERRIDES.has(tool.name.trim().toLowerCase())) return 'relational_tech';
  return tool.tool_category;
}

export interface StudioBadge {
  slug: string;
  label: string;
  color: string | null;
}

type GalleryEntry =
  | { key: string; type: 'tool'; tool: Tool }
  | { key: string; type: 'commons'; card: CommonsCard };

/** Shelf presentation for a commons card */
function shelfFor(card: CommonsCard): { label: string; icon: 'newspaper' | 'sprout' } {
  return card.source_studio_slug === 'civic-media'
    ? { label: 'Civic Media', icon: 'newspaper' }
    : { label: 'Neighboring', icon: 'sprout' };
}

function kindLabel(card: CommonsCard): string {
  if ((card.tags ?? []).includes('worksheet')) return 'worksheet';
  if (card.kind === 'prompt') return 'build prompt';
  return card.kind;
}

/** Human-facing tags only — the namespaced enums are retrieval filters */
function readableTags(card: CommonsCard): string[] {
  return [...new Set((card.tags ?? []).filter(t => !t.includes(':') && t !== 'civic-media'))].slice(0, 5);
}

export function CommonsGallery() {
  const setView = useUIStore(s => s.setView);
  const tools = useKnowledgeStore(s => s.tools);
  const loaded = useKnowledgeStore(s => s.loaded);
  const memberships = useStudioStore(s => s.memberships);
  const activeStudio = useStudioStore(s => s.activeStudio);
  const studios = useStudioStore(s => s.studios);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [detail, setDetail] = useState<Tool | null>(null);
  const [commonsDetail, setCommonsDetail] = useState<CommonsCard | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [links, setLinks] = useState<GalleryLink[]>([]);
  const [civicCards, setCivicCards] = useState<CommonsCard[]>([]);
  const [neighboringCards, setNeighboringCards] = useState<CommonsCard[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Semantic ranking from the commons' hybrid search: slug/title → rank
  const [semanticRank, setSemanticRank] = useState<Map<string, number>>(new Map());
  const searchSeq = useRef(0);

  useEffect(() => {
    fetchPrompts().then(setPrompts).catch(() => {});
    fetchGalleryLinks().then(setLinks).catch(() => {});
    fetchCivicMediaCards().then(setCivicCards).catch(() => {});
    fetchNeighboringRecipeCards().then(setNeighboringCards).catch(() => {});
  }, []);

  // Debounced hybrid search — the same semantic+text retrieval that informs
  // builds ranks the gallery, so "help seniors feel less alone" finds the
  // right recipes even when no card contains those words.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSemanticRank(new Map());
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      const results = await searchCommons(q, 30);
      if (seq !== searchSeq.current) return; // stale
      const rank = new Map<string, number>();
      results.forEach((r, i) => {
        rank.set(r.slug, i);
        rank.set(r.title.trim().toLowerCase(), i);
      });
      setSemanticRank(rank);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

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

  // Tech-for-building never renders as a card — it stays AI build context
  const galleryTools = useMemo(
    () => tools.filter(t => displayCategory(t) !== 'tech_for_building'),
    [tools],
  );

  const entries = useMemo<GalleryEntry[]>(() => {
    const toolEntries: GalleryEntry[] =
      category === 'all' || category === 'relational_tech' || category === 'mine'
        ? (category === 'mine' ? galleryTools.filter(t => badgesFor(t).length > 0) : galleryTools)
            .map(t => ({ key: `tool-${t.id}`, type: 'tool' as const, tool: t }))
        : [];
    const civicEntries: GalleryEntry[] =
      category === 'all' || category === 'civic_media'
        ? civicCards.map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }))
        : [];
    const neighboringEntries: GalleryEntry[] =
      category === 'all' || category === 'neighboring'
        ? neighboringCards.map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }))
        : [];

    const q = query.trim().toLowerCase();
    const substringHit = (e: GalleryEntry) => {
      if (e.type === 'tool') return searchItems([e.tool], query).length > 0;
      const c = e.card;
      return [c.title, c.summary, c.attribution?.name, ...(c.tags ?? [])]
        .some(v => v && v.toLowerCase().includes(q));
    };
    const rankOf = (e: GalleryEntry): number | undefined =>
      e.type === 'commons'
        ? semanticRank.get(e.card.slug) ?? semanticRank.get(e.card.title.trim().toLowerCase())
        : semanticRank.get(e.tool.name.trim().toLowerCase());

    const all = [...toolEntries, ...civicEntries, ...neighboringEntries];

    if (!q) {
      // Browsing order: your studios' tools lead, then each shelf in turn
      return all.sort((a, b) => {
        const aBadge = a.type === 'tool' && badgesFor(a.tool).length > 0 ? 0 : 1;
        const bBadge = b.type === 'tool' && badgesFor(b.tool).length > 0 ? 0 : 1;
        return aBadge - bBadge;
      });
    }

    // Searching: semantic rank leads (the commons understands the ask),
    // plain substring matches follow for anything retrieval missed
    return all
      .map(e => ({ e, rank: rankOf(e), sub: substringHit(e) }))
      .filter(x => x.rank !== undefined || x.sub)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .map(x => x.e);
  }, [galleryTools, civicCards, neighboringCards, category, query, badgesFor, semanticRank]);

  const promptsFor = (tool: Tool) => prompts.filter(p => p.parent_tool_id === tool.id);

  async function buildTool(tool: Tool) {
    setBusyKey(`tool-${tool.id}`);
    setError(null);
    try {
      await startFromStudioTool(tool);
      setDetail(null);
      setView('builder'); // the fresh Plan-mode draft is waiting in the composer
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start from that tool');
    } finally {
      setBusyKey(null);
    }
  }

  async function planCommons(card: CommonsCard) {
    setBusyKey(`commons-${card.slug}`);
    setError(null);
    try {
      await startFromCommonsItem(card);
      setCommonsDetail(null);
      setView('builder');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start from that recipe');
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">Commons Gallery</h1>
          <p className="text-sm text-muted-foreground">
            Tools, practices, and recipes from the civic commons – ready to be remixed, with
            attribution and lineage, for your place.
          </p>
        </div>

        {/* The network's life alongside its library — recent shares, publishes,
            and new members across the studios you belong to. */}
        <NetworkUpdates />

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search the commons…"
            className="h-8 w-56 text-sm"
          />
          <div className="flex flex-wrap gap-1">
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
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing matches that search.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map(entry =>
              entry.type === 'tool' ? (
                <ToolCard
                  key={entry.key}
                  tool={entry.tool}
                  studioBadges={badgesFor(entry.tool)}
                  busy={busyKey === entry.key}
                  anyBusy={busyKey !== null}
                  onOpen={() => setDetail(entry.tool)}
                  onBuild={() => buildTool(entry.tool)}
                />
              ) : (
                <RecipeCard
                  key={entry.key}
                  card={entry.card}
                  busy={busyKey === entry.key}
                  anyBusy={busyKey !== null}
                  onOpen={() => setCommonsDetail(entry.card)}
                  onPlan={() => planCommons(entry.card)}
                />
              ),
            )}
          </div>
        )}
      </div>

      {detail && (
        <ToolDetailDialog
          tool={detail}
          childPrompts={promptsFor(detail)}
          busy={busyKey === `tool-${detail.id}`}
          onBuild={() => buildTool(detail)}
          onOpenChange={open => { if (!open) setDetail(null); }}
        />
      )}
      {commonsDetail && (
        <RecipeDetailDialog
          card={commonsDetail}
          busy={busyKey === `commons-${commonsDetail.slug}`}
          onPlan={() => planCommons(commonsDetail)}
          onOpenChange={open => { if (!open) setCommonsDetail(null); }}
        />
      )}
    </div>
  );
}

function ToolCard({
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

/** A commons practice card — attribution up front, no screenshot to hide behind */
function RecipeCard({
  card, busy, anyBusy, onOpen, onPlan,
}: {
  card: CommonsCard; busy: boolean; anyBusy: boolean;
  onOpen: () => void; onPlan: () => void;
}) {
  const shelf = shelfFor(card);
  const ShelfIcon = shelf.icon === 'newspaper' ? Newspaper : Sprout;
  return (
    <div className="group border rounded-xl overflow-hidden flex flex-col bg-background hover:border-foreground/25 transition-colors">
      <div className="p-3.5 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <ShelfIcon className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{shelf.label}</span>
          <Badge variant="outline" className="ml-auto text-[9px] shrink-0">{kindLabel(card)}</Badge>
        </div>
        <button onClick={onOpen} className="font-medium text-[15px] hover:underline text-left leading-snug">
          {card.title}
        </button>
        {card.attribution?.name && (
          <p className="text-xs text-muted-foreground -mt-0.5">
            {card.attribution.name}
            {card.attribution.neighborhood ? ` — ${card.attribution.neighborhood}` : ''}
          </p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-4 flex-1">{card.summary}</p>
        {readableTags(card).length > 0 && (
          <div className="flex flex-wrap gap-1">
            {readableTags(card).map(t => (
              <span key={t} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        )}
        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={onOpen}>
            Details
          </Button>
          <Button size="sm" className="h-7 text-xs flex-1" disabled={anyBusy} onClick={onPlan}>
            {busy ? <Loader2 className="size-3 animate-spin mr-1" /> : <MapIcon className="size-3 mr-1" />}
            Plan this
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecipeDetailDialog({
  card, busy, onPlan, onOpenChange,
}: {
  card: CommonsCard; busy: boolean;
  onPlan: () => void; onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<CommonsItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const shelf = shelfFor(card);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchCommonsItemDetail(card.slug)
      .then(d => { if (alive) setDetail(d); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [card.slug]);

  const sourceNote =
    detail?.metadata && typeof detail.metadata.source_note === 'string'
      ? detail.metadata.source_note
      : null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 flex items-center gap-2">
            <span>{card.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{kindLabel(card)}</Badge>
          </DialogTitle>
        </DialogHeader>

        {card.summary && <p className="text-sm leading-relaxed">{card.summary}</p>}

        {/* Attribution and lineage lead — the commons credits its contributors */}
        <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <GitBranch className="size-3" /> Attribution & lineage
          </p>
          {card.attribution?.name && (
            <p>
              {card.attribution.name}
              {card.attribution.neighborhood ? ` — ${card.attribution.neighborhood}` : ''}
            </p>
          )}
          {sourceNote && <p className="text-muted-foreground text-xs">{sourceNote}</p>}
          <p className="text-muted-foreground text-xs">
            {shelf.label} shelf of the civic commons
            {card.license ? ` · ${card.license}` : ''}
          </p>
          {card.source_url && (
            <a
              href={card.source_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs underline decoration-dotted hover:text-primary"
            >
              <ExternalLink className="size-3" /> Source
            </a>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Opening the recipe…
          </p>
        ) : detail?.body ? (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{detail.body}</ReactMarkdown>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={busy} onClick={onPlan}>
            {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : <MapIcon className="size-3.5 mr-1.5" />}
            Plan this for your place
          </Button>
          {card.source_url && (
            <a
              href={card.source_url}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <BookOpen className="size-3.5 mr-1.5" /> Learn more
            </a>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          "Plan this" opens the recipe in Plan mode — you adapt it to your neighborhood, and
          together you decide whether the build is a program plan, printable materials,
          software, or a mix. Attribution travels with it.
        </p>
      </DialogContent>
    </Dialog>
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
