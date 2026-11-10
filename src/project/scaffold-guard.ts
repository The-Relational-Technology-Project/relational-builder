/**
 * Two mechanical guards for files every framework app shares, applied by the
 * extractor behind the human-scale flag (same spirit as import-repair.ts):
 *
 * - A write to a kit path (`/src/components/ui/app-bar.tsx`, …) that exports
 *   none of the kit file's names is a stub, not a customization: it would
 *   shadow the kit and break every import of it. The write is dropped and
 *   the kit file stays. (Gemma, Nov 10: a comment-only app-bar.tsx.)
 * - A `/src/main.tsx` that imports App but never renders `<App` gets its one
 *   `.render(…)` call pointed at `<App />`. (Gemma, Nov 10:
 *   `root.render(<React></React>)`.)
 *
 * Everything else passes through untouched.
 */
import { kitExports } from './fix-hints';

export function isKitStub(path: string, content: string, kitFiles: Record<string, string>): boolean {
  const key = '/' + path.replace(/^\//, '');
  if (!(key in kitFiles)) return false;
  const names = kitExports(kitFiles)[key] ?? [];
  if (names.length === 0) return false;
  const own = kitExports({ [key]: content })[key] ?? [];
  return !own.some(n => names.includes(n));
}

const ENTRY_RE = /^\/?src\/main\.[jt]sx$/;

export function repairEntry(path: string, content: string): { content: string; repaired: boolean } {
  if (!ENTRY_RE.test(path)) return { content, repaired: false };
  if (!/import\s+App\s+from\s+['"]/.test(content) || /<App[\s/>]/.test(content)) return { content, repaired: false };
  const calls = content.match(/\.render\(/g) ?? [];
  if (calls.length !== 1) return { content, repaired: false };
  const next = content.replace(/\.render\(([\s\S]*?)\);/, '.render(<App />);');
  return next === content ? { content, repaired: false } : { content: next, repaired: true };
}
