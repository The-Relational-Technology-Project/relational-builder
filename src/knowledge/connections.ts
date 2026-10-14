import { builderClient } from '@/cloud/builder-client';

/**
 * Client for the connect edge function — the Builder's relational layer.
 * Directory of opted-in builders (never exposes emails) + double-opt-in
 * connection requests.
 */

export interface DirectoryBuilder {
  id: string;
  name: string;
  neighborhood: string | null;
  note: string | null;
  cal_link: string | null;
  allow_requests: boolean;
  /** The event code they joined through, if any — same-event peers are
   *  suggested to each other more readily */
  event_code?: string | null;
  /** A steward or Event Admin — running the room, not necessarily in it,
   *  so never raised as an event-day introduction */
  host?: boolean;
  /** Prompts this builder has shared — seeds you can grow from */
  prompts?: { title: string; slug: string }[];
  /** Their public builder page, when they've published one */
  profile_url?: string | null;
  /** What that page says (practice, technologies, ideas, dreams) — public
   *  already, so it can feed intro matching alongside the note */
  page_text?: string | null;
  /** The kinds of thing they're building — a domain frame (a gathering
   *  fund, civic media) plus the project's name. Two builders on the same
   *  kind of project are introduced on that alone. */
  builds?: { frame: string; name: string }[];
}

/** Frames worth an introduction on their own, and how a card names them */
export const SHARED_FRAME_LABELS: Record<string, string> = {
  microgrants: 'a gathering fund',
  'civic-media': 'civic media',
};

export interface ConnectionMatch {
  builder: DirectoryBuilder;
  matched: string[];
  sameEvent: boolean;
  /** The frame both are building in, when that's what raised them */
  sharedFrame?: string;
}

async function call(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first');
  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((result as { error?: string }).error ?? `Request failed (${res.status})`);
  return result as Record<string, unknown>;
}

export async function fetchDirectory(): Promise<DirectoryBuilder[]> {
  const result = await call({ action: 'directory' });
  return (result.builders as DirectoryBuilder[]) ?? [];
}

let directoryCache: DirectoryBuilder[] | null = null;

/** Cached directory for lightweight surfaces (chat suggestions) */
export async function fetchDirectoryCached(): Promise<DirectoryBuilder[]> {
  if (directoryCache === null) {
    try {
      directoryCache = await fetchDirectory();
    } catch {
      directoryCache = [];
    }
  }
  return directoryCache;
}

/**
 * Words that say nothing about what someone is actually working on. A match
 * has to rest on content, not filler: "Open to all styles of on or off line
 * communication" once raised a builder for "open, styles, and line". Listed
 * in singular form; tokens are stemmed of a trailing "s" before the check.
 */
const STOP_WORDS = new Set([
  // the Builder's own vocabulary — every conversation here has these
  'happy', 'talk', 'talking', 'build', 'builds', 'building', 'builder', 'builders',
  'help', 'helping', 'community', 'neighborhood', 'neighbor', 'neighbors', 'local',
  'people', 'project', 'tool', 'idea', 'website', 'site', 'page', 'user',
  'connect', 'connecting', 'connection', 'collaboration', 'collaborate',
  'communication', 'communicate', 'together', 'share', 'sharing', 'support',
  'create', 'creating', 'group', 'team', 'member', 'space', 'design', 'system',
  'online', 'offline', 'line', 'digital', 'tech', 'technology', 'relational',
  // generic English
  'with', 'about', 'love', 'would', 'like', 'that', 'this', 'thing', 'make',
  'making', 'want', 'from', 'your', 'their', 'them', 'have', 'been', 'also',
  'open', 'style', 'kind', 'type', 'sort', 'other', 'some', 'many', 'more',
  'most', 'much', 'very', 'really', 'just', 'only', 'even', 'well', 'still',
  'every', 'each', 'both', 'such', 'what', 'when', 'where', 'which', 'while',
  'will', 'there', 'here', 'these', 'those', 'then', 'than', 'they', 'were',
  'into', 'onto', 'over', 'through', 'around', 'across', 'between', 'after',
  'before', 'during', 'without', 'within', 'toward', 'towards', 'under',
  'good', 'great', 'best', 'better', 'new', 'different', 'small', 'little',
  'big', 'simple', 'easy', 'able', 'sure', 'first', 'last', 'next', 'same',
  'time', 'year', 'week', 'today', 'way', 'part', 'place', 'world', 'life',
  'work', 'working', 'need', 'know', 'think', 'feel', 'look', 'looking',
  'keep', 'give', 'take', 'come', 'going', 'doing', 'does', 'done', 'made',
  'being', 'back', 'start', 'starting', 'find', 'using', 'used', 'something',
  'anything', 'everything', 'someone', 'anyone', 'everyone', 'interested',
  'interest', 'excited', 'passionate', 'curious', 'focus', 'focused',
  'please', 'thank', 'thanks', 'maybe', 'could', 'should', 'might', 'let',
  'yes', 'okay', 'right', 'lot', 'lots', 'add', 'adding', 'show',
]);

