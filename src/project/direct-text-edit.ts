/**
 * Direct text edits — fixing a typo shouldn't cost a model call.
 *
 * When the builder points at a piece of copy in the preview and its wording
 * can be found at ONE place in the project source, we can change it with a
 * plain replacement: instant, free, and safe. Anything ambiguous — text
 * rendered from data, wording that appears twice, copy assembled across
 * elements — quietly falls back to the AI path, which was the only path
 * before.
 *
 * The DOM's rendering of text rarely matches the source byte-for-byte:
 * paragraphs wrap across JSX lines, `&amp;` renders as `&`, `{' '}` renders
 * as a space, curly quotes render curly. So matching is *tolerant* — the
 * clicked text is compiled into a regex that accepts those source spellings
 * — and the actual match gives the exact source span to replace.
 */

import { useProjectStore } from '@/store/project-store';
import { isBinaryPath } from './forge/types';

const MAX_TEXT = 400;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Ways source code can spell "a space between these words": literal
 * whitespace (including newlines + indentation), JSX's `{' '}` glue, or a
 * non-breaking space entity.
 */
const GAP = String.raw`(?:\s|\{['"]\s*['"]\}|&nbsp;)+`;

/**
 * Compile rendered text into a regex that matches how source might spell
 * it. Returns null for text too short/long to trust.
 */
function tolerantPattern(text: string): RegExp | null {
  const t = text.trim();
  if (t.length < 3 || t.length > MAX_TEXT) return null;
  let pattern = '';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (/\s/.test(ch)) {
      while (i + 1 < t.length && /\s/.test(t[i + 1])) i++;
      pattern += GAP;
    } else if (ch === '&') pattern += '(?:&amp;|&)';
    else if (ch === "'" || ch === '’') pattern += String.raw`(?:'|’|&apos;|&#39;|&rsquo;)`;
    else if (ch === '‘') pattern += String.raw`(?:‘|'|&lsquo;)`;
    else if (ch === '"' || ch === '“' || ch === '”')
      pattern += String.raw`(?:"|“|”|&quot;|&ldquo;|&rdquo;)`;
    else if (ch === '<') pattern += '(?:&lt;|<)';
    else if (ch === '>') pattern += '(?:&gt;|>)';
    else if (ch === '…') pattern += String.raw`(?:…|\.\.\.|&hellip;)`;
    else if (ch === '—') pattern += String.raw`(?:—|&mdash;)`;
    else if (ch === '–') pattern += String.raw`(?:–|&ndash;)`;
    else pattern += escapeRegExp(ch);
  }
  try {
    return new RegExp(pattern, 'g');
  } catch {
    return null;
  }
}

interface SourceHit {
  path: string;
  start: number;
  end: number;
}

/**
 * Where this rendered text lives in the project — or null when it can't be
 * found at exactly one place (then only the AI can be trusted to find it).
 */
export function locateExactText(text: string): SourceHit | null {
  const re = tolerantPattern(text);
  if (!re) return null;
  const files = useProjectStore.getState().getAllFiles();
  let hit: SourceHit | null = null;
  for (const f of files) {
    if (isBinaryPath(f.path)) continue;
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(f.content)) !== null) {
      if (hit) return null; // second occurrence anywhere → ambiguous
      hit = { path: f.path, start: m.index, end: m.index + m[0].length };
      // Guard against zero-width matches looping forever (shouldn't
      // happen with ≥3 chars of text, but regexes earn paranoia)
      if (m[0].length === 0) re.lastIndex++;
    }
  }
  return hit;
}

/** Characters that may need escaping before landing in source code. */
const RISKY = /[\\'"`<>{}&\n]/;

/**
 * Prepare the new wording for the spot it's landing in, reading the
 * characters around the matched span to tell a string literal from
 * JSX/HTML text. Returns null when the context is too ambiguous to write
 * safely — the caller falls back to the AI.
 */
function fitToContext(source: string, span: SourceHit, text: string): string | null {
  if (!RISKY.test(text)) return text;

  // Nearest non-space character on each side of the span (skipping
  // same-line padding, e.g. `' Welcome '`)
  let p = span.start - 1;
  while (p >= 0 && (source[p] === ' ' || source[p] === '\t')) p--;
  let n = span.end;
  while (n < source.length && (source[n] === ' ' || source[n] === '\t')) n++;
  const prev = p >= 0 ? source[p] : '';
  const next = n < source.length ? source[n] : '';

  // Inside a quoted string literal: `title: 'Welcome home'`
  if (prev === next && (prev === "'" || prev === '"' || prev === '`')) {
    let out = text.replace(/\\/g, '\\\\').replace(new RegExp(prev, 'g'), '\\' + prev);
    if (prev === '`') out = out.replace(/\$\{/g, '\\${');
    else out = out.replace(/\n/g, '\\n');
    return out;
  }

  // JSX/HTML text content: bounded by tags. Entities are valid in both.
  if (prev === '>' || next === '<') {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\{/g, '&#123;')
      .replace(/\}/g, '&#125;')
      .replace(/\n/g, ' ');
  }

  // Prose files take text as-is
  if (/\.(md|mdx|txt)$/i.test(span.path)) return text;

  return null;
}

/**
 * Replace the single occurrence of `originalText` (as rendered) with
 * `newText`. Re-locates at save time, so a build landing between the click
 * and the save can't misplace the edit. Checkpoints first, so the stage
 * strip's undo covers hand edits exactly like AI ones. Returns false when
 * the text can no longer be found safely — callers fall back to the AI path.
 */
export function applyDirectTextEdit(originalText: string, newText: string): boolean {
  const span = locateExactText(originalText);
  if (!span) return false;
  const store = useProjectStore.getState();
  const file = store.getFile(span.path);
  if (!file) return false;
  const replacement = fitToContext(file.content, span, newText.trim());
  if (replacement === null) return false;
  store.takeCheckpoint('Before text edit');
  store.writeFile(span.path, file.content.slice(0, span.start) + replacement + file.content.slice(span.end));
  return true;
}
