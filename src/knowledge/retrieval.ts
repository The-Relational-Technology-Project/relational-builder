import { searchCommons, type CommonsSearchResult } from './commons-search';
import { fetchCommonsItemDetail } from './commons-items';

/**
 * Retrieval policy for the RT Commons — the judgment layer between the raw
 * hybrid search and the system prompt.
 *
 * searchCommons() returns whatever the edge function ranks highest, every
 * time, for any message. Left unfiltered that meant "make the header blue"
 * injected eight ~0.52-similarity entries as "Relevant Knowledge" — noise
 * that cost tokens and taught the model to ignore the section. This module
 * decides WHEN to search (not on fix sends or copy changes), WHAT to search
 * (the project's founding ask blended with the current message, so follow-up
 * turns don't retrieve against "any neighbor can post"), and WHAT SURVIVES
 * (a measured relevance floor, mode-aware ranking, full-body excerpts for
 * the strongest hits).
 *
 * The thresholds are empirical, measured against the live corpus (see
 * bench: `npm run bench -- retrieval`): genuine matches score ~0.62–0.73,
 * mid-build edits and off-topic asks top out ~0.53–0.59. Exact-term hits
 * (match 'text'/'both') are a stronger signal than any embedding score and
 * always survive.
 */

/** Semantic-only hits below this are noise, not knowledge. */
export const MIN_SEMANTIC_SIMILARITY = 0.6;

/** Hits at or above this earn a full-body excerpt in the prompt. */
export const DEEPEN_SIMILARITY = 0.65;
export const DEEPEN_COUNT = 3;
export const DEEPEN_EXCERPT_CHARS = 1400;
const DEEPEN_TIMEOUT_MS = 2500;

/** Turns whose text is machinery, not an ask — retrieval sits out. */
const COPY_CHANGE_RE = /^Copy change — this text in the preview:/;
const ELEMENT_POINT_RE = /^About this element in the preview:/;
const PREVIEW_ERROR_RE = /^The live preview is showing this error:/;

export function isMachineTurn(message: string): boolean {
  return (
    COPY_CHANGE_RE.test(message) ||
    ELEMENT_POINT_RE.test(message) ||
    PREVIEW_ERROR_RE.test(message)
  );
}

/** The slice of a chat message topic derivation needs. */
export interface TopicMessage {
  role: 'user' | 'assistant';
  content: string;
  isPlan?: boolean;
  isAuto?: boolean;
  isSync?: boolean;
  isCollabNote?: boolean;
}

/** Plan answers come back as "question → answer" lines — context, not a topic. */
const ANSWER_LINES_RE = /^[^\n]*→/;

const MIN_TOPIC_CHARS = 20;
const TOPIC_CHARS = 500;

/**
 * What this project is ABOUT, derived from the conversation: the latest
 * plan's vision paragraph when one exists (it names the place, the people,
 * and the point better than any single ask), otherwise the first substantive
 * ask. Follow-up turns search this blended with the current message, so
 * "make it so neighbors can claim a seat" retrieves against the whole tool,
 * not six words.
 */
export function deriveTopicQuery(messages: TopicMessage[]): string | null {
  // Newest plan first — a re-plan supersedes the original vision
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant' || !m.isPlan) continue;
    const vision = /##\s*The vision\s*\n+([\s\S]*?)(?=\n##|\n\*\*|$)/i.exec(m.content)?.[1]?.trim();
    if (vision && vision.length >= MIN_TOPIC_CHARS) return vision.slice(0, TOPIC_CHARS);
    break;
  }
  for (const m of messages) {
    if (m.role !== 'user' || m.isAuto || m.isCollabNote) continue;
    const text = m.content.trim();
    if (text.length < MIN_TOPIC_CHARS) continue;
    if (isMachineTurn(text) || ANSWER_LINES_RE.test(text)) continue;
    return text.slice(0, TOPIC_CHARS);
  }
  return null;
}

const QUERY_CHARS = 800;

/** The query actually sent: the topic grounding the current message. */
export function blendQuery(topic: string | null, message: string): string {
  const msg = message.trim().slice(0, TOPIC_CHARS);
  if (!topic || msg.startsWith(topic) || topic.startsWith(msg)) {
    return msg || (topic ?? '');
  }
  return `${topic}\n${msg}`.slice(0, QUERY_CHARS);
}

/**
 * Mode-aware ranking: planning draws best on practice knowledge (recipes,
 * stories, references), building on concrete precedents (prompts, tools).
 * The boost is a tiebreaker between near-equal hits, never a promotion of a
 * weak hit over a strong one — deliberately about half the typical gap
 * between adjacent results.
 */
