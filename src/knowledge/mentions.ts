import { builderClient } from '@/cloud/builder-client';
import { useCloudStore } from '@/store/cloud-store';
import { useChatStore } from '@/store/chat-store';
import { listCommunitySites } from '@/project/community-sites';
import { fetchCommonsItemDetail } from '@/knowledge/commons-items';
import type { CommonsSearchResult } from '@/knowledge/commons-search';
import { DEEPEN_EXCERPT_CHARS } from '@/knowledge/retrieval';

/**
 * @ mentions — reference your other apps, or a commons entry the chat has
 * drawn on, in a message (Dyad-style). Typing @ in the input offers your
 * cloud projects, live sites, and the commons entries surfaced so far;
 * mentions resolve at send time into context the AI can actually use: a
 * project's files (truncated), a site's identity and URL, or a commons
 * entry's full text pinned into the Relevant Knowledge section.
 */

export interface Mentionable {
  kind: 'project' | 'site' | 'commons';
  /** Project id, site slug, or commons slug */
  id: string;
  name: string;
}

/** A commons entry a reply drew on — what the chips under a reply carry */
export interface CommonsRef {
  slug: string;
  title: string;
  kind: string;
}

/**
 * The drag payload for a commons chip. Dropping one on the composer inserts
 * the @[Title] mention; a text/plain twin rides along so a drop on any
 * ordinary text field still lands as the same token.
 */
export const COMMONS_REF_DRAG_TYPE = 'application/x-rb-commons-ref';

export function mentionToken(name: string): string {
  return `@[${name}]`;
}

export function commonsRefFromDrag(dt: DataTransfer): CommonsRef | null {
  const raw = dt.getData(COMMONS_REF_DRAG_TYPE);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CommonsRef>;
    if (typeof parsed.slug === 'string' && typeof parsed.title === 'string') {
      return { slug: parsed.slug, title: parsed.title, kind: parsed.kind ?? 'entry' };
    }
  } catch {
    // not ours
  }
  return null;
}

const MAX_MENTIONS = 2;
const MAX_FILE_CHARS = 2000;
const MAX_TOTAL_CHARS = 10000;
const PIN_TIMEOUT_MS = 2500;

let sitesCache: Mentionable[] | null = null;

/**
 * The commons entries this conversation's replies have drawn on, newest
 * first — the chips a person can drag. Read from the messages themselves
 * rather than a side registry, so a reloaded chat still knows them.
 */
export function surfacedCommonsRefs(): CommonsRef[] {
  const seen = new Set<string>();
  const refs: CommonsRef[] = [];
  const messages = useChatStore.getState().messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    for (const r of messages[i].commonsRefs ?? []) {
      if (seen.has(r.slug)) continue;
      seen.add(r.slug);
      refs.push(r);
    }
  }
  return refs;
}

const commonsMentionable = (r: CommonsRef): Mentionable => ({ kind: 'commons', id: r.slug, name: r.title });

