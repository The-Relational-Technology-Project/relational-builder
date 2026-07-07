import type { FileEntry } from '@/project/virtual-fs';

/**
 * Turn a simple static project into ONE self-contained HTML document —
 * local stylesheet links and script tags inlined — so "open in browser"
 * can hand the whole app to a new tab as a blob URL. Remote (http…) refs
 * stay as-is; they load normally in the tab.
 */
export function buildStandaloneHtml(files: FileEntry[]): string | null {
  const byPath = new Map(files.map(f => [f.path.replace(/^\//, ''), f.content]));
  const html = byPath.get('index.html');
  if (!html) return null;

  const local = (src: string) => byPath.get(src.replace(/^\.?\//, ''));

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
      return `<script${type}>\n${js.replace(/<\/script>/gi, '<\\/script>')}\n</script>`;
    },
  );
  return out;
}
