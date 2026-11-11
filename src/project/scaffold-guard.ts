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

const ROUTER_USE_RE = /import\s*\{[^}]*\b(Routes|Route|Link|NavLink|Navigate|Outlet|useLocation|useNavigate|useParams|useSearchParams)\b[^}]*\}\s*from\s*['"]react-router-dom['"]/;
const ANY_ROUTER_EL_RE = /<(HashRouter|BrowserRouter|MemoryRouter|Router)\b/;

/**
 * One router, at the top. Models write `<HashRouter>` inside App and call
 * `useLocation()` in the same component (outside the router it renders),
 * or use `<Routes>` with no router at all; both blank the page with a
 * react-router error. When the app uses react-router and `/src/main.tsx`
 * renders `<App />` with no router, wrap it there and drop the router
 * elements from the other files, so every route hook sits inside it.
 * Works on one reply's writes; needs main.tsx among them.
 */
export function hoistRouter<T extends { path: string; content: string }>(writes: T[]): { writes: T[]; hoisted: boolean } {
  const mainIdx = writes.findIndex(w => ENTRY_RE.test(w.path));
  if (mainIdx < 0) return { writes, hoisted: false };
  const main = writes[mainIdx];
  if (!/<App\s*\/>/.test(main.content) || ANY_ROUTER_EL_RE.test(main.content)) return { writes, hoisted: false };
  if (!writes.some(w => ROUTER_USE_RE.test(w.content))) return { writes, hoisted: false };

  const out = writes.map((w, i) => {
    if (i === mainIdx) {
      const lines = w.content.split('\n');
      let last = -1;
      lines.forEach((l, j) => { if (/^\s*import\s/.test(l)) last = j; });
      lines.splice(last + 1, 0, "import { HashRouter } from 'react-router-dom';");
      return { ...w, content: lines.join('\n').replace(/<App\s*\/>/, '<HashRouter><App /></HashRouter>') };
    }
    if (!/<(HashRouter|BrowserRouter)\b/.test(w.content)) return w;
    const content = w.content
      .replace(/<(HashRouter|BrowserRouter)\b[^>]*>/g, '<>')
      .replace(/<\/(HashRouter|BrowserRouter)>/g, '</>')
      .replace(/(import\s*\{)([^}]*)(\}\s*from\s*['"]react-router-dom['"])/, (_a, o: string, names: string, c: string) => {
        const kept = names.split(',').map(s => s.trim()).filter(n => n && !/^(HashRouter|BrowserRouter)\b/.test(n));
        return `${o} ${kept.join(', ')} ${c}`;
      });
    return { ...w, content };
  });
  return { writes: out, hoisted: true };
}