/** Everything the builder can @-mention (projects live in the store; sites fetched once) */
export async function listMentionables(): Promise<Mentionable[]> {
  // The project list normally loads with the dashboard — refresh it here so
  // mentions work even when the session opened straight into a chat
  if (useCloudStore.getState().projects.length === 0) {
    await useCloudStore.getState().refreshProjects();
  }
  const projects: Mentionable[] = useCloudStore.getState().projects.map(p => ({
    kind: 'project' as const,
    id: p.id,
    name: p.name,
  }));

  if (sitesCache === null) {
    try {
      sitesCache = (await listCommunitySites()).map(s => ({
        kind: 'site' as const,
        id: s.slug,
        name: s.name,
      }));
    } catch {
      sitesCache = [];
    }
  }

  // Projects first, then sites, then the commons; a later entry that
  // duplicates an earlier name steps aside so a token resolves one way
  const out: Mentionable[] = [];
  const seen = new Set<string>();
  for (const m of [...projects, ...sitesCache, ...surfacedCommonsRefs().map(commonsMentionable)]) {
    const key = m.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

/** Invalidate the sites cache (e.g. after publishing) */
export function clearMentionablesCache() {
  sitesCache = null;
}

/** Find @[Name] tokens that match known mentionables */
export function parseMentions(text: string, candidates: Mentionable[]): Mentionable[] {
  const tokens = [...text.matchAll(/@\[([^\]]{1,80})\]/g)].map(m => m[1].trim().toLowerCase());
  if (tokens.length === 0) return [];
  const found: Mentionable[] = [];
  for (const token of tokens) {
    const match = candidates.find(c => c.name.toLowerCase() === token);
    if (match && !found.some(f => f.kind === match.kind && f.id === match.id)) {
      found.push(match);
    }
  }
  return found.slice(0, MAX_MENTIONS);
}

/**
 * The commons entries a message names by @[Title], shaped as search results
 * so they ride the same Relevant Knowledge section retrieval fills and count
 * in the same provenance (chips, build log). A person pointing at an entry
 * outranks any similarity score, so each carries the strongest match and
 * its full text — best-effort and bounded, like retrieval's own deepening.
 */
export async function pinnedCommonsEntries(text: string): Promise<CommonsSearchResult[]> {
  if (!text.includes('@[')) return [];
  const refs = surfacedCommonsRefs();
  const mentions = parseMentions(text, refs.map(commonsMentionable));
  if (mentions.length === 0) return [];

  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), PIN_TIMEOUT_MS);
  const pinned = await Promise.all(
    mentions.map(async (m): Promise<CommonsSearchResult> => {
      const ref = refs.find(r => r.slug === m.id)!;
      const detail = await fetchCommonsItemDetail(ref.slug, controller.signal).catch(() => null);
      const body = detail?.body?.trim();
      return {
        id: detail?.id ?? ref.slug,
        slug: ref.slug,
        kind: detail?.kind ?? ref.kind,
        title: detail?.title ?? ref.title,
        summary: detail?.summary ?? null,
        attribution: detail?.attribution ?? null,
        source_studio_slug: detail?.source_studio_slug ?? null,
        tags: detail?.tags ?? null,
        similarity: 1,
        match: 'both',
        ...(body ? { body_excerpt: body.slice(0, DEEPEN_EXCERPT_CHARS) } : {}),
      };
    }),
  );
  clearTimeout(deadline);
  return pinned;
}

/** Resolve mentions in a message into prompt-ready context sections */
export async function buildMentionContext(text: string): Promise<string[]> {
  if (!text.includes('@[')) return [];
  const candidates = await listMentionables();
  const mentions = parseMentions(text, candidates);

  const sections: string[] = [];
  for (const mention of mentions) {
    if (mention.kind === 'site') {
      sections.push(
        [
          `## Referenced Site: ${mention.name}`,
          '',
          `The builder mentioned their live community-hosted site "${mention.name}" (https://relationalbuilder.org/s/${mention.id}/). Treat it as prior art of theirs — match or borrow from it as they ask.`,
        ].join('\n'),
      );
      continue;
    }

    if (mention.kind === 'commons') {
      // The entry itself travels in Relevant Knowledge (see
      // pinnedCommonsEntries); this names the intent behind it
      sections.push(
        [
          `## Referenced Commons Entry: ${mention.name}`,
          '',
          `The builder pointed at "${mention.name}" directly — an entry from the RT Commons that an earlier reply drew on, carried into this message on purpose. It is listed under Relevant Knowledge with its text. Treat it as the pattern this ask should build on, and say plainly which parts of it you're borrowing.`,
        ].join('\n'),
      );
      continue;
    }

    // Project → pull its files read-only
    if (!builderClient) continue;
    const { data } = await builderClient
      .from('projects')
      .select('name, files')
      .eq('id', mention.id)
      .maybeSingle();
    const files = (data?.files ?? []) as { path: string; content: string }[];
    if (files.length === 0) continue;

    const parts = [
      `## Referenced Project: ${data!.name}`,
      '',
      'The builder mentioned another project of theirs. These are its files (read-only context — do NOT recreate this project; borrow patterns, styles, or pieces as the builder asks):',
      '',
    ];
    let budget = MAX_TOTAL_CHARS;
    for (const file of files) {
      if (budget <= 0) {
        parts.push(`- ${file.path} (omitted)`);
        continue;
      }
      let body = file.content;
      if (body.length > MAX_FILE_CHARS) {
        body = body.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
      }
      budget -= body.length;
      parts.push(`### ${file.path}`, '```', body, '```', '');
    }
    sections.push(parts.join('\n'));
  }
  return sections;
}
