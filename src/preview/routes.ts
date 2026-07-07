import type { FileEntry } from '@/project/virtual-fs';

/**
 * The static hash routes a framework app declares — feeds the preview
 * toolbar's page dropdown. Parses `<Route path="…">` from source (the
 * stack teaches HashRouter, so every path is reachable as `#/path`).
 * Dynamic segments (`:id`, `*`) are skipped: they need data to mean
 * anything.
 */
export function extractHashRoutes(files: FileEntry[]): string[] {
  const routes = new Set<string>();
  for (const f of files) {
    if (!/\.(t|j)sx$/.test(f.path)) continue;
    for (const m of f.content.matchAll(/<Route\s[^>]*?path=["']([^"']+)["']/g)) {
      const path = m[1];
      if (!path.startsWith('/')) continue;
      if (path.includes(':') || path.includes('*')) continue;
      routes.add(path);
    }
  }
  return [...routes].sort((a, b) => (a === '/' ? -1 : b === '/' ? 1 : a.localeCompare(b)));
}
