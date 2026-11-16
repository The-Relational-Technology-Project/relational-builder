import { refKey, type RefSource } from './gallery-references';

/**
 * In-line links to gallery entries.
 *
 * A gallery entry (a commons recipe, a studio library item, a KB tool or
 * story) has an address: `/gallery?item=<source>:<id>`. Links in that shape
 * open the entry's card in place — from a chat reply, from another entry's
 * body, from anywhere markdown renders. The address is also a real URL, so
 * it survives a copy-paste into a message to a neighbor.
 *
 * Two ways a link gets into text:
 *  - the model writes it (the prompt hands every surfaced entry its link and
 *    asks for markdown links when it cites one), or
 *  - `linkifyEntries` finds an entry's title in prose after the fact and
 *    wraps it — the safety net for replies that name an entry without the
 *    link, and the whole mechanism for gallery bodies, which were written
 *    by people who never knew the addresses.
 *
 * Pure: no DOM, no stores. `src/components/EntryMarkdown.tsx` renders the
 * links; `src/router.ts` reads the address on arrival.
 */

export const ITEM_PARAM = 'item';
export const GALLERY_PATH = '/gallery';

export interface EntryRef {
  source: RefSource;
  id: string;
}

export interface EntryLinkTarget extends EntryRef {
  title: string;
}

const SOURCES: ReadonlySet<string> = new Set<RefSource>(['kb_tool', 'kb_story', 'commons', 'studio']);

export function entryKey(source: RefSource, id: string): string {
  return refKey(source, id);
}

/** `commons:mutual-aid-pod` → { source, id }; anything else → null */
export function parseEntryKey(key: string | null | undefined): EntryRef | null {
  if (!key) return null;
  const idx = key.indexOf(':');
  if (idx <= 0) return null;
  const source = key.slice(0, idx);
  const id = key.slice(idx + 1).trim();
  if (!SOURCES.has(source) || !id) return null;
  return { source: source as RefSource, id };
}

/** The address of an entry's card: relative, so it works on any host */
export function entryHref(source: RefSource, id: string): string {
  return `${GALLERY_PATH}?${ITEM_PARAM}=${encodeURIComponent(entryKey(source, id))}`;
}

/**
 * Read an entry out of a link's href. Accepts the relative form the Builder
 * writes and an absolute one on any host (a model sometimes writes the full
 * address of the deployed site), so both open in place instead of
 * reloading the app.
 */
export function parseEntryHref(href: string | null | undefined): EntryRef | null {
  if (!href) return null;
  let url: URL;
  try {
    url = new URL(href, 'http://relational-builder.local');
  } catch {
    return null;
  }
  if (url.pathname.replace(/\/+$/, '').toLowerCase() !== GALLERY_PATH) return null;
  return parseEntryKey(url.searchParams.get(ITEM_PARAM));
}

export function isExternalHref(href: string | null | undefined): boolean {
  return !!href && /^(https?:)?\/\//i.test(href);
}

// Stretches of markdown that must never be rewritten: fenced code, inline
// code, links that already exist (their text AND their address), raw
// autolinks, bare URLs, and images.
const PROTECTED_RE =
  /```[\s\S]*?(?:```|$)|~~~[\s\S]*?(?:~~~|$)|`[^`\n]*`|!?\[[^\]\n]*\]\([^)\n]*\)|<https?:\/\/[^>\s]*>|https?:\/\/[^\s)]+/g;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A title as a pattern: whitespace flexible, case-insensitive, whole-word */
function titlePattern(title: string): RegExp | null {
  const words = title.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  const body = words.map(escapeRe).join('\\s+');
  return new RegExp(`(^|[^\\p{L}\\p{N}])(${body})(?![\\p{L}\\p{N}])`, 'iu');
}

/** The forms a title is recognized in: itself, and without a leading kind
 *  prefix ("Build: A Third-Places Map" → "A Third-Places Map") */
function titleForms(title: string): string[] {
  const forms: string[] = [];
  const t = title.trim();
  if (t.length >= MIN_TITLE_CHARS) forms.push(t);
  const bare = t.replace(/^[A-Za-z]+:\s*/, '');
  if (bare !== t && bare.length >= MIN_TITLE_CHARS + 3) forms.push(bare);
  return forms;
}

const MIN_TITLE_CHARS = 5;

/** Whether the text already links to this entry (the address, closed — a
 *  slug that is a prefix of another slug must not count) */
export function hasEntryLink(text: string, source: RefSource, id: string): boolean {
  return new RegExp(`${escapeRe(entryHref(source, id))}[)\\s"]`).test(text);
}

