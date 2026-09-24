import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { FileEntry } from '@/project/virtual-fs';
import { artifactName } from '@/project/display-name';

/**
 * A markdown doc as one self-contained HTML page — the readable serif page
 * the Docs tab prints, and the page a doc becomes when it ships with a
 * Share Live demo link. One rendering, so what the room scans is what the
 * builder saw.
 */

/** Print styles for a rendered doc — readable serif page, print-shop friendly. */
export const DOC_PRINT_CSS = `
  @page { margin: 0.75in; }
  body { font: 12pt/1.6 Georgia, 'Times New Roman', serif; color: #1a1a1a; max-width: 42rem; margin: 0 auto; padding: 2rem 1.25rem; }
  h1, h2, h3, h4 { line-height: 1.25; break-after: avoid; }
  h1 { font-size: 22pt; } h2 { font-size: 16pt; margin-top: 1.6em; } h3 { font-size: 13pt; }
  blockquote { border-left: 3px solid #999; margin: 1em 0; padding-left: 1em; color: #444; font-style: italic; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5pt; break-inside: avoid; }
  th, td { border: 1px solid #bbb; padding: 5px 8px; text-align: left; vertical-align: top; }
  code { font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.9em; background: #f2f2f2; padding: 1px 4px; border-radius: 3px; }
  pre { background: #f2f2f2; padding: 10px 12px; border-radius: 4px; overflow-x: auto; break-inside: avoid; }
  pre code { background: none; padding: 0; }
  li { margin: 0.2em 0; }
  hr { border: 0; border-top: 1px solid #bbb; margin: 1.6em 0; }
  a { color: inherit; }
`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** The doc's markdown rendered to HTML (GitHub-flavored), body only. */
export function renderDocBody(doc: FileEntry): string {
  return renderToStaticMarkup(
    createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, doc.content),
  );
}

/** The whole page: title from the doc's own heading, print styles, body. */
export function renderDocHtml(doc: FileEntry): string {
  const title = artifactName(doc.path, doc.content);
  return (
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${DOC_PRINT_CSS}</style></head><body>${renderDocBody(doc)}</body></html>`
  );
}
