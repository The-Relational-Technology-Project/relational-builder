import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useKnowledgeStore } from '@/store/knowledge-store';
import { useStudioStore, approvedMemberships, adminMemberships } from '@/store/studio-store';
import { fetchPrompts, searchItems } from '@/knowledge/queries';
import { fetchGalleryLinks, studioSlugsForTool, type GalleryLink } from '@/cloud/gallery-links';
import { searchCommons } from '@/knowledge/commons-search';
import { STUDIO_ITEM_KINDS, type StudioLibraryItem } from '@/cloud/studio-library';
import { startFromStudioItem } from '@/project/start-from-studio-item';
import { studioLineageChain, formatLineageChain } from '@/knowledge/studio-lineage';
import { studioPartnerCredit, studioCommonsPins } from '@/knowledge/studio-context';
import {
  fetchCivicMediaCards, fetchNeighboringRecipeCards,
  fetchCommunityOrganizingCards, fetchLocalCivicTechCards, fetchMicrograntCards, fetchContributedCards,
  fetchDeliberationCards, fetchProsocialDesignCards, fetchBuildDayCards,
  fetchCommonsItemDetail, fetchStudioLocations,
  type CommonsCard, type CommonsItemDetail,
} from '@/knowledge/commons-items';
import { startFromStudioTool } from '@/project/start-from-tool';
import { startFromCommonsItem } from '@/project/start-from-commons';
import { BUILD_DAY_CARD_SLUG, BUILD_DAY_SHELF } from '@/knowledge/build-day';
import { loadGalleryReferences, invalidateGalleryReferences } from '@/cloud/gallery-references';
import type { GalleryReference, RefSource } from '@/knowledge/gallery-references';
import {
  ConnectionsSection,
  type ConnectableEntry,
  type ConnectionsCuration,
} from './GalleryConnections';
import { isSuperAdmin } from '@/cloud/account-requests';
import { GalleryToolBuilders } from '@/components/GalleryToolBuilders';
import { StudioContributeDialog } from '@/components/StudioContributeDialog';
import { EventShelf } from '@/components/EventShowcase';
import { EventInspiration } from '@/components/EventInspiration';
import { fetchMyEvents, eventScopeFor, eventCodeOfScope, type EventShelfInfo } from '@/cloud/event-showcase';
import { useNearbyStore } from '@/store/nearby-store';
import {
  formatMiles, isPlaceRooted, nearestLabel, nearestMiles, NEARBY_RADII_MILES, type GeoLocation,
} from '@/knowledge/geo';
import { readShelfParam, writeShelfParam } from '@/router';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { fetchMyAdminEvents } from '@/cloud/event-admin';
import { useAuthStore } from '@/store/auth-store';
import type { Tool, Prompt, Story } from '@/knowledge/types';
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
  BookOpen, ExternalLink, Gift, GitBranch, GitFork, Globe, Hammer,
  HandCoins, ImageOff, Landmark, Loader2, Map as MapIcon, Newspaper, ScrollText, Sprout,
  ChevronDown, ChevronRight, Library, Lock, KeyRound, Users, Plus,
  ArrowLeft, LocateFixed, MapPin, Search, X,
} from 'lucide-react';
import { ContributeDialog } from '@/components/ContributeDialog';

/**
 * The Commons Gallery — the civic commons as a first-class space in the
 * Builder. The shelves side by side: Relational Tech Tools (the Studio
 * KB's built software), Civic Media (the News Futures / Civic Media
 * Cookbook — recipes, worksheets, and the field-guide stories),
 * Neighboring Recipes (the canonical neighboring practices), Community
 * Organizing (people building power together, in the Ganz tradition), and
 * Local Civic Tech (open civic tech remixable at neighborhood scale) —
 * every card remixable for your place, with attribution and lineage kept
 * front and center.
 *
 * Tech-for-building entries stay out of the gallery: they serve as build
 * context in the AI's knowledge, not as things to remix.
 */

