import type { FileEntry } from '@/project/virtual-fs';

/**
 * Decide which preview engine a project needs.
 *
 * - 'framework' — real multi-file app: Vite config, `@/` path aliases, or a
 *   conventional /src/main.* entry. Runs on the in-browser esbuild bundler
 *   (full support for aliases, npm packages, Tailwind tokens, routing).
 * - 'sandpack' — everything else: single-file HTML/JS tools and simple React.
 *   Keeps the existing instant Sandpack path.
 * - 'server' — needs a server at runtime (Next.js SSR etc.); the browser
 *   can't preview it. Shown an explanation instead of a cryptic error.
 */
export type PreviewKind = 'framework' | 'sandpack' | 'server';

export function detectPreviewKind(files: FileEntry[]): PreviewKind {
  if (files.some(f => /(^|\/)next\.config\.[jt]s$/.test(f.path))) {
    return 'server';
  }

  const usesPathAlias = files.some(
    f => /\.(t|j)sx?$/.test(f.path) && /(?:from|import\()\s*['"]@\//.test(f.content),
  );
  const hasViteConfig = files.some(f => /(^|\/)vite\.config\.[jt]s$/.test(f.path));
  const hasSrcEntry = files.some(f => /^\/?src\/main\.(t|j)sx?$/.test(f.path));

  if (usesPathAlias || hasViteConfig || hasSrcEntry) {
    return 'framework';
  }

  return 'sandpack';
}
