import { LUCIDE_ICON_NAMES } from '@/preview/lucide-icon-names';

/**
 * Static validation of lucide-react imports in generated code.
 *
 * Models hallucinate plausible icon names — a real build imported `HomePlus`
 * (never existed; `HousePlus` does) and shipped a preview that died at module
 * link time with a blob-URL stack trace. The import list is trivially
 * checkable the moment a file is applied, long before the bundle runs, and
 * a precise "did you mean" beats the runtime's export error every time.
 */

/** Accepts every importable form: canonical (`House`), bare alias (`Home`),
 *  `Icon`-suffixed (`HomeIcon`), and `Lucide`-prefixed (`LucideHome`). */
export function isLucideIconName(name: string): boolean {
  if (LUCIDE_ICON_NAMES.has(name)) return true;
  if (name.startsWith('Lucide') && LUCIDE_ICON_NAMES.has(name.slice(6))) return true;
  if (name.endsWith('Icon') && LUCIDE_ICON_NAMES.has(name.slice(0, -4))) return true;
  return false;
}

/** Non-icon named exports that are legitimate to import */
const NON_ICON_EXPORTS = new Set(['createLucideIcon', 'icons', 'Icon', 'DynamicIcon']);

/**
 * Named imports from 'lucide-react' in this source that don't exist in the
 * pinned version. Handles multiple import statements, `as` renames, and
 * type-only imports (skipped — esbuild strips them).
 */
export function invalidLucideImports(source: string): string[] {
  const bad: string[] = [];
  const importRe = /import\s*(type\s*)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g;
  for (const m of source.matchAll(importRe)) {
    if (m[1]) continue; // import type { … } never reaches the runtime
    for (const raw of m[2].split(',')) {
      const entry = raw.trim();
      if (!entry || entry.startsWith('type ')) continue;
      const name = entry.split(/\s+as\s+/)[0].trim();
      if (!name || NON_ICON_EXPORTS.has(name)) continue;
      if (!isLucideIconName(name)) bad.push(name);
    }
  }
  return [...new Set(bad)];
}

/** Nearest real icon names for a hallucinated one — substring matches first
 *  (HomePlus → HousePlus via 'plus'+'ho…'), then small edit distances. */
export function suggestLucideIcons(name: string, max = 3): string[] {
  const target = name.toLowerCase().replace(/^lucide/, '').replace(/icon$/, '');
  const scored: Array<{ n: string; score: number }> = [];
  for (const candidate of LUCIDE_ICON_NAMES) {
    const c = candidate.toLowerCase();
    let score: number;
    if (c === target) score = 0;
    else if (c.startsWith(target) || target.startsWith(c)) score = 1;
    else {
      const d = editDistance(target, c, 4);
      if (d > 3) continue;
      score = 1 + d;
    }
    scored.push({ n: candidate, score });
  }
  // A hallucinated compound like HomePlus: also try matching its word parts
  // against icons that contain all of them (home+plus → HousePlus misses on
  // 'home', but Plus-containing House icons rank via the distance pass above;
  // word-part containment catches reordered compounds like PlusHome)
  const words = name.replace(/^Lucide/, '').replace(/Icon$/, '').split(/(?=[A-Z])/).map(w => w.toLowerCase()).filter(Boolean);
  if (words.length > 1) {
    for (const candidate of LUCIDE_ICON_NAMES) {
      const c = candidate.toLowerCase();
      const hits = words.filter(w => c.includes(w)).length;
      if (hits === words.length) scored.push({ n: candidate, score: 1.5 });
      else if (hits === words.length - 1) scored.push({ n: candidate, score: 3.5 });
    }
  }
  const best = new Map<string, number>();
  for (const { n, score } of scored) {
    const prev = best.get(n);
    if (prev === undefined || score < prev) best.set(n, score);
  }
  return [...best.entries()]
    .sort((a, b) => a[1] - b[1] || a[0].length - b[0].length)
    .slice(0, max)
    .map(([n]) => n);
}

/** Bounded Levenshtein — bails once the distance exceeds `cap` */
function editDistance(a: string, b: string, cap: number): number {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > cap) return cap + 1;
    prev = cur;
  }
  return prev[b.length];
}
