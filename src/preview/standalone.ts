import type { FileEntry } from '@/project/virtual-fs';

/**
 * Turn a simple static project into ONE self-contained HTML document —
 * local stylesheet links and script tags inlined — so "open in browser"
 * can hand the whole app to a new tab as a blob URL. Remote (http…) refs
 * stay as-is; they load normally in the tab. `entry` picks which HTML file
 * is the document: the app's index.html by default, or a second page /
 * material (about.html, flyer.html) that shares the project's stylesheet.
 */
export function buildStandaloneHtml(files: FileEntry[], entry = 'index.html'): string | null {
  const byPath = new Map(files.map(f => [f.path.replace(/^\//, ''), f.content]));
  const entryPath = entry.replace(/^\//, '');
  const html = byPath.get(entryPath);
  if (!html) return null;

  // Relative refs resolve against the entry's own folder (about.html next
  // to styles.css; materials/flyer.html next to materials/print.css)
  const dir = entryPath.includes('/') ? entryPath.slice(0, entryPath.lastIndexOf('/') + 1) : '';
  const local = (src: string) => {
    const clean = src.replace(/^\.\//, '');
    if (clean.startsWith('/')) return byPath.get(clean.slice(1));
    return byPath.get(normalize(dir + clean)) ?? byPath.get(clean);
  };

  let out = html.replace(
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["'](?!https?:)([^"']+)["'][^>]*\/?>/gi,
    (tag, href) => {
      const css = local(href);
      return css !== undefined ? `<style>\n${css}\n</style>` : tag;
    },
  );
  out = out.replace(
    /<script\b([^>]*)\bsrc=["'](?!https?:)([^"']+)["']([^>]*)>\s*<\/script>/gi,
    (tag, pre, src, post) => {
      const js = local(src);
      if (js === undefined) return tag;
      const type = /type=["']module["']/.test(pre + post) ? ' type="module"' : '';
      return `<script${type}>\n${js.replace(/<\/script(?=[\s/>])/gi, '<\\/script')}\n</script>`;
    },
  );
  return out;
}

/** Collapse "materials/../styles.css" to "styles.css" — a material one folder
 *  down reaches the app's stylesheet with a `..` the map can't hold. */
function normalize(path: string): string {
  const out: string[] = [];
  for (const seg of path.split('/')) {
    if (seg === '..') out.pop();
    else if (seg !== '.' && seg !== '') out.push(seg);
  }
  return out.join('/');
}
