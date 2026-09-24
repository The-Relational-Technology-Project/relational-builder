import type { FileEntry } from '@/project/virtual-fs';
import { artifactDisplay } from '@/project/display-name';
import { buildStandaloneHtml } from '@/preview/standalone';
import { renderDocHtml } from '@/preview/doc-html';
import { SCREENSHOT_SOURCE, captureFromIframe } from '@/preview/screenshot';

/**
 * What a project can put in front of a room. A build is often more than an
 * app: a flyer beside it, a plan behind it, sometimes paper and no app at
 * all. Share Live lists these by their friendly names, lets the builder
 * tick the ones the room should see, and gives each its own slide.
 *
 *   app      — the running thing (index.html or a /src entry)
 *   material — a standalone HTML page: flyer, sign-up sheet, info card
 *   doc      — a markdown doc: plan, guide, notes
 *
 * The same three the preview's output tabs offer, in the same order.
 */

export type ShareArtifactKind = 'app' | 'material' | 'doc';

export interface ShareArtifact {
  /** Stable key for selection state — the path, or "app" */
  id: string;
  kind: ShareArtifactKind;
  /** The file, for materials and docs; null for the app */
  path: string | null;
  /** "Garden Flyer", "Outreach Plan", or the project's name for the app */
  name: string;
  /** "The app", "Printable page", "Written doc" */
  kindLabel: string;
}

const strip = (p: string) => p.replace(/^\//, '');

export function hasAppEntry(files: FileEntry[]): boolean {
  return files.some(f => /\.([jt]sx?)$/i.test(f.path) || strip(f.path) === 'index.html');
}

/** Every shareable artifact in the project: app first, then materials, then docs */
export function listShareArtifacts(files: FileEntry[], projectName: string): ShareArtifact[] {
  const out: ShareArtifact[] = [];
  if (hasAppEntry(files)) {
    out.push({ id: 'app', kind: 'app', path: null, name: projectName, kindLabel: 'The app' });
  }
  for (const f of files) {
    if (/\.html?$/i.test(f.path) && strip(f.path) !== 'index.html') {
      const d = artifactDisplay(f.path, f.content);
      out.push({ id: f.path, kind: 'material', path: f.path, name: d.name, kindLabel: d.kindLabel });
    }
  }
  for (const f of files) {
    if (/\.md$/i.test(f.path)) {
      const d = artifactDisplay(f.path, f.content);
      out.push({ id: f.path, kind: 'doc', path: f.path, name: d.name, kindLabel: d.kindLabel });
    }
  }
  return out;
}

/** The self-contained page for a material or doc — what a screenshot and
 *  a demo link both show. Null for the app (it renders in the preview). */
export function renderArtifactHtml(files: FileEntry[], artifact: ShareArtifact): string | null {
  if (!artifact.path) return null;
  const file = files.find(f => f.path === artifact.path);
  if (!file) return null;
  if (artifact.kind === 'doc') return renderDocHtml(file);
  return buildStandaloneHtml(files, artifact.path) ?? file.content;
}

/** Where a doc's rendered page lives on the demo site: plan.md → plan.html */
export function docPagePath(path: string): string {
  return path.replace(/\.md$/i, '.html');
}

/** The path a material or doc has on the published demo site, relative to its root */
export function artifactSitePath(artifact: ShareArtifact): string {
  if (!artifact.path) return '';
  return strip(artifact.kind === 'doc' ? docPagePath(artifact.path) : artifact.path);
}

/**
 * Screenshot a standalone page without showing it: an offscreen iframe
 * carrying the same capture script the preview engines inject, asked the
 * same way. Null when the page never loads or the capture fails — the
 * slide just goes without a picture.
 */
export async function captureHtmlScreenshot(html: string): Promise<string | null> {
  if (typeof document === 'undefined') return null;
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;left:-12000px;top:0;width:1100px;height:800px;border:0;visibility:hidden;pointer-events:none';
  const shotTag = `<script>${SCREENSHOT_SOURCE}</script>`;
  frame.srcdoc = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${shotTag}</body>`) : html + shotTag;
  const loaded = new Promise<boolean>(resolve => {
    frame.onload = () => resolve(true);
    frame.onerror = () => resolve(false);
    setTimeout(() => resolve(false), 15_000);
  });
  document.body.appendChild(frame);
  try {
    if (!(await loaded)) return null;
    // Fonts and images settle a beat after load
    await new Promise(r => setTimeout(r, 400));
    const win = frame.contentWindow;
    return win ? await captureFromIframe(win) : null;
  } catch {
    return null;
  } finally {
    frame.remove();
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** A plain landing page for a demo link with several paper artifacts and no app */
function indexPageHtml(title: string, chosen: ShareArtifact[]): string {
  const items = chosen
    .map(
      a =>
        `<li><a href="${esc(artifactSitePath(a))}">${esc(a.name)}</a>` +
        `<span class="kind">${esc(a.kindLabel)}</span></li>`,
    )
    .join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  body { font-family: ui-rounded, 'SF Pro Rounded', system-ui, -apple-system, 'Segoe UI', sans-serif;
    background: #FAF7F2; color: #2A1F18; margin: 0; padding: 48px 24px; }
  main { max-width: 36rem; margin: 0 auto; }
  h1 { font-size: 2rem; letter-spacing: -0.02em; margin: 0 0 24px; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; align-items: baseline; gap: 12px; padding: 14px 0; border-top: 1px solid #E5DCD0; }
  a { color: #C0532F; font-weight: 600; font-size: 1.1rem; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .kind { color: #93806F; font-size: .9rem; }
</style></head>
<body><main><h1>${esc(title)}</h1><ul>${items}</ul></main></body></html>`;
}

/**
 * The files behind the demo link, for the artifacts the builder chose.
 *
 * With the app chosen, the site is the app (already built for publish)
 * plus a rendered page for each chosen doc; materials are on the site
 * already as their own pages. Without the app, only the chosen pages ship:
 * one artifact becomes the site's front page, so the QR opens it straight
 * away; several get a plain landing page that links to each.
 */
export function demoFilesFor(
  siteFiles: FileEntry[],
  projectFiles: FileEntry[],
  chosen: ShareArtifact[],
  title: string,
): FileEntry[] {
  const now = Date.now();
  const entry = (path: string, content: string): FileEntry => ({
    path,
    content,
    language: 'html',
    createdAt: now,
    updatedAt: now,
  });
  const appChosen = chosen.some(a => a.kind === 'app');
  const pages: FileEntry[] = [];
  for (const a of chosen) {
    if (a.kind === 'app') continue;
    const html = renderArtifactHtml(projectFiles, a);
    if (html) pages.push(entry('/' + artifactSitePath(a), html));
  }
  if (appChosen) {
    const taken = new Set(pages.map(p => p.path));
    return [...siteFiles.filter(f => !taken.has(f.path)), ...pages];
  }
  const paper = chosen.filter(a => a.kind !== 'app');
  if (paper.length === 1 && pages.length === 1) {
    return [entry('/index.html', pages[0].content), ...pages];
  }
  return [entry('/index.html', indexPageHtml(title, paper)), ...pages];
}