export interface LinkifyResult {
  text: string;
  /** Entries whose link is in the text now — written by the model or added here */
  linked: EntryLinkTarget[];
}

/**
 * Wrap the first mention of each entry's title in a markdown link to its
 * card. Longer titles go first so "Mutual Aid Pod Handbook" is never half
 * eaten by "Mutual Aid Pod". One link per entry: the first mention is the
 * one a reader needs, and a page where every repeat is blue reads like
 * spam. Entries already linked (by the model, or by a previous pass) are
 * left alone and counted as linked.
 */
export function linkifyEntries(markdown: string, entries: EntryLinkTarget[]): LinkifyResult {
  let text = markdown;
  const linked: EntryLinkTarget[] = [];
  const seen = new Set<string>();
  const ordered = [...entries]
    .filter(e => {
      const key = entryKey(e.source, e.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.title.length - a.title.length);

  for (const entry of ordered) {
    const href = entryHref(entry.source, entry.id);
    if (hasEntryLink(text, entry.source, entry.id)) {
      linked.push(entry);
      continue;
    }
    const patterns = titleForms(entry.title).map(titlePattern).filter((p): p is RegExp => !!p);
    if (patterns.length === 0) continue;

    let done = false;
    for (const pattern of patterns) {
      // Walk the prose between protected stretches; the first hit wins
      let cursor = 0;
      let out = '';
      const protectedRe = new RegExp(PROTECTED_RE.source, PROTECTED_RE.flags);
      const segments: { start: number; end: number }[] = [];
      for (const m of text.matchAll(protectedRe)) {
        segments.push({ start: m.index, end: m.index + m[0].length });
      }
      segments.push({ start: text.length, end: text.length });
      for (const seg of segments) {
        const prose = text.slice(cursor, seg.start);
        const hit = pattern.exec(prose);
        if (hit && hit.index !== undefined) {
          const at = hit.index + hit[1].length;
          out += prose.slice(0, at) + `[${hit[2]}](${href})` + prose.slice(at + hit[2].length);
          out += text.slice(seg.start);
          text = out;
          done = true;
          break;
        }
        out += prose + text.slice(seg.start, seg.end);
        cursor = seg.end;
      }
      if (done) break;
    }
    if (done) linked.push(entry);
  }
  return { text, linked };
}

/**
 * Which entries a gallery body may link to. Curated connections always;
 * every other entry only by a title long enough to be unmistakable — a
 * shelf holds hundreds of titles, and one called "Signal" would turn every
 * mention of the word into a link.
 */
export function bodyLinkables(
  all: EntryLinkTarget[],
  connected: EntryLinkTarget[],
  self?: EntryRef,
): EntryLinkTarget[] {
  const selfKey = self ? entryKey(self.source, self.id) : null;
  const out: EntryLinkTarget[] = [];
  const seen = new Set<string>();
  const add = (e: EntryLinkTarget) => {
    const key = entryKey(e.source, e.id);
    if (key === selfKey || seen.has(key)) return;
    seen.add(key);
    out.push(e);
  };
  connected.forEach(add);
  for (const e of all) {
    const words = e.title.trim().split(/\s+/).filter(Boolean);
    if (words.length >= 3 && e.title.trim().length >= 16) add(e);
  }
  return out;
}
