/**
 * THE benchmark task. One well-scoped design+build ask, frozen so results
 * stay comparable across runs and releases.
 *
 * Stability rule: never edit PROMPT or the checks' meaning in place — any
 * change bumps TASK_VERSION, and reports always carry the version, so a v1
 * number is never compared against a v2 number.
 *
 * Why this task: a single ask that exercises the qualities RTP actually
 * routes on — theme-contract adherence, kit component usage, multi-view
 * structure with routing, seeded data on every screen, mobile-first layout,
 * and zero-setup first render.
 */

export const TASK_VERSION = 'v1';

export const TASK_ID = 'mutual-aid-board';

/** What detectPreviewKind should say about a good answer to this ask */
export const EXPECTED_PREVIEW_KIND = 'framework';

export const PROMPT =
  'Build a mutual aid board for our neighborhood: people can post offers and ' +
  'needs (childcare, tools, rides, food), browse by category, and mark a post ' +
  'fulfilled. It should feel warm and neighborly, work well on phones, and ' +
  'come seeded with realistic example posts.';

export interface TaskCheck {
  id: string;
  description: string;
  test: (files: Record<string, string>, transcript: string) => boolean;
}

const tsxFiles = (files: Record<string, string>): string[] =>
  Object.entries(files)
    .filter(([p]) => /\.(t|j)sx?$/.test(p))
    .map(([, c]) => c);

export const CHECKS: TaskCheck[] = [
  {
    id: 'theme-tokens',
    description: 'index.css declares the @theme token block (theme contract)',
    test: files => /@theme\s/.test(files['/src/index.css'] ?? ''),
  },
  {
    id: 'kit-components',
    description: 'imports RB kit components (@/components/ui/*)',
    test: files => tsxFiles(files).some(c => /from\s+['"]@\/components\/ui\//.test(c)),
  },
  {
    id: 'hash-router',
    description: 'uses HashRouter (BrowserRouter 404s on static hosting)',
    test: files => {
      const code = tsxFiles(files).join('\n');
      if (!/react-router/.test(code)) return true; // routing is optional
      return /HashRouter/.test(code) && !/BrowserRouter/.test(code);
    },
  },
  {
    id: 'seeded-data',
    description: 'ships realistic seeded posts (no empty first render)',
    test: files =>
      tsxFiles(files).some(
        c => /(seed|sample|initial|example)\w*(Posts|Data|Items|Entries)/i.test(c) ||
             /const\s+\w+\s*[:=][^=]*\[\s*\{/.test(c),
      ),
  },
  {
    id: 'no-backend',
    description: 'zero-setup: no required external backend for first render',
    test: files =>
      !tsxFiles(files).some(c => /createClient\(|supabase\.co|firebase/i.test(c)),
  },
];