const PLAN_KIND_BOOST: Record<string, number> = {
  recipe: 0.02, story: 0.02, reference: 0.015, framework: 0.015, methodology: 0.015,
};
const BUILD_KIND_BOOST: Record<string, number> = {
  prompt: 0.02, tool: 0.02, recipe: 0.01,
};

function effectiveScore(r: CommonsSearchResult, mode: 'plan' | 'build'): number {
  // Exact-term matches carry no similarity when text-only; rank them by
  // presence — the edge function already ordered both > semantic > text
  const base = r.similarity ?? (r.match === 'both' ? 0.7 : 0.6);
  const boost = (mode === 'plan' ? PLAN_KIND_BOOST : BUILD_KIND_BOOST)[r.kind] ?? 0;
  return base + boost;
}

/**
 * The filter + rank half of the policy, pure so the bench can run it against
 * recorded search results without touching the network.
 */
export function selectRelevant(
  results: CommonsSearchResult[],
  mode: 'plan' | 'build',
  limit = 8,
): CommonsSearchResult[] {
  return results
    .filter(r =>
      // Exact-term overlap (text/both) is a stronger relevance signal than
      // the embedding score, whatever the similarity says
      r.match === 'text' || r.match === 'both' ||
      (r.similarity ?? 0) >= MIN_SEMANTIC_SIMILARITY,
    )
    .sort((a, b) => effectiveScore(b, mode) - effectiveScore(a, mode))
    .slice(0, limit);
}

/** Attach full-body excerpts to the strongest hits, best-effort and bounded. */
export async function deepenResults(results: CommonsSearchResult[]): Promise<void> {
  const strong = results
    .filter(r => r.match === 'both' || r.match === 'text' || (r.similarity ?? 0) >= DEEPEN_SIMILARITY)
    .slice(0, DEEPEN_COUNT);
  if (strong.length === 0) return;
  const timeout = new Promise<null>(resolve => setTimeout(() => resolve(null), DEEPEN_TIMEOUT_MS));
  await Promise.all(
    strong.map(async r => {
      const detail = await Promise.race([
        fetchCommonsItemDetail(r.slug).catch(() => null),
        timeout,
      ]);
      const body = detail?.body?.trim();
      if (body && body.length > (r.summary?.length ?? 0)) {
        r.body_excerpt = body.slice(0, DEEPEN_EXCERPT_CHARS);
      }
    }),
  );
}

export interface RetrievalOutcome {
  /** Filtered, ranked, deepened — what the prompt gets. Often empty; that is the point. */
  results: CommonsSearchResult[];
  /** The query actually searched, null when retrieval sat out */
  query: string | null;
  /** How many raw hits the floor dropped */
  dropped: number;
  skipped: 'fix-send' | 'machine-turn' | null;
}

export interface RetrievalInput {
  message: string;
  mode: 'plan' | 'build';
  /** Fix sends and continuations are the Builder's machinery — never searched */
  isFixSend: boolean;
  /** Conversation so far, for topic derivation (the new message excluded) */
  messages: TopicMessage[];
}

/** The whole policy, end to end — ChatPanel calls exactly this. */
export async function retrieveCommonsContext(input: RetrievalInput): Promise<RetrievalOutcome> {
  if (input.isFixSend) return { results: [], query: null, dropped: 0, skipped: 'fix-send' };
  if (isMachineTurn(input.message.trim())) {
    return { results: [], query: null, dropped: 0, skipped: 'machine-turn' };
  }

  const topic = deriveTopicQuery(input.messages);
  const query = blendQuery(topic, input.message);
  if (!query) return { results: [], query: null, dropped: 0, skipped: null };

  const raw = await searchCommons(query);
  const results = selectRelevant(raw, input.mode);
  await deepenResults(results);
  return { results, query, dropped: raw.length - results.length, skipped: null };
}

/**
 * Which surfaced entries a finished reply actually drew on, by title match —
 * feeds the "Drew on the commons" chips and the build log, closing the loop
 * between what retrieval offered and what the model used.
 */
export function findMentionedResults(
  replyText: string,
  surfaced: CommonsSearchResult[],
): CommonsSearchResult[] {
  if (!replyText || surfaced.length === 0) return [];
  const haystack = replyText.toLowerCase();
  return surfaced.filter(r => {
    const title = r.title.trim().toLowerCase();
    return title.length >= 5 && haystack.includes(title);
  });
}
