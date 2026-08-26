/**
 * Plain-language names for project artifacts.
 *
 * The chat's file cards and the preview's output pills are the friendly
 * surfaces — a neighbor shaping a flyer should read "Garden Flyer ·
 * Printable page", not `materials/flyer.html · 207 lines`. The Files tab
 * stays the honest technical surface and keeps raw paths.
 *
 * Everything derives from (path, content?) so messages saved before this
 * existed — or cards whose file content isn't at hand — still get a name
 * from the path alone.
 */

export type ArtifactKind =
  | 'app'
  | 'app-page'
  | 'material'
  | 'doc'
  | 'style'
  | 'data'
  | 'function'
  | 'code';

export interface ArtifactDisplay {
  /** "Garden Flyer", "Outreach Plan", "Header" */
  name: string;
  /** "Printable page", "Written doc", "App page", … */
  kindLabel: string;
  kind: ArtifactKind;
}

const MAX_TITLE = 60;

/** Human title + friendly kind for a project file. */
export function artifactDisplay(path: string, content?: string): ArtifactDisplay {
  const { kind, kindLabel } = classify(path);
  const name = (content ? titleFromContent(path, content) : null) ?? humanizeBasename(path);
  return { name, kindLabel, kind };
}

/** Just the title — for pills, print titles. */
export function artifactName(path: string, content?: string): string {
  return artifactDisplay(path, content).name;
}

/** "outreach-plan.md" → "Outreach Plan"; "StoryDetail.tsx" → "Story Detail". */
export function humanizeBasename(path: string): string {
  const base = path.split('/').filter(Boolean).pop() ?? path;
  const stem = base.replace(/\.[^.]+$/, '') || base;
  const spaced = stem
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!spaced) return base;
  return spaced
    .split(/\s+/)
    .map(w => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

/** Kind classification mirrors the path conventions the model is taught
 *  (context-builder) and the preview's own doc/material scans. */
function classify(path: string): { kind: ArtifactKind; kindLabel: string } {
  const p = path.startsWith('/') ? path : `/${path}`;
  if (/\.md$/i.test(p)) return { kind: 'doc', kindLabel: 'Written doc' };
  if (/\.html?$/i.test(p)) {
    if (p === '/index.html') return { kind: 'app', kindLabel: 'The app' };
    return p.startsWith('/materials/')
      ? { kind: 'material', kindLabel: 'Printable page' }
      : { kind: 'material', kindLabel: 'Page' };
  }
  if (/^\/src\/(main|App)\.[jt]sx?$/.test(p)) return { kind: 'app', kindLabel: 'The app' };
  if (p.startsWith('/src/pages/')) return { kind: 'app-page', kindLabel: 'App page' };
  if (/\.css$/i.test(p)) return { kind: 'style', kindLabel: 'Styles' };
  if (/^\/(netlify\/functions|supabase\/functions|api)\//.test(p)) {
    return { kind: 'function', kindLabel: 'Server function' };
  }
  if (/\.json$/i.test(p) || p.startsWith('/src/data/')) return { kind: 'data', kindLabel: 'Data' };
  return { kind: 'code', kindLabel: 'Code' };
}

/** The title the artifact gives itself: a doc's first heading, a page's
 *  <title> or first <h1>. Null when the content offers none. */
function titleFromContent(path: string, content: string): string | null {
  if (/\.md$/i.test(path)) {
    const h = content.match(/^#\s+(.+)$/m);
    return h ? cleanTitle(h[1].replace(/[*_`]/g, '')) : null;
  }
  if (/\.html?$/i.test(path)) {
    const t = content.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (t) {
      const cleaned = cleanTitle(t[1]);
      if (cleaned) return cleaned;
    }
    const h1 = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (h1) return cleanTitle(h1[1].replace(/<[^>]+>/g, ''));
  }
  return null;
}

function cleanTitle(raw: string): string | null {
  const t = decodeEntities(raw).replace(/\s+/g, ' ').trim();
  if (!t) return null;
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE - 1).trimEnd()}…` : t;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}