const CATEGORIES = [
  { key: 'all', label: 'Everything' },
  { key: 'build_day', label: 'Build days' },
  { key: 'relational_tech', label: 'Relational tech tools' },
  { key: 'civic_media', label: 'Civic media' },
  { key: 'neighboring', label: 'Neighboring recipes' },
  { key: 'organizing', label: 'Community organizing' },
  { key: 'civic_tech', label: 'Local civic tech' },
  { key: 'microgrants', label: 'Microgrants' },
  { key: 'deliberation', label: 'Deliberation' },
  { key: 'prosocial', label: 'Prosocial design' },
  { key: 'contributed', label: 'From builders' },
  { key: 'stories', label: 'Local stories' },
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
  | { key: string; type: 'commons'; card: CommonsCard }
  | { key: string; type: 'studio'; item: StudioLibraryItem }
  | { key: string; type: 'kb-story'; story: Story };

function studioKindLabel(kind: StudioLibraryItem['kind']): string {
  return STUDIO_ITEM_KINDS.find(k => k.key === kind)?.label.toLowerCase() ?? kind;
}

/**
 * "Thread Studio" → "Thread Gallery" — the shelf gets its own name.
 * A name that already ends in a word for a collection keeps it, so an event
 * called "Radically Rural 2026 Contributions" doesn't become
 * "...Contributions Gallery".
 */
const COLLECTION_NOUN = /\b(gallery|contributions|showcase|shelf|collection|library|wall)$/i;
function galleryNameFor(studioLabel: string): string {
  const base = studioLabel.replace(/\s+Studio$/i, '').trim();
  return COLLECTION_NOUN.test(base) ? base : `${base} Gallery`;
}

/** Within this many miles of a pin's centre, "in <place>" is the honest
 *  distance: the pin is no finer than the place itself */
const PRECISION_SCALE_MILES: Record<string, number> = { neighborhood: 1, city: 12, region: 80, country: 500, origin: 12 };
interface PlaceHit { miles: number; label: string; origin: boolean; precision: string }

/** Shelf presentation for a commons card */
type ShelfIconKey = 'newspaper' | 'sprout' | 'users' | 'landmark' | 'coins' | 'gift' | 'hammer';
const SHELF_ICONS: Record<ShelfIconKey, typeof Newspaper> = {
  newspaper: Newspaper, sprout: Sprout, users: Users, landmark: Landmark, coins: HandCoins, gift: Gift, hammer: Hammer,
};

/** The canonical shelves: a studio slug that is one of these is a fixed
 *  shelf of the commons. Anything else came in as a contribution. */
const CANONICAL_SHELVES = new Set(['civic-media', 'rtp-canonical', 'community-organizing', 'local-civic-tech', 'microgrants', 'deliberation', 'prosocial-design', BUILD_DAY_SHELF]);

function isContributed(card: CommonsCard): boolean {
  return !CANONICAL_SHELVES.has(card.source_studio_slug ?? '');
}

/**
 * Which shelf a card sits on. A contributed card (approved through the
 * Builder, from a studio with no fixed shelf) is labeled with the studio it
 * was offered from when the viewer knows that studio, else as a builder's gift.
 */
function shelfFor(card: CommonsCard, studioLabel?: string): { label: string; icon: ShelfIconKey } {
  switch (card.source_studio_slug) {
    case 'civic-media': return { label: 'Civic Media', icon: 'newspaper' };
    case 'community-organizing': return { label: 'Community Organizing', icon: 'users' };
    case 'local-civic-tech': return { label: 'Local Civic Tech', icon: 'landmark' };
    case 'microgrants': return { label: 'Microgrants', icon: 'coins' };
    case 'deliberation': return { label: 'Deliberation', icon: 'users' };
    case 'prosocial-design': return { label: 'Prosocial Design', icon: 'sprout' };
    case 'rtp-canonical': return { label: 'Neighboring', icon: 'sprout' };
    case BUILD_DAY_SHELF: return { label: 'Community Build Day', icon: 'hammer' };
    default: return { label: studioLabel ?? 'From builders', icon: 'gift' };
  }
}

function kindLabel(card: CommonsCard): string {
  if ((card.tags ?? []).includes('worksheet')) return 'worksheet';
  if (card.kind === 'prompt') return 'build prompt';
  if (card.kind === 'story') return 'field example';
  if (card.kind === 'tool') return 'open tool';
  if ((card.tags ?? []).includes('design pattern') && card.kind === 'recipe') return 'design pattern';
  return card.kind;
}

/** Human-facing tags only — the namespaced enums are retrieval filters,
 *  and each item's own shelf tag just repeats the card header */
const SHELF_TAGS = new Set([
  'civic-media', 'community-organizing', 'local-civic-tech', 'microgrants', 'deliberation',
  'prosocial-design', 'design pattern', 'build day',
  // the commons' own provenance tags on a contribution — the card header says it
  'relational-builder', 'contributed-tool', 'contributed-resource', 'contributed-program', 'contributed-story', 'contributed-prompt',
]);
function readableTags(card: CommonsCard): string[] {
  return [...new Set((card.tags ?? []).filter(t => !t.includes(':') && !SHELF_TAGS.has(t)))].slice(0, 5);
}

/** Spread the shorter list evenly through the longer one, keeping each list's own order */
function interleave<T>(a: T[], b: T[]): T[] {
  if (a.length === 0) return b;
  if (b.length === 0) return a;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const shortFirst = short === a;
  const out: T[] = [];
  const step = (long.length + 1) / (short.length + 1);
  let si = 0;
  for (let li = 0; li < long.length; li++) {
    while (si < short.length && li >= Math.round(step * (si + 1)) - 1) {
      if (shortFirst || out.length > 0) out.push(short[si++]);
      else break;
    }
    out.push(long[li]);
  }
  while (si < short.length) out.push(short[si++]);
  return out;
}

export function CommonsGallery() {
  const setView = useUIStore(s => s.setView);
  const tools = useKnowledgeStore(s => s.tools);
  const stories = useKnowledgeStore(s => s.stories);
  const loaded = useKnowledgeStore(s => s.loaded);
  const memberships = useStudioStore(s => s.memberships);
  const activeStudio = useStudioStore(s => s.activeStudio);
  const studios = useStudioStore(s => s.studios);
  const studioLibrary = useStudioStore(s => s.library);
  const accessMap = useStudioStore(s => s.accessMap);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  // Which library is on the shelves: the commons, or one of the viewer's studios
  // The address names the shelf (/gallery?shelf=responsive-cities), so a
  // studio or event gallery can be linked to, reloaded, and walked back
  // from with the browser's own back button
  const [scope, setScope] = useState<string>(() => readShelfParam() ?? 'commons');
  // True once the viewer picked a shelf themselves (or arrived at one by
  // address) — until then the gallery opens on the studio they're building
  // in (a Responsive Cities member lands on the Responsive Cities Gallery),
  // falling back to the commons
  const scopeChosen = useRef(readShelfParam() !== null);
  /** Change shelves: the person's choice, written to the address */
  const chooseScope = useCallback((next: string) => {
    scopeChosen.current = true;
    setScope(next);
    setCategory('all');
    writeShelfParam(next === 'commons' ? null : next);
  }, []);
  // Nearby: the one filter that cuts across every shelf. It rides alongside
  // search and the shelf picker rather than replacing them.
  const [nearby, setNearby] = useState(false);
  const nearbyPoint = useNearbyStore(s => s.point);
  const nearbyRadius = useNearbyStore(s => s.radiusMiles);
  // Where the Studio KB's tools and stories are rooted (the commons mirror
  // carries it; see fetchStudioLocations)
  const [studioLocations, setStudioLocations] = useState<Map<string, GeoLocation>>(new Map());
  const [detail, setDetail] = useState<Tool | null>(null);
  const [commonsDetail, setCommonsDetail] = useState<CommonsCard | null>(null);
  const [studioDetail, setStudioDetail] = useState<StudioLibraryItem | null>(null);
  const [storyDetail, setStoryDetail] = useState<Story | null>(null);
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [links, setLinks] = useState<GalleryLink[]>([]);
  const [references, setReferences] = useState<GalleryReference[]>([]);
  const [civicCards, setCivicCards] = useState<CommonsCard[]>([]);
  const [neighboringCards, setNeighboringCards] = useState<CommonsCard[]>([]);
  const [organizingCards, setOrganizingCards] = useState<CommonsCard[]>([]);
  const [civicTechCards, setCivicTechCards] = useState<CommonsCard[]>([]);
  const [micrograntCards, setMicrograntCards] = useState<CommonsCard[]>([]);
  const [deliberationCards, setDeliberationCards] = useState<CommonsCard[]>([]);
  const [prosocialCards, setProsocialCards] = useState<CommonsCard[]>([]);
  const [contributedCards, setContributedCards] = useState<CommonsCard[]>([]);
  const [buildDayCards, setBuildDayCards] = useState<CommonsCard[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Semantic ranking from the commons' hybrid search: slug/title → rank
  const [semanticRank, setSemanticRank] = useState<Map<string, number>>(new Map());
  const searchSeq = useRef(0);
  const authUser = useAuthStore(s => s.user);
  // The event galleries this viewer has: every event they have ever joined
  // through a room key, plus every event they administer — a host runs the
  // wall without having scanned the key themselves. A gallery outlives its
  // event: archived rooms stay on the list, the way a studio's shelf does.
  const [eventShelves, setEventShelves] = useState<EventShelfInfo[]>([]);
  // Settled once the viewer's events are known (or there is no viewer), so
  // an event address can tell "still loading" from "not yours to open"
  const [eventShelvesLoaded, setEventShelvesLoaded] = useState(false);
  useEffect(() => {
    if (!authUser) { setEventShelves([]); setEventShelvesLoaded(true); return; }
    let cancelled = false;
    Promise.all([
      fetchMyEvents().catch(() => []),
      fetchMyAdminEvents().catch(() => []),
    ]).then(([mine, admin]) => {
      if (cancelled) return;
      const shelves = new Map<string, EventShelfInfo>();
      for (const ev of mine) {
        shelves.set(ev.code.toUpperCase(), {
          code: ev.code, name: ev.name, admin: false, studioSlug: ev.studioSlug,
          location: ev.location, eventDate: ev.eventDate, archived: ev.archived,
        });
      }
      for (const ev of admin) {
        const key = ev.code.toUpperCase();
        const prior = shelves.get(key);
        shelves.set(key, {
          code: ev.code,
          name: prior?.name ?? ev.name,
          admin: true,
          studioSlug: prior?.studioSlug ?? ev.studio_slug,
          location: prior?.location ?? ev.location,
          eventDate: prior?.eventDate ?? ev.event_date,
          archived: !!ev.archived_at,
        });
      }
      setEventShelves([...shelves.values()]);
      setEventShelvesLoaded(true);
    });
    return () => { cancelled = true; };
  }, [authUser]);
  const eventShelf = useMemo(() => {
    const code = eventCodeOfScope(scope);
    return code ? eventShelves.find(s => s.code.toUpperCase() === code) ?? null : null;
  }, [scope, eventShelves]);
  // An event address is an event scope even before the viewer's shelves
  // arrive (or when the event isn't theirs): the page says so, rather than
  // dressing the code up as a studio
  const isEventScope = eventCodeOfScope(scope) !== null;
  // A studio's own shelf: not the commons, not an event room. Only there
  // does the studio contribute door make sense.
  const isStudioScope = scope !== 'commons' && !isEventScope;
  const [contributeOpen, setContributeOpen] = useState(false);

  // Which of the viewer's event shelves belongs on THIS page. An event that
  // carries a studio surfaces on that studio's gallery and nowhere else. An
  // event with no studio surfaces nowhere but its own shelf: the commons is
  // everyone's, and a room's wall hoisted above it reads as the commons
  // itself (that is what CONNECT looked like to everyone who joined through
  // it). Never on another studio's shelf, and never on the event's own shelf
  // (it is already the page).
  //
  // Nothing here widens who can see what: these are only the viewer's own
  // events (my_event is their profile's code, my_admin_events is theirs to
  // run), so this decides placement, not access.
  const shelvesHere = useMemo(
    () => (isEventScope ? [] : eventShelves.filter(ev =>
      !ev.archived && ev.studioSlug !== null && ev.studioSlug === scope)),
    [eventShelves, scope, isEventScope],
  );
  // EventShelf loads its own entries, so it reports the count back up and
  // the section stays hidden (mounted, so it can count) until there is
  // something on it — an empty "nobody has shared yet" box is pressure
  // nobody asked for.
  const [shelfCounts, setShelfCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchPrompts().then(setPrompts).catch(() => {});
    fetchGalleryLinks().then(setLinks).catch(() => {});
    fetchCivicMediaCards().then(setCivicCards).catch(() => {});
    fetchNeighboringRecipeCards().then(setNeighboringCards).catch(() => {});
    fetchCommunityOrganizingCards().then(setOrganizingCards).catch(() => {});
    fetchLocalCivicTechCards().then(setCivicTechCards).catch(() => {});
    fetchMicrograntCards().then(setMicrograntCards).catch(() => {});
    fetchDeliberationCards().then(setDeliberationCards).catch(() => {});
    fetchProsocialDesignCards().then(setProsocialCards).catch(() => {});
    fetchContributedCards().then(setContributedCards).catch(() => {});
    fetchBuildDayCards().then(setBuildDayCards).catch(() => {});
    fetchStudioLocations().then(setStudioLocations).catch(() => {});
    loadGalleryReferences().then(setReferences).catch(() => {});
  }, []);

  // The browser's back/forward button moving between shelves
  useEffect(() => {
    const onPop = () => {
      const next = readShelfParam() ?? 'commons';
      scopeChosen.current = true;
      setScope(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Arriving with a specific entry in hand (a "Drew on the commons" chip in
  // chat) — open its card directly, wherever on the shelves it lives
  const galleryFocusSlug = useUIStore(s => s.galleryFocusSlug);
  const clearGalleryFocus = useUIStore(s => s.clearGalleryFocus);
  useEffect(() => {
    if (!galleryFocusSlug) return;
    clearGalleryFocus();
    fetchCommonsItemDetail(galleryFocusSlug)
      .then(d => { if (d) setCommonsDetail(d); })
      .catch(() => {});
  }, [galleryFocusSlug, clearGalleryFocus]);

  // Same door for a studio library item ("Drew on the studio" chip). The
  // library loads with the studio store, so wait for the item to appear
  // rather than clearing the focus on a shelf that hasn't arrived yet.
  const galleryFocusStudioItemId = useUIStore(s => s.galleryFocusStudioItemId);
  const clearStudioFocus = useUIStore(s => s.clearStudioFocus);
  const libraryLoaded = useStudioStore(s => s.libraryLoaded);
  useEffect(() => {
    if (!galleryFocusStudioItemId) return;
    const item = studioLibrary.find(i => i.id === galleryFocusStudioItemId);
    if (item) {
      clearStudioFocus();
      setStudioDetail(item);
    } else if (libraryLoaded) {
      clearStudioFocus();
    }
  }, [galleryFocusStudioItemId, clearStudioFocus, studioLibrary, libraryLoaded]);

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

  // The viewer's studios: the frame they're building in plus everywhere they
  // belong — approved memberships only; a pending request grants nothing yet
  const myApproved = useMemo(() => approvedMemberships(memberships), [memberships]);
  const mySlugs = useMemo(() => {
    const slugs = new Set(myApproved.map(m => m.studio_slug));
    if (activeStudio) slugs.add(activeStudio.slug);
    return slugs;
  }, [myApproved, activeStudio]);

  const myAdminSlugs = useMemo(
    () => new Set(adminMemberships(memberships).map(m => m.studio_slug)),
    [memberships],
  );

  // Studio libraries this viewer can browse: approved membership in a gated
  // studio, or any studio whose shelf actually holds items they can see
  const libraryStudios = useMemo(() => {
    const withItems = new Set(studioLibrary.map(i => i.studio_slug));
    return myApproved.filter(
      m => accessMap.get(m.studio_slug) === 'gated' || withItems.has(m.studio_slug),
    );
  }, [myApproved, accessMap, studioLibrary]);

  // Open on the active studio's own gallery when it has one. Memberships and
  // the library arrive after mount, so this settles once they do; a shelf the
  // viewer clicked in the meantime stays put.
  useEffect(() => {
    if (scopeChosen.current) return;
    const home = activeStudio?.slug;
    const next = home && libraryStudios.some(m => m.studio_slug === home) ? home : 'commons';
    setScope(prev => (prev === next ? prev : next));
  }, [activeStudio, libraryStudios]);

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

  // Tech-for-building never renders as a card — it stays AI build context.
  // The Process Guide (no screenshot) closes the tools shelf instead of
  // opening it — its KB sort_order is read-only from here.
  const galleryTools = useMemo(() => {
    const last = (t: Tool) =>
      RELATIONAL_TECH_OVERRIDES.has(t.name.trim().toLowerCase()) ? 1 : 0;
    return tools
      .filter(t => displayCategory(t) !== 'tech_for_building')
      .sort((a, b) => last(a) - last(b));
  }, [tools]);

  const entries = useMemo<GalleryEntry[]>(() => {
    const q = query.trim().toLowerCase();
    const substringHit = (e: GalleryEntry) => {
      if (e.type === 'tool') return searchItems([e.tool], query).length > 0;
      if (e.type === 'studio') {
        const i = e.item;
        return [i.title, i.summary, i.body, i.attribution, ...i.tags]
          .some(v => v && v.toLowerCase().includes(q));
      }
      if (e.type === 'kb-story') {
        const s = e.story;
        return [s.title, s.story_text, s.attribution]
          .some(v => v && v.toLowerCase().includes(q));
      }
      const c = e.card;
      return [c.title, c.summary, c.attribution?.name, ...(c.tags ?? [])]
        .some(v => v && v.toLowerCase().includes(q));
    };

    // A studio's own gallery: its private shelf plus the public tools the
    // studio has claimed — the commons categories don't apply here.
    // Principles never render as cards: they're the studio's live frame,
    // woven into every member build, not items to remix (see the panel).
    if (scope !== 'commons') {
      const shelf: GalleryEntry[] = studioLibrary
        .filter(i => i.studio_slug === scope && i.kind !== 'principle')
        .map(i => ({ key: `studio-${i.id}`, type: 'studio' as const, item: i }));
      const studioTools: GalleryEntry[] = galleryTools
        .filter(t => studioSlugsForTool(t, links).includes(scope))
        .map(t => ({ key: `tool-${t.id}`, type: 'tool' as const, tool: t }));
      // What members offered to the commons from this studio and a steward
      // approved — the gift lands back on the shelf it was offered from,
      // newest first, so the person who gave it finds it where they looked
      const studioGifts: GalleryEntry[] = contributedCards
        .filter(c => c.source_studio_slug === scope)
        .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
      // Commons shelves the studio pins onto its gallery (studio-context):
      // commons cards with commons lineage, placed where members look
      const pins = studioCommonsPins(scope);
      const pinned: GalleryEntry[] = pins.includes('deliberation')
        ? deliberationCards.map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }))
        : [];
      // Browsing order on a studio shelf with pins: members' own remixes
      // lead (they are the loop's proof, and carry lineage), then everything
      // with a screenshot, then the text-only cards — with the studio's own
      // items spread evenly among the pinned commons cards in each band, so
      // the shelf reads as one gallery rather than two stacked lists.
      const hasImage = (e: GalleryEntry) =>
        e.type === 'studio' ? !!e.item.image_url : e.type === 'commons' ? !!e.card.image_url : true;
      const remixes = shelf.filter(e => e.type === 'studio' && e.item.remix_of && e.item.created_by);
      const own = [...studioGifts, ...shelf.filter(e => !remixes.includes(e)), ...studioTools];
      const band = (test: (e: GalleryEntry) => boolean) =>
        interleave(own.filter(test), pinned.filter(test));
      const all = pinned.length > 0
        ? [...remixes, ...band(hasImage), ...band(e => !hasImage(e))]
        : [...studioGifts, ...shelf, ...studioTools];
      return q ? all.filter(substringHit) : all;
    }

    const toolEntries: GalleryEntry[] =
      category === 'all' || category === 'relational_tech' || category === 'mine'
        ? (category === 'mine' ? galleryTools.filter(t => badgesFor(t).length > 0) : galleryTools)
            .map(t => ({ key: `tool-${t.id}`, type: 'tool' as const, tool: t }))
        : [];
    const civicEntries: GalleryEntry[] =
      category === 'all' || category === 'civic_media'
        ? civicCards.map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }))
        : category === 'stories'
          // The field-guide stories live on the Civic Media shelf and are
          // also first-class Local Stories
          ? civicCards
              .filter(c => c.kind === 'story')
              .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }))
          : [];
    const neighboringEntries: GalleryEntry[] =
      category === 'all' || category === 'neighboring'
        ? neighboringCards.map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }))
        : [];
    // The organizing and civic tech shelves' stories are real people in real
    // places — first-class Local Stories, same as the field-guide stories
    const storyCut = (cards: CommonsCard[], own: string) =>
      category === 'all' || category === own
        ? cards
        : category === 'stories'
          ? cards.filter(c => c.kind === 'story')
          : [];
    const organizingEntries: GalleryEntry[] = storyCut(organizingCards, 'organizing')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    const civicTechEntries: GalleryEntry[] = storyCut(civicTechCards, 'civic_tech')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    const micrograntEntries: GalleryEntry[] = storyCut(micrograntCards, 'microgrants')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    const deliberationEntries: GalleryEntry[] = storyCut(deliberationCards, 'deliberation')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    const prosocialEntries: GalleryEntry[] = storyCut(prosocialCards, 'prosocial')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    // Community build days lead the whole gallery: the featured card is the
    // front door to planning one, and it sits above every shelf
    const buildDayEntries: GalleryEntry[] = storyCut(buildDayCards, 'build_day')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    // Approved contributions from builders, whatever studio they came from.
    // One that also rides a fixed shelf (a microgrant program offered back)
    // is deduped below in favour of that shelf.
    const contributedEntries: GalleryEntry[] = storyCut(contributedCards, 'contributed')
      .map(c => ({ key: `commons-${c.slug}`, type: 'commons' as const, card: c }));
    // Items studios have explicitly shared beyond their walls join the
    // commons view for every signed-in builder
    const sharedEntries: GalleryEntry[] =
      category === 'all' || category === 'stories'
        ? studioLibrary
            .filter(i => i.visibility === 'shared' && i.status === 'approved' && i.kind !== 'principle')
            .filter(i => category !== 'stories' || i.kind === 'story')
            .map(i => ({ key: `studio-${i.id}`, type: 'studio' as const, item: i }))
        : [];
    // The Studio KB's community stories — narrative accounts from the
    // relational tech network, first-class in the gallery via Local Stories
    const kbStoryEntries: GalleryEntry[] =
      category === 'all' || category === 'stories'
        ? stories.map(s => ({ key: `kb-story-${s.id}`, type: 'kb-story' as const, story: s }))
        : [];

    const rankOf = (e: GalleryEntry): number | undefined =>
      e.type === 'commons'
        ? semanticRank.get(e.card.slug) ?? semanticRank.get(e.card.title.trim().toLowerCase())
        : e.type === 'tool'
          ? semanticRank.get(e.tool.name.trim().toLowerCase())
          : e.type === 'kb-story' && e.story.title
            ? semanticRank.get(e.story.title.trim().toLowerCase())
            : undefined;

    // A card can ride two shelves (the microgrant gathering recipe is both a
    // neighboring recipe and a microgrants card): the first shelf keeps it
    const seen = new Set<string>();
    const all = [...buildDayEntries, ...toolEntries, ...civicEntries, ...neighboringEntries, ...organizingEntries, ...civicTechEntries, ...micrograntEntries, ...deliberationEntries, ...prosocialEntries, ...contributedEntries, ...sharedEntries, ...kbStoryEntries]
      .filter(e => !seen.has(e.key) && (seen.add(e.key), true));

    if (!q) {
      // Browsing order: the featured build day card, then your studios'
      // tools, then each shelf in turn
      const rank = (e: GalleryEntry) =>
        e.type === 'commons' && e.card.slug === BUILD_DAY_CARD_SLUG ? 0
          : e.type === 'tool' && badgesFor(e.tool).length > 0 ? 1
            : 2;
      return all.sort((a, b) => rank(a) - rank(b));
    }

    // Searching: semantic rank leads (the commons understands the ask),
    // plain substring matches follow for anything retrieval missed
    return all
      .map(e => ({ e, rank: rankOf(e), sub: substringHit(e) }))
      .filter(x => x.rank !== undefined || x.sub)
      .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
      .map(x => x.e);
  }, [galleryTools, civicCards, neighboringCards, organizingCards, civicTechCards, micrograntCards, deliberationCards, prosocialCards, contributedCards, buildDayCards, stories, category, query, badgesFor, semanticRank, scope, studioLibrary, links]);

  /** Where an entry is rooted, whichever shelf it came from */
  const locationOf = useCallback((e: GalleryEntry): GeoLocation | null => {
    if (e.type === 'commons') return e.card.location;
    if (e.type === 'studio') return e.item.location;
    if (e.type === 'tool') return studioLocations.get(e.tool.id) ?? null;
    return studioLocations.get(e.story.id) ?? null;
  }, [studioLocations]);

  // Nearby: what is rooted within the radius of the person's place, closest
  // first. Things only MADE near them (a book, a framework pinned to its
  // author's city) follow in a second band, so a Buy Nothing recipe never
  // reads as a Bainbridge Island program to someone in Bainbridge Island.
  const placed = useMemo(() => {
    if (!nearby || !nearbyPoint) return { entries, miles: new Map<string, PlaceHit>() };
    const miles = new Map<string, PlaceHit>();
    const near: { e: GalleryEntry; d: number; origin: boolean }[] = [];
    for (const e of entries) {
      const loc = locationOf(e);
      if (!loc) continue;
      const d = nearestMiles(loc, nearbyPoint);
      if (d > nearbyRadius) continue;
      const origin = !isPlaceRooted(loc);
      near.push({ e, d, origin });
      miles.set(e.key, { miles: d, label: nearestLabel(loc, nearbyPoint), origin, precision: loc.precision });
    }
    near.sort((a, b) => Number(a.origin) - Number(b.origin) || a.d - b.d);
    return { entries: near.map(x => x.e), miles };
  }, [entries, nearby, nearbyPoint, nearbyRadius, locationOf]);
  const visibleEntries = placed.entries;
  /** "12 mi · Logan Square, Chicago" for a card in Nearby. A pin only as
   *  fine as a city is measured to the city's centre, so inside that
   *  scale it reads "in Chicago, Illinois" rather than "under a mile". */
  const placeLineFor = (e: GalleryEntry): string | undefined => {
    const hit = placed.miles.get(e.key);
    if (!hit) return undefined;
    const made = hit.origin ? ' (made there)' : '';
    const within = PRECISION_SCALE_MILES[hit.precision] ?? 0;
    if (hit.miles < within) return `in ${hit.label}${made}`;
    return `${formatMiles(hit.miles)} · ${hit.label}${made}`;
  };
  // The viewer's own shelves that sit inside the radius — a build day's
  // wall is the most local thing the gallery holds
  const nearbyShelves = useMemo(() => {
    if (!nearby || !nearbyPoint) return [];
    return eventShelves
      .filter(ev => ev.location && nearestMiles(ev.location, nearbyPoint) <= nearbyRadius && eventScopeFor(ev.code) !== scope)
      .map(ev => ({ scope: eventScopeFor(ev.code), label: galleryNameFor(ev.name), miles: nearestMiles(ev.location!, nearbyPoint) }))
      .sort((a, b) => a.miles - b.miles);
  }, [nearby, nearbyPoint, nearbyRadius, eventShelves, scope]);

  const promptsFor = (tool: Tool) => prompts.filter(p => p.parent_tool_id === tool.id);

  const scopeLabel = (slug: string) =>
    libraryStudios.find(m => m.studio_slug === slug)?.studio_label ??
    studioMeta.get(slug)?.label ?? slug;
  // A contributed card is labeled with the studio it was offered from when
  // the viewer knows that studio by name; otherwise it is simply a gift
  const contributedLabel = (card: CommonsCard): string | undefined => {
    const slug = card.source_studio_slug;
    if (!slug) return undefined;
    const known = libraryStudios.find(m => m.studio_slug === slug)?.studio_label ?? studioMeta.get(slug)?.label;
    return known ? galleryNameFor(known) : undefined;
  };

  function planStudioItem(item: StudioLibraryItem) {
    startFromStudioItem(item, scopeLabel(item.studio_slug));
    setStudioDetail(null);
    setView('builder');
  }

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

  // The steward can correct the record right where a connection is seen:
  // remove a wrong link, add a missing one, in any entry's detail dialog.
  // (Client-side convenience — the admin-requests function is the real gate.)
  const curation = useMemo<ConnectionsCuration | undefined>(() => {
    if (!isSuperAdmin(authUser?.email)) return undefined;
    const options: ConnectableEntry[] = [
      ...galleryTools.map(t => ({
        source: 'kb_tool' as const, id: t.id, title: t.name, kind: 'tool', group: 'Relational tech tools',
      })),
      ...stories.map(s => ({
        source: 'kb_story' as const, id: s.id, title: s.title ?? 'Community story', kind: 'story', group: 'Community stories',
      })),
      ...civicCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Civic media',
      })),
      ...neighboringCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Neighboring recipes',
      })),
      ...organizingCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Community organizing',
      })),
      ...civicTechCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Local civic tech',
      })),
      ...contributedCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'From builders',
      })),
      ...micrograntCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Microgrants',
      })),
      ...deliberationCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Deliberation',
      })),
      ...prosocialCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Prosocial design',
      })),
      ...buildDayCards.map(c => ({
        source: 'commons' as const, id: c.slug, title: c.title, kind: c.kind, group: 'Build days',
      })),
      ...studioLibrary.map(i => ({
        source: 'studio' as const, id: i.id, title: i.title, kind: i.kind, group: 'Studio libraries',
      })),
    ];
    const onChanged = () => {
      invalidateGalleryReferences();
      loadGalleryReferences().then(setReferences).catch(() => {});
    };
    return { options, onChanged };
  }, [authUser, galleryTools, stories, civicCards, neighboringCards, organizingCards, civicTechCards, micrograntCards, deliberationCards, prosocialCards, contributedCards, buildDayCards, studioLibrary]);

  /** Open a connection's other end, whichever shelf it lives on */
  function openRef(source: RefSource, id: string): boolean {
    const open = (fn: () => void) => {
      setDetail(null);
      setCommonsDetail(null);
      setStudioDetail(null);
      setStoryDetail(null);
      fn();
      return true;
    };
    if (source === 'kb_tool') {
      const t = tools.find(x => x.id === id);
      return t ? open(() => setDetail(t)) : false;
    }
    if (source === 'kb_story') {
      const s = stories.find(x => x.id === id);
      return s ? open(() => setStoryDetail(s)) : false;
    }
    if (source === 'commons') {
      const c = [...buildDayCards, ...civicCards, ...neighboringCards, ...organizingCards, ...civicTechCards, ...micrograntCards, ...deliberationCards, ...prosocialCards, ...contributedCards].find(x => x.slug === id);
      return c ? open(() => setCommonsDetail(c)) : false;
    }
    const i = studioLibrary.find(x => x.id === id);
    return i ? open(() => setStudioDetail(i)) : false;
  }

  async function planCommons(card: CommonsCard) {
    setBusyKey(`commons-${card.slug}`);
    setError(null);
    try {
      await startFromCommonsItem(card);
      setCommonsDetail(null);
      setView('builder');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start from that entry');
    } finally {
      setBusyKey(null);
    }
  }

  // The shelves this viewer can stand on: the commons, their studios, and
  // every event they have been part of — a past event's gallery included
  const shelfOptions = useMemo<ShelfOption[]>(() => [
    { scope: 'commons', label: 'Commons', group: 'commons' as const },
    ...libraryStudios.map(m => ({ scope: m.studio_slug, label: galleryNameFor(m.studio_label), group: 'studio' as const })),
    ...eventShelves.map(ev => ({
      scope: eventScopeFor(ev.code), label: galleryNameFor(ev.name), group: 'event' as const,
      note: ev.archived ? 'past' : undefined,
    })),
  ], [libraryStudios, eventShelves]);
  const shelfCategories = useMemo(
    () => [...CATEGORIES, ...(anyStudioTools ? [{ key: 'mine', label: 'Your studios' } as const] : [])],
    [anyStudioTools],
  );

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-5">
        {/* Where you are — the commons, or one of your own shelves — with
            the way back and the way across right here, the same on every
            shelf, so opening a studio or an event never strands anyone */}
        <div className="min-w-0 space-y-1.5">
          {scope !== 'commons' && (
            <button
              onClick={() => chooseScope('commons')}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3" /> Back to the Commons Gallery
            </button>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight">
              {scope === 'commons'
                ? 'Commons Gallery'
                : eventShelf
                  ? galleryNameFor(eventShelf.name)
                  : isEventScope
                    ? 'Event Gallery'
                    : galleryNameFor(scopeLabel(scope))}
            </h1>
            {shelfOptions.length > 1 && (
              <ShelfSwitcher options={shelfOptions} scope={scope} onChoose={chooseScope} />
            )}
            {isStudioScope && myAdminSlugs.has(scope) && (
              <button
                onClick={() => setView('studio-admin')}
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <KeyRound className="size-3" /> Manage library
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {scope === 'commons'
              ? 'Tools, practices, and recipes from the civic commons – ready to be remixed, with attribution and lineage, for your place.'
              : isEventScope
                ? `What the room built — pinned by the builders themselves via Share Live — with the neighborhood's own tools beneath for inspiration. Only people at the event${eventShelf?.admin ? ' and its hosts' : ''} have this shelf.`
                : 'Your studio’s own examples, prompts, and materials — for approved members to build from and remix, with the studio’s principles live in every build.'}
          </p>
          {eventShelf && (eventShelf.location || eventShelf.eventDate || eventShelf.archived) && (
            <p className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {eventShelf.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" /> {eventShelf.location.label}
                </span>
              )}
              {eventShelf.eventDate && <span>{formatEventDay(eventShelf.eventDate)}</span>}
              {eventShelf.archived && <span>· a past event; the shelf stays</span>}
            </p>
          )}
        </div>

        {/* What the room made, at the top of whatever shelf you're on.
            Share Live already pins a build to its event wall, but that wall
            lived behind a scope switch, so nobody browsing the gallery saw
            it arrive. A participant or host now meets it first. It stays
            hidden until something is pinned, and is skipped when you are
            already standing on that shelf. */}
        {shelvesHere.map(ev => (
          <section
            key={ev.code}
            className={`rounded-lg border bg-muted/30 p-3 space-y-2 ${
              shelfCounts[ev.code] ? '' : 'hidden'
            }`}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Fresh from {ev.name}</h2>
                <p className="text-xs text-muted-foreground">
                  Builds the room has shared, newest first — pinned by the
                  builders themselves with Share Live.
                </p>
              </div>
              <button
                onClick={() => chooseScope(eventScopeFor(ev.code))}
                className="text-xs text-primary hover:underline shrink-0"
              >
                Open the shelf
              </button>
            </div>
            <EventShelf
              code={ev.code}
              name={ev.name}
              admin={ev.admin}
              onCount={n => setShelfCounts(c => (c[ev.code] === n ? c : { ...c, [ev.code]: n }))}
            />
          </section>
        ))}

        {/* Waiting at a studio's door: the request is on file (an invite
            link or the profile page put it there), and a Studio Admin's
            approval is what opens the shelf. Say so where the shelf would be. */}
        {activeStudio && memberships.some(m => m.studio_slug === activeStudio.slug && m.status === 'pending') && (
          <section className="rounded-xl border border-dashed px-4 py-3 text-sm">
            <span className="font-medium">Your request to join {activeStudio.label} is waiting for a Studio Admin.</span>
            <span className="text-muted-foreground">
              {' '}Once it's approved, the studio's own gallery appears here and its principles ride in your builds.
            </span>
          </section>
        )}

        {/* The same invitation for a studio's own shelf. A member browsing
            their gallery can add to it from here without building anything
            first — the publish flow only covers builds, and a studio
            collects models, practices and stories too. */}
        {isStudioScope && (
          <div className="rounded-lg border border-dashed p-3 flex items-start gap-3">
            <Sprout className="size-4 text-primary mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Add something to this gallery</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                A model from your town, a practice that works, a prompt or a
                story — it doesn't have to be something you built. A Studio
                Admin reviews it before it lands on the shelf.
              </p>
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0"
              onClick={() => setContributeOpen(true)}>
              <Plus className="size-3" /> Contribute
            </Button>
          </div>
        )}
        {isStudioScope && (
          <StudioContributeDialog
            open={contributeOpen}
            onOpenChange={setContributeOpen}
            studioSlug={scope}
            studioLabel={scopeLabel(scope)}
          />
        )}

        {/* The studio's principles aren't cards to remix — they're the live
            frame every member build carries, layered on the base RTP
            principles. Shown here so members know what's active. */}
        {scope !== 'commons' && !isEventScope && (
          <StudioPrinciplesPanel
            studioLabel={scopeLabel(scope)}
            principles={studioLibrary.filter(
              i => i.studio_slug === scope && i.kind === 'principle' && i.status === 'approved',
            )}
          />
        )}

        {/* One quiet toolbar: search first (it is the fastest way through
            six hundred cards), Nearby beside it, and the shelves behind one
            picker instead of a wall of chips. */}
        {!isEventScope && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder={scope === 'commons' ? 'Search the commons…' : `Search the ${galleryNameFor(scopeLabel(scope))}…`}
                  className="h-9 w-full pl-8 pr-8 text-sm"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    title="Clear the search"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setNearby(v => !v)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${
                  nearby ? 'bg-foreground text-background border-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Only what is rooted near a place — your own, or one you type"
              >
                <MapPin className="size-3.5" /> Nearby
              </button>
              {scope === 'commons' && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Which shelf of the commons to browse"
                  >
                    <Library className="size-3.5" />
                    {shelfCategories.find(c => c.key === category)?.label ?? 'Everything'}
                    <ChevronDown className="size-3 opacity-60" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-52">
                    <DropdownMenuLabel>Shelves</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={category} onValueChange={v => setCategory(String(v))}>
                      {shelfCategories.map(c => (
                        <DropdownMenuRadioItem key={c.key} value={c.key}>{c.label}</DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
            {nearby && (
              <NearbyBar
                shelves={nearbyShelves}
                onOpenShelf={chooseScope}
                placedCount={nearbyPoint ? visibleEntries.length : null}
              />
            )}
            {scope === 'commons' && <ContributeLine />}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* The event shelf is its own thing — demo decks, not remixable
            cards — so it replaces the grid rather than filtering it. The
            decks lead; a curated inspiration shelf (the neighborhood's real
            tools) follows beneath them, and only the decks reach the
            presentation page. */}
        {isEventScope ? (
          eventShelf ? (
            <>
              <EventShelf code={eventShelf.code} name={eventShelf.name} admin={eventShelf.admin} />
              <EventInspiration code={eventShelf.code} name={eventShelf.name} />
            </>
          ) : !eventShelvesLoaded ? (
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="size-3.5 animate-spin" /> Opening the event's gallery…
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {authUser
                ? 'This event’s gallery belongs to the people who were there and its hosts. If that’s you, join it with the room key and it appears here.'
                : 'Sign in to open an event’s gallery — it belongs to the people who were there and its hosts.'}
            </p>
          )
        ) : !loaded ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="size-3.5 animate-spin" /> Loading the gallery…
          </p>
        ) : nearby && !nearbyPoint ? (
          <p className="text-sm text-muted-foreground">
            Tell the gallery where you are, and it will show what is rooted nearby.
          </p>
        ) : visibleEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {nearby
              ? `Nothing on this shelf is placed within ${nearbyRadius} miles of ${nearbyPoint?.label ?? 'there'} yet. Widen the circle, or be the first: share something from your neighborhood.`
              : query.trim()
                ? 'Nothing matches that search.'
                : scope !== 'commons'
                  ? 'This studio’s shelf is empty so far.'
                  : 'Nothing here yet.'}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEntries.map(entry =>
              entry.type === 'tool' ? (
                <ToolCard
                  key={entry.key}
                  tool={entry.tool}
                  studioBadges={badgesFor(entry.tool)}
                  placeLine={placeLineFor(entry)}
                  busy={busyKey === entry.key}
                  anyBusy={busyKey !== null}
                  onOpen={() => setDetail(entry.tool)}
                  onBuild={() => buildTool(entry.tool)}
                />
              ) : entry.type === 'studio' ? (
                <StudioItemCard
                  key={entry.key}
                  item={entry.item}
                  studioLabel={scopeLabel(entry.item.studio_slug)}
                  lineage={formatLineageChain(studioLineageChain(entry.item, studioLibrary))}
                  credit={studioPartnerCredit(entry.item.studio_slug)}
                  placeLine={placeLineFor(entry)}
                  anyBusy={busyKey !== null}
                  onOpen={() => setStudioDetail(entry.item)}
                  onPlan={() => planStudioItem(entry.item)}
                />
              ) : entry.type === 'kb-story' ? (
                <KBStoryCard
                  key={entry.key}
                  story={entry.story}
                  placeLine={placeLineFor(entry)}
                  onOpen={() => setStoryDetail(entry.story)}
                />
              ) : (
                <RecipeCard
                  key={entry.key}
                  card={entry.card}
                  shelfLabel={isContributed(entry.card) ? contributedLabel(entry.card) : undefined}
                  placeLine={placeLineFor(entry)}
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

      <footer className="max-w-5xl mx-auto px-4 md:px-6 pb-6 text-center text-xs text-muted-foreground">
        Made with care for neighbors everywhere ·{' '}
        <a href="#privacy" className="underline underline-offset-2 hover:text-foreground">
          Privacy &amp; Terms
        </a>
        {' '}·{' '}
        <a href="#contact" className="underline underline-offset-2 hover:text-foreground">
          Contact
        </a>
      </footer>

      {detail && (
        <ToolDetailDialog
          tool={detail}
          childPrompts={promptsFor(detail)}
          busy={busyKey === `tool-${detail.id}`}
          references={references}
          curation={curation}
          onOpenRef={openRef}
          onBuild={() => buildTool(detail)}
          onOpenChange={open => { if (!open) setDetail(null); }}
        />
      )}
      {commonsDetail && (
        <RecipeDetailDialog
          card={commonsDetail}
          shelfLabel={isContributed(commonsDetail) ? contributedLabel(commonsDetail) : undefined}
          busy={busyKey === `commons-${commonsDetail.slug}`}
          references={references}
          curation={curation}
          onOpenRef={openRef}
          onPlan={() => planCommons(commonsDetail)}
          onOpenChange={open => { if (!open) setCommonsDetail(null); }}
        />
      )}
      {studioDetail && (
        <StudioItemDetailDialog
          item={studioDetail}
          studioLabel={scopeLabel(studioDetail.studio_slug)}
          remixOfTitle={
            studioDetail.remix_of
              ? studioLibrary.find(x => x.id === studioDetail.remix_of)?.title ?? null
              : null
          }
          lineage={formatLineageChain(studioLineageChain(studioDetail, studioLibrary))}
          credit={studioPartnerCredit(studioDetail.studio_slug)}
          references={references}
          curation={curation}
          onOpenRef={openRef}
          onPlan={() => planStudioItem(studioDetail)}
          onOpenChange={open => { if (!open) setStudioDetail(null); }}
        />
      )}
      {storyDetail && (
        <KBStoryDetailDialog
          story={storyDetail}
          references={references}
          curation={curation}
          onOpenRef={openRef}
          onOpenChange={open => { if (!open) setStoryDetail(null); }}
        />
      )}
    </div>
  );
}

interface ShelfOption {
  scope: string;
  label: string;
  group: 'commons' | 'studio' | 'event';
  /** "past" for an event that has ended — the shelf stays, the door is shut */
  note?: string;
}

/**
 * Which shelf you're standing on, and the way to any other: the commons,
 * your studios, every event you've been part of. One picker in the header
 * so the move across is the same from every shelf.
 */
function ShelfSwitcher({ options, scope, onChoose }: {
  options: ShelfOption[]; scope: string; onChoose: (scope: string) => void;
}) {
  const current = options.find(o => o.scope === scope);
  const studios = options.filter(o => o.group === 'studio');
  const events = options.filter(o => o.group === 'event');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Switch between the commons, your studios, and your events"
      >
        <Library className="size-3" />
        {current?.scope === 'commons' ? 'Your galleries' : 'Switch gallery'}
        <ChevronDown className="size-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        <DropdownMenuItem onClick={() => onChoose('commons')} className={scope === 'commons' ? 'font-medium' : ''}>
          Commons Gallery
        </DropdownMenuItem>
        {studios.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Your studios</DropdownMenuLabel>
            {studios.map(o => (
              <DropdownMenuItem key={o.scope} onClick={() => onChoose(o.scope)} className={scope === o.scope ? 'font-medium' : ''}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
        {events.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Your events</DropdownMenuLabel>
            {events.map(o => (
              <DropdownMenuItem key={o.scope} onClick={() => onChoose(o.scope)} className={scope === o.scope ? 'font-medium' : ''}>
                <span className="truncate">{o.label}</span>
                {o.note && <span className="ml-auto text-[10px] text-muted-foreground pl-2">{o.note}</span>}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** "Fri, Oct 9, 2026" from a YYYY-MM-DD */
function formatEventDay(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Where Nearby measures from. No place yet: the browser's, or a typed town.
 * A place set: the circle's size, and the ways to change it. Remembered in
 * this browser (nearby-store), so it is set once.
 */
function NearbyBar({ shelves, onOpenShelf, placedCount }: {
  shelves: { scope: string; label: string; miles: number }[];
  onOpenShelf: (scope: string) => void;
  /** How many cards the circle holds right now; null before a place is set */
  placedCount: number | null;
}) {
  const point = useNearbyStore(s => s.point);
  const radius = useNearbyStore(s => s.radiusMiles);
  const busy = useNearbyStore(s => s.busy);
  const error = useNearbyStore(s => s.error);
  const setRadius = useNearbyStore(s => s.setRadius);
  const locate = useNearbyStore(s => s.locate);
  const findPlace = useNearbyStore(s => s.findPlace);
  const [typed, setTyped] = useState('');
  const [editing, setEditing] = useState(false);
  const showForm = !point || editing;

  async function submit() {
    if (!typed.trim()) return;
    if (await findPlace(typed)) { setTyped(''); setEditing(false); }
  }

  return (
    <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs space-y-1.5">
      {showForm ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">Near</span>
          <Input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void submit(); }}
            placeholder="a town, neighborhood, or zip"
            className="h-7 w-56 text-xs"
            autoFocus={editing}
          />
          <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy || !typed.trim()} onClick={() => void submit()}>
            {busy ? <Loader2 className="size-3 animate-spin" /> : 'Go'}
          </Button>
          <span className="text-muted-foreground">or</span>
          <button
            onClick={() => { void locate().then(ok => { if (ok) setEditing(false); }); }}
            disabled={busy}
            className="inline-flex items-center gap-1 text-primary hover:underline disabled:opacity-50"
          >
            <LocateFixed className="size-3" /> use my location
          </button>
          {point && (
            <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground">
              cancel
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <MapPin className="size-3 text-primary" />
          <span>
            Within
            <select
              value={radius}
              onChange={e => setRadius(Number(e.target.value))}
              className="mx-1 rounded border bg-background px-1 py-0.5 text-xs"
              title="How wide a circle"
            >
              {NEARBY_RADII_MILES.map(r => <option key={r} value={r}>{r} mi</option>)}
            </select>
            of <span className="font-medium">{point.label}</span>
            {placedCount !== null && <span className="text-muted-foreground"> · {placedCount} {placedCount === 1 ? 'card' : 'cards'}</span>}
          </span>
          <button onClick={() => setEditing(true)} className="text-primary hover:underline">change</button>
          <button
            onClick={() => { void locate(); }}
            disabled={busy}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : <LocateFixed className="size-3" />} my location
          </button>
        </div>
      )}
      {error && <p className="text-destructive">{error}</p>}
      {shelves.length > 0 && (
        <p className="text-muted-foreground">
          Galleries near here:{' '}
          {shelves.map((sh, i) => (
            <span key={sh.scope}>
              {i > 0 && ', '}
              <button onClick={() => onOpenShelf(sh.scope)} className="text-primary hover:underline">{sh.label}</button>
              {' '}({formatMiles(sh.miles)})
            </span>
          ))}
        </p>
      )}
      <p className="text-muted-foreground/80">
        Closest first. Things only <em>made</em> near here (a book, a method pinned to its author's town) come after what is rooted here.
        {' '}Places from OpenStreetMap.
      </p>
    </div>
  );
}

/** The Contribute door, in a line — the header holds the button too */
function ContributeLine() {
  const [open, setOpen] = useState(false);
  return (
    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
      <Sprout className="size-3.5 text-green-600 mt-0.5 shrink-0" />
      <span>
        Have a link, doc, or story from your neighborhood?{' '}
        <button onClick={() => setOpen(true)} className="text-primary hover:underline">Contribute it to the commons</button>
        {' '}— stewards shelve it, and it shapes other neighborhoods' journeys.
      </span>
      {open && <ContributeDialog open={open} onOpenChange={setOpen} />}
    </p>
  );
}

/** A card's place, in Nearby: the distance and the closest of its places */
function PlaceLine({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p className="text-[11px] text-primary/90 inline-flex items-center gap-1 -mt-0.5">
      <MapPin className="size-3 shrink-0" /> {text}
    </p>
  );
}

/**
 * The studio's live frame: its principles, always on for member builds.
 * A quiet banner with the names; each expands to its full text on tap.
 */
function StudioPrinciplesPanel({
  studioLabel, principles,
}: {
  studioLabel: string; principles: StudioLibraryItem[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (principles.length === 0) return null;
  return (
    <section className="rounded-xl border border-dashed px-4 py-3 space-y-2">
      <p className="text-sm">
        <span className="font-medium">{studioLabel}'s principles are live in your builds</span>
        <span className="text-muted-foreground">
          {' '}— they layer on top of the Relational Tech principles in every chat and build while you work as a member.
        </span>
      </p>
      <div className="flex flex-wrap gap-1">
        {principles.map(p => (
          <button
            key={p.id}
            onClick={() => setOpenId(openId === p.id ? null : p.id)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              openId === p.id
                ? 'bg-foreground text-background border-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>
      {openId && (() => {
        const p = principles.find(x => x.id === openId);
        if (!p) return null;
        return (
          <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm space-y-1">
            <p className="font-medium">{p.title}</p>
            <div className="prose prose-sm dark:prose-invert max-w-none text-sm text-muted-foreground [&_p]:leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {p.body ?? p.summary ?? ''}
              </ReactMarkdown>
            </div>
          </div>
        );
      })()}
    </section>
  );
}

/** A studio library card — the studio's own shelf, marked private or shared */
function StudioItemCard({
  item, studioLabel, lineage, credit, placeLine, anyBusy, onOpen, onPlan,
}: {
  item: StudioLibraryItem; studioLabel: string; placeLine?: string;
  /** The readable remix chain, when the item grew from something on the shelf */
  lineage?: string | null;
  /** The studio's partnership credit line, when it asks for one */
  credit?: string | null;
  anyBusy: boolean;
  onOpen: () => void; onPlan: () => void;
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
          {item.visibility === 'shared' ? (
            <Library className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <Lock className="size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">
            {studioLabel}
          </span>
          <span className="ml-auto flex gap-1 shrink-0">
            {item.status === 'pending' && (
              <Badge variant="outline" className="text-[9px] text-amber-600 border-amber-600/40">
                awaiting approval
              </Badge>
            )}
            {item.remix_of && <Badge variant="outline" className="text-[9px]">remix</Badge>}
            <Badge variant="outline" className="text-[9px]">{studioKindLabel(item.kind)}</Badge>
          </span>
        </div>
        <button onClick={onOpen} className="font-medium text-[15px] hover:underline text-left leading-snug">
          {item.title}
        </button>
        {item.attribution && (
          <p className="text-xs text-muted-foreground -mt-0.5">{item.attribution}</p>
        )}
        <PlaceLine text={placeLine} />
        {lineage && (
          <p className="text-xs text-muted-foreground flex items-start gap-1 leading-snug">
            <GitBranch className="size-3 shrink-0 mt-0.5" />
            <span>{lineage}</span>
          </p>
        )}
        <p className="text-sm text-muted-foreground line-clamp-4 flex-1">
          {item.summary ?? item.body?.slice(0, 200)}
        </p>
        {credit && (
          <p className="text-[11px] font-medium text-primary/90">{credit}</p>
        )}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 5).map(t => (
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
            <MapIcon className="size-3 mr-1" />
            Build with this
          </Button>
        </div>
      </div>
    </div>
  );
}

function StudioItemDetailDialog({
  item, studioLabel, remixOfTitle, lineage, credit, references, curation, onOpenRef, onPlan, onOpenChange,
}: {
  item: StudioLibraryItem; studioLabel: string; remixOfTitle?: string | null;
  lineage?: string | null; credit?: string | null;
  references: GalleryReference[];
  curation?: ConnectionsCuration;
  onOpenRef: (source: RefSource, id: string) => boolean;
  onPlan: () => void; onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 flex items-center gap-2">
            <span>{item.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {studioKindLabel(item.kind)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {item.image_url && (
          <div className="rounded-lg overflow-hidden border bg-muted">
            <img src={item.image_url} alt={item.title} className="w-full object-contain max-h-[30rem]" />
          </div>
        )}

        {item.summary && <p className="text-sm leading-relaxed">{item.summary}</p>}

        <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            {item.visibility === 'shared' ? <Library className="size-3" /> : <Lock className="size-3" />}
            {studioLabel}
          </p>
          {item.attribution && <p>{item.attribution}</p>}
          {lineage ? (
            <p className="text-muted-foreground text-xs flex items-start gap-1">
              <GitBranch className="size-3 shrink-0 mt-0.5" /> <span>{lineage}</span>
            </p>
          ) : remixOfTitle ? (
            <p className="text-muted-foreground text-xs flex items-center gap-1">
              <GitBranch className="size-3" /> Remixed from "{remixOfTitle}"
            </p>
          ) : null}
          {credit && <p className="text-xs font-medium text-primary/90">{credit}</p>}
          <p className="text-muted-foreground text-xs">
            {item.status === 'pending'
              ? `Offered to ${studioLabel} — waiting for a Studio Admin's approval`
              : item.visibility === 'shared'
                ? `Shared by ${studioLabel} with all builders`
                : `Part of ${studioLabel}'s library — visible to approved members`}
          </p>
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs underline decoration-dotted hover:text-primary"
            >
              <ExternalLink className="size-3" /> Source
            </a>
          )}
        </div>

        {item.body && (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body}</ReactMarkdown>
          </div>
        )}

        <ConnectionsSection
          source="studio"
          id={item.id}
          title={item.title}
          kind={item.kind}
          references={references}
          curation={curation}
          onOpen={onOpenRef}
        />

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" onClick={onPlan}>
            <MapIcon className="size-3.5 mr-1.5" />
            Build with this
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          "Build with this" opens it in Plan mode
          {item.image_url ? ', with the screenshot attached as visual reference' : ''} — the
          whole {studioLabel} library already travels with your builds as an approved member.
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** A community story from the Studio KB — narrative to learn from, not code to remix */
function KBStoryCard({ story, placeLine, onOpen }: { story: Story; placeLine?: string; onOpen: () => void }) {
  return (
    <div className="group border rounded-xl overflow-hidden flex flex-col bg-background hover:border-foreground/25 transition-colors">
      <div className="p-3.5 flex-1 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <ScrollText className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Local Stories</span>
          <Badge variant="outline" className="ml-auto text-[9px] shrink-0">story</Badge>
        </div>
        <button onClick={onOpen} className="font-medium text-[15px] hover:underline text-left leading-snug">
          {story.title ?? 'Community story'}
        </button>
        <p className="text-xs text-muted-foreground -mt-0.5">{story.attribution}</p>
        <PlaceLine text={placeLine} />
        <p className="text-sm text-muted-foreground line-clamp-4 flex-1">{story.story_text}</p>
        <div className="flex gap-1.5 pt-1">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={onOpen}>
            Read the story
          </Button>
        </div>
      </div>
    </div>
  );
}

function KBStoryDetailDialog({
  story, references, curation, onOpenRef, onOpenChange,
}: {
  story: Story;
  references: GalleryReference[];
  curation?: ConnectionsCuration;
  onOpenRef: (source: RefSource, id: string) => boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 flex items-center gap-2">
            <span>{story.title ?? 'Community story'}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">story</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border border-dashed px-3 py-2.5 text-sm space-y-1">
          <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
            <GitBranch className="size-3" /> Attribution
          </p>
          <p>{story.attribution}</p>
          <p className="text-muted-foreground text-xs">
            A story from builders in the relational tech network
          </p>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&_p]:leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {story.full_story_text ?? story.story_text}
          </ReactMarkdown>
        </div>

        <ConnectionsSection
          source="kb_story"
          id={story.id}
          title={story.title ?? 'Community story'}
          kind="story"
          references={references}
          curation={curation}
          onOpen={onOpenRef}
        />
      </DialogContent>
    </Dialog>
  );
}

function ToolCard({
  tool, studioBadges, placeLine, busy, anyBusy, onOpen, onBuild,
}: {
  tool: Tool; studioBadges: StudioBadge[]; placeLine?: string; busy: boolean; anyBusy: boolean;
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
        <PlaceLine text={placeLine} />
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

/** A commons practice card — attribution up front. Practices carry no
 *  screenshot; an open tool shows its real interface when the commons
 *  holds one. */
function RecipeCard({
  card, shelfLabel, placeLine, busy, anyBusy, onOpen, onPlan,
}: {
  card: CommonsCard; shelfLabel?: string; placeLine?: string; busy: boolean; anyBusy: boolean;
  onOpen: () => void; onPlan: () => void;
}) {
  const shelf = shelfFor(card, shelfLabel);
  const ShelfIcon = SHELF_ICONS[shelf.icon];
  // The build day card's button starts the organizer's journey — "Build
  // yours", not "Plan this": the day is the thing being made
  const buildDay = card.source_studio_slug === BUILD_DAY_SHELF;
  const [imgBroken, setImgBroken] = useState(false);
  return (
    <div className="group border rounded-xl overflow-hidden flex flex-col bg-background hover:border-foreground/25 transition-colors">
      {card.image_url && !imgBroken && (
        <button onClick={onOpen} className="block w-full aspect-[16/10] bg-muted overflow-hidden">
          <img
            src={card.image_url}
            alt={card.title}
            loading="lazy"
            onError={() => setImgBroken(true)}
            className="w-full h-full object-cover object-top group-hover:scale-[1.02] transition-transform"
          />
        </button>
      )}
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
        {card.attribution?.source && (
          <p className="text-[11px] text-muted-foreground/70 -mt-1">{card.attribution.source}</p>
        )}
        <PlaceLine text={placeLine} />
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
            {busy ? <Loader2 className="size-3 animate-spin mr-1" /> : buildDay ? <Hammer className="size-3 mr-1" /> : <MapIcon className="size-3 mr-1" />}
            {buildDay ? 'Build yours' : 'Plan this'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function RecipeDetailDialog({
  card, shelfLabel, busy, references, curation, onOpenRef, onPlan, onOpenChange,
}: {
  card: CommonsCard; shelfLabel?: string; busy: boolean;
  references: GalleryReference[];
  curation?: ConnectionsCuration;
  onOpenRef: (source: RefSource, id: string) => boolean;
  onPlan: () => void; onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<CommonsItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const shelf = shelfFor(card, shelfLabel);

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
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6 flex items-center gap-2">
            <span>{card.title}</span>
            <Badge variant="outline" className="text-[10px] shrink-0">{kindLabel(card)}</Badge>
          </DialogTitle>
        </DialogHeader>

        {card.image_url && (
          <div className="rounded-lg overflow-hidden border bg-muted">
            <img src={card.image_url} alt={card.title} className="w-full object-contain max-h-[30rem]" />
          </div>
        )}

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
          {sourceNote ? (
            <p className="text-muted-foreground text-xs">{sourceNote}</p>
          ) : card.attribution?.source ? (
            <p className="text-muted-foreground text-xs">{card.attribution.source}</p>
          ) : null}
          <p className="text-muted-foreground text-xs">
            {isContributed(card)
              ? `Contributed by a builder · ${shelf.label}`
              : `${shelf.label} shelf of the civic commons`}
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

        <ConnectionsSection
          source="commons"
          id={card.slug}
          title={card.title}
          kind={card.kind}
          references={references}
          curation={curation}
          onOpen={onOpenRef}
        />

        <div className="flex flex-wrap gap-2 pt-1">
          <Button size="sm" disabled={busy} onClick={onPlan}>
            {busy ? <Loader2 className="size-3.5 mr-1.5 animate-spin" /> : card.source_studio_slug === BUILD_DAY_SHELF ? <Hammer className="size-3.5 mr-1.5" /> : <MapIcon className="size-3.5 mr-1.5" />}
            {card.source_studio_slug === BUILD_DAY_SHELF ? 'Build your build day' : 'Plan this for your place'}
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
          "Plan this" opens the recipe in Plan mode
          {card.image_url ? ', with the screenshot attached as visual reference' : ''} — you
          adapt it to your neighborhood, and together you decide whether the build is a
          program plan, printable materials, software, or a mix. Attribution travels with it.
        </p>
      </DialogContent>
    </Dialog>
  );
}

function ToolDetailDialog({
  tool, childPrompts, busy, references, curation, onOpenRef, onBuild, onOpenChange,
}: {
  tool: Tool; childPrompts: Prompt[]; busy: boolean;
  references: GalleryReference[];
  curation?: ConnectionsCuration;
  onOpenRef: (source: RefSource, id: string) => boolean;
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
      <DialogContent className="sm:max-w-2xl lg:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="pr-6">{tool.name}</DialogTitle>
        </DialogHeader>

        {screenshots.length > 0 && (
          <div className="space-y-1.5">
            <div className="rounded-lg overflow-hidden border bg-muted">
              <img
                src={screenshots[Math.min(shot, screenshots.length - 1)]}
                alt={tool.name}
                className="w-full object-contain max-h-[30rem]"
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

        <GalleryToolBuilders toolId={tool.id} />

        <ConnectionsSection
          source="kb_tool"
          id={tool.id}
          title={tool.name}
          kind="tool"
          references={references}
          curation={curation}
          onOpen={onOpenRef}
        />

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
            in Plan mode, with the original's screenshots attached as visual reference — answer
            the bracketed questions to shape it for your neighborhood, and the lineage travels
            with it.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