/** Words in a place name that don't place anyone: "Outer" Sunset, "North" Beach */
const GENERIC_PLACE_WORDS = new Set([
  'north', 'south', 'east', 'west', 'outer', 'inner', 'upper', 'lower',
  'central', 'downtown', 'uptown', 'midtown', 'city', 'town', 'county',
  'district', 'area', 'side', 'heights', 'village', 'valley', 'hill',
  'park', 'beach', 'point', 'lake', 'river', 'saint', 'fort', 'mount',
]);

function meaningfulTokens(text: string): string[] {
  return [...new Set(
    text.toLowerCase().split(/[^a-z]+/)
      .map(w => w.replace(/s$/, ''))
      .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !STOP_WORDS.has(w + 's')),
  )];
}

function placeTokens(neighborhood: string | null | undefined): string[] {
  return meaningfulTokens(neighborhood ?? '').filter(t => !GENERIC_PLACE_WORDS.has(t));
}

function builderText(b: DirectoryBuilder): string {
  return `${b.note ?? ''} ${b.page_text ?? ''}`;
}

/**
 * Words too many builders use to tell any one of them apart. With a big
 * enough directory, a word in more than a fifth of everyone's notes is
 * the community's shared vocabulary, not a reason to introduce two people.
 */
function commonAcrossDirectory(builders: DirectoryBuilder[]): Set<string> {
  if (builders.length < 10) return new Set();
  const counts = new Map<string, number>();
  for (const b of builders) {
    for (const t of meaningfulTokens(builderText(b))) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const limit = Math.max(3, builders.length * 0.2);
  return new Set([...counts].filter(([, n]) => n > limit).map(([t]) => t));
}

/**
 * Suggest at most one builder whose note/place genuinely overlaps with what
 * this conversation is about. Deterministic and local — no model call, no
 * data leaves the page. Returns null when nothing clears the bar, which is
 * most of the time by design.
 *
 * When the person is at an event (selfEventCode), builders from the same
 * event clear a lower bar and win ties: you're already in the same room on
 * purpose, so one genuine topical overlap is reason enough to say
 * "go find them". Hosts (stewards, Event Admins) sit this out entirely
 * while the person is at an event: a steward who set the room up may be
 * hundreds of miles from it, and "go find them" would send someone looking.
 */
export function suggestConnection(
  conversationText: string,
  builders: DirectoryBuilder[],
  excludeIds: Set<string>,
  selfEventCode?: string | null,
  selfFrames: readonly string[] = [],
): ConnectionMatch | null {
  const convo = new Set(meaningfulTokens(conversationText));
  const myFrames = new Set(selfFrames.filter(f => f in SHARED_FRAME_LABELS));
  if (convo.size === 0 && myFrames.size === 0) return null;

  const common = commonAcrossDirectory(builders);
  let best: ConnectionMatch | null = null;
  let bestScore = 0;
  for (const b of builders) {
    if (excludeIds.has(b.id)) continue;
    if (selfEventCode && b.host) continue;
    // Building the same kind of thing: a gathering fund organizer meets
    // another gathering fund organizer, whatever their notes say
    const sharedFrame = (b.builds ?? []).find(x => myFrames.has(x.frame))?.frame;
    if (!b.note && !b.neighborhood && !b.page_text && !sharedFrame) continue;
    const sameEvent =
      !!selfEventCode && !!b.event_code &&
      b.event_code.toUpperCase() === selfEventCode.toUpperCase();
    // Topical text: the connect note, plus the builder's published page
    const placeMatches = placeTokens(b.neighborhood).filter(t => convo.has(t));
    const noteMatches = meaningfulTokens(builderText(b))
      .filter(t => convo.has(t) && !common.has(t) && !placeMatches.includes(t));
    const matched = [...new Set([...noteMatches, ...placeMatches])];
    // Bar: two topical matches, or one topical + a place match — or one
    // topical match when you're both at the same event
    const clears =
      !!sharedFrame ||
      noteMatches.length >= 2 ||
      (noteMatches.length >= 1 && placeMatches.length >= 1) ||
      (sameEvent && noteMatches.length >= 1);
    // Same-event peers outrank everyone: the introduction can happen today.
    // A shared kind of project outranks word overlap; a place match on top
    // of it wins among those.
    const score = matched.length + (sharedFrame ? 50 : 0) + (sameEvent ? 100 : 0);
    if (clears && (!best || score > bestScore)) {
      best = { builder: b, matched, sameEvent, sharedFrame };
      bestScore = score;
    }
  }
  return best;
}

/**
 * One plain sentence on why a builder was raised — built from the same
 * overlap the match was scored on, so it is always true of the match and
 * never a model's flourish. Reads like a person explaining: "You've both
 * been writing about mutual aid and food, and you're both in the Sunset."
 */
export function explainMatch(
  builder: DirectoryBuilder,
  matched: string[],
  sameEvent: boolean,
  sharedFrame?: string,
): string {
  const place = placeTokens(builder.neighborhood);
  // Tokens are stemmed for matching ("libraries" → "librarie"); surface the
  // word as the builder actually wrote it so the sentence reads like one
  const surface = builderText(builder).toLowerCase().split(/[^a-z]+/);
  const topics = matched
    .filter(t => !place.includes(t))
    .slice(0, 3)
    .map(t => surface.find(w => w === t || w === `${t}s` || w === `${t}es`) ?? t);
  const sharedPlace = matched.some(t => place.includes(t));
  const parts: string[] = [];
  if (sharedFrame && SHARED_FRAME_LABELS[sharedFrame]) {
    const theirs = (builder.builds ?? []).filter(x => x.frame === sharedFrame && x.name).map(x => x.name);
    parts.push(
      theirs.length > 0
        ? `you're both building ${SHARED_FRAME_LABELS[sharedFrame]} — theirs is ${listWords(theirs.slice(0, 2))}`
        : `you're both building ${SHARED_FRAME_LABELS[sharedFrame]}`,
    );
  }
  if (topics.length > 0) parts.push(`you've both been writing about ${listWords(topics)}`);
  if (sharedPlace && builder.neighborhood) parts.push(`you're both around ${builder.neighborhood}`);
  if (sameEvent) parts.push(sharedPlace || topics.length ? "you're at the same event today" : `you're both at this event and ${builder.name} is working on something close by`);
  if (parts.length === 0) return `Their note overlaps with what you're building.`;
  const sentence = parts.join(', and ');
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.';
}

function listWords(words: string[]): string {
  if (words.length <= 1) return words.join('');
  if (words.length === 2) return `${words[0]} and ${words[1]}`;
  return `${words.slice(0, -1).join(', ')}, and ${words[words.length - 1]}`;
}

export async function requestConnection(toId: string, message: string): Promise<void> {
  await call({ action: 'request', to_id: toId, message });
}

/** A pending request addressed to the signed-in builder — exactly what the
 *  notification email carries (name + note); the sender's address stays
 *  private until they accept. */
export interface ConnectionRequest {
  id: string;
  from_name: string | null;
  message: string | null;
  created_at: string;
}

export async function fetchConnectionInbox(): Promise<ConnectionRequest[]> {
  const result = await call({ action: 'inbox' });
  return (result.requests as ConnectionRequest[]) ?? [];
}

export async function respondToConnection(id: string, decision: 'accept' | 'decline'): Promise<void> {
  await call({ action: 'respond', id, decision });
}
