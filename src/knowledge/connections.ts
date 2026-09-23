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
  /** Prompts this builder has shared — seeds you can grow from */
  prompts?: { title: string; slug: string }[];
  /** Their public builder page, when they've published one */
  profile_url?: string | null;
  /** What that page says (practice, technologies, ideas, dreams) — public
   *  already, so it can feed intro matching alongside the note */
  page_text?: string | null;
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

const STOP_WORDS = new Set([
  'happy', 'talk', 'talking', 'build', 'builds', 'building', 'builder', 'builders',
  'help', 'helping', 'with', 'about', 'love', 'would', 'like', 'that', 'this',
  'community', 'neighborhood', 'neighbors', 'local', 'people', 'things', 'make',
  'making', 'want', 'from', 'your', 'their', 'them', 'have', 'been', 'also',
]);

function meaningfulTokens(text: string): string[] {
  return [...new Set(
    text.toLowerCase().split(/[^a-z]+/)
      .map(w => w.replace(/s$/, ''))
      .filter(w => w.length > 3 && !STOP_WORDS.has(w) && !STOP_WORDS.has(w + 's')),
  )];
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
 * "go find them".
 */
export function suggestConnection(
  conversationText: string,
  builders: DirectoryBuilder[],
  excludeIds: Set<string>,
  selfEventCode?: string | null,
): { builder: DirectoryBuilder; matched: string[]; sameEvent: boolean } | null {
  const convo = new Set(meaningfulTokens(conversationText));
  if (convo.size === 0) return null;

  let best: { builder: DirectoryBuilder; matched: string[]; sameEvent: boolean } | null = null;
  let bestScore = 0;
  for (const b of builders) {
    if (excludeIds.has(b.id)) continue;
    if (!b.note && !b.neighborhood && !b.page_text) continue;
    const sameEvent =
      !!selfEventCode && !!b.event_code &&
      b.event_code.toUpperCase() === selfEventCode.toUpperCase();
    // Topical text: the connect note, plus the builder's published page
    const noteMatches = [...new Set(meaningfulTokens(`${b.note ?? ''} ${b.page_text ?? ''}`))].filter(t => convo.has(t));
    const placeMatches = meaningfulTokens(b.neighborhood ?? '').filter(t => convo.has(t));
    const matched = [...new Set([...noteMatches, ...placeMatches])];
    // Bar: two topical matches, or one topical + a place match — or one
    // topical match when you're both at the same event
    const clears =
      noteMatches.length >= 2 ||
      (noteMatches.length >= 1 && placeMatches.length >= 1) ||
      (sameEvent && noteMatches.length >= 1);
    // Same-event peers outrank everyone: the introduction can happen today
    const score = matched.length + (sameEvent ? 100 : 0);
    if (clears && (!best || score > bestScore)) {
      best = { builder: b, matched, sameEvent };
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
): string {
  const place = meaningfulTokens(builder.neighborhood ?? '');
  // Tokens are stemmed for matching ("libraries" → "librarie"); surface the
  // word as the builder actually wrote it so the sentence reads like one
  const surface = (`${builder.note ?? ''} ${builder.page_text ?? ''}`).toLowerCase().split(/[^a-z]+/);
  const topics = matched
    .filter(t => !place.includes(t))
    .slice(0, 3)
    .map(t => surface.find(w => w === t || w === `${t}s` || w === `${t}es`) ?? t);
  const sharedPlace = matched.some(t => place.includes(t));
  const parts: string[] = [];
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
