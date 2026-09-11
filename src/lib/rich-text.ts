/**
 * Bodies that arrive as HTML, in a world that expects Markdown.
 *
 * Commons entries are authored as Markdown — except the field-guide
 * stories, which came across from the Studio site as HTML: `<p>` paragraphs,
 * an `<em>` book title, a handful of `<img>`s. Both of our readers handle
 * that badly, in the same way: the server-rendered commons pages escape
 * everything before rendering, and react-markdown escapes raw HTML rather
 * than rendering it. Either way the reader gets `<p>` as words on the page
 * instead of paragraphs.
 *
 * Rather than teach every reader about HTML, bodies are normalized once
 * where they are read — so the public pages, the gallery dialogs, and the
 * excerpts that ride into prompts all see one format.
 *
 * Deliberately small: a regex pass over the tags that actually appear, not
 * a parser. Anything it doesn't know loses its tags and keeps its words,
 * which is the right way for this to fail.
 */

export interface RichTextOptions {
  /** Site-relative assets (`/images/…`) need an origin to resolve against. */
  resolveUrl?: (url: string) => string;
}

/**
 * A closing tag or a void tag — so a `<div>` merely *named* in prose reads
 * as prose, and a fenced block (which is showing markup, not using it) is
 * left alone entirely.
 */
const HTML_MARKUP =
  /<\/(?:p|div|section|article|figure|figcaption|h[1-6]|ul|ol|li|blockquote|table|tr|td|th|pre|strong|b|em|i|a|code|span|small)\s*>|<(?:br|hr|img)\b[^>]*\/?>/i;

export function looksLikeHtml(text: string): boolean {
  if (!text) return false;
  if (text.includes('```')) return false;
  return HTML_MARKUP.test(text);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  nbsp: ' ', ensp: ' ', emsp: ' ', thinsp: ' ', shy: '',
  mdash: '—', ndash: '–', hellip: '…', bull: '•', middot: '·',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
  laquo: '«', raquo: '»', deg: '°', times: '×', frac12: '½',
  copy: '©', reg: '®', trade: '™',
};

/** One pass, so `&amp;lt;` decodes to `&lt;` and stops there. */
function decodeEntities(s: string): string {
  return s.replace(/&(#\d{1,7}|#[xX][0-9a-fA-F]{1,6}|[a-zA-Z][a-zA-Z0-9]{1,9});/g, (whole, body: string) => {
    if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    const code = body[1] === 'x' || body[1] === 'X'
      ? parseInt(body.slice(2), 16)
      : Number(body.slice(1));
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
  });
}

function attr(attrs: string, name: string): string | null {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i'));
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

const stripTags = (s: string): string => s.replace(/<\/?[a-zA-Z][^>]*>/g, '');

/** Tag-free, whitespace-collapsed text — for anything that must stay on one line. */
const oneLine = (s: string): string => decodeEntities(stripTags(s)).replace(/\s+/g, ' ').trim();

export function htmlToMarkdown(html: string, options: RichTextOptions = {}): string {
  const resolve = options.resolveUrl ?? ((url: string) => url);
  let s = html.replace(/\r\n?/g, '\n');

  s = s.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');

  // Media and links carry attributes, so they are read before any stripping.
  s = s.replace(/<img\b([^>]*)>/gi, (_, a: string) => {
    const src = attr(a, 'src');
    return src ? `\n\n![${oneLine(attr(a, 'alt') ?? '')}](${resolve(src)})\n\n` : '';
  });
  s = s.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, a: string, inner: string) => {
    const text = inner.trim();
    const href = attr(a, 'href');
    if (!text) return '';
    return href ? `[${text}](${resolve(href)})` : text;
  });

  // Inline emphasis maps straight across.
  s = s.replace(/<\/?(?:strong|b)\b[^>]*>/gi, '**');
  s = s.replace(/<\/?(?:em|i)\b[^>]*>/gi, '*');
  s = s.replace(/<\/?code\b[^>]*>/gi, '`');

  // The page already owns its <h1>, and the commons renderer reads `##`–`####`.
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level: string, inner: string) =>
    `\n\n${'#'.repeat(Math.min(Math.max(Number(level), 2), 4))} ${oneLine(inner)}\n\n`);

  // Ordered lists keep their numbering; every other list item becomes a dash.
  s = s.replace(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi, (_, inner: string) => {
    let n = 0;
    const items = inner.replace(
      /<li\b[^>]*>([\s\S]*?)<\/li>/gi,
      (__, item: string) => `${++n}. ${oneLine(item)}\n`,
    );
    return `\n\n${items}\n`;
  });
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, item: string) => `- ${oneLine(item)}\n`);

  s = s.replace(/<br\b[^>]*>/gi, '\n');
  s = s.replace(/<hr\b[^>]*>/gi, '\n\n---\n\n');
  s = s.replace(/<\/?(?:p|div|section|article|figure|figcaption|ul|ol|table|tr|pre)\b[^>]*>/gi, '\n\n');

  // Blockquotes last: by now their innards are plain lines.
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, inner: string) => {
    const lines = decodeEntities(stripTags(inner)).split('\n').map(l => l.trim()).filter(Boolean);
    return lines.length ? `\n\n${lines.map(l => `> ${l}`).join('\n>\n')}\n\n` : '\n\n';
  });

  return decodeEntities(stripTags(s))
    .split('\n')
    .map(line => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Markdown in, Markdown out; HTML in, Markdown out. Safe on anything. */
export function toMarkdown(text: string, options: RichTextOptions = {}): string {
  if (!text) return '';
  return looksLikeHtml(text) ? htmlToMarkdown(text, options) : text;
}

/**
 * One line of prose, with both HTML and Markdown syntax spent — for meta
 * descriptions, card blurbs, and anywhere a body gets truncated.
 */
export function toPlainText(text: string | null | undefined, options: RichTextOptions = {}): string {
  if (!text) return '';
  return toMarkdown(text, options)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s{0,3}[-*]\s+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_](\S(?:.*?\S)?)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/`+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
