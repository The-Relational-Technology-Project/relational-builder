/**
 * The RB kit: shadcn-aligned components and design tokens that ship AS
 * SOURCE inside generated projects — shadcn's copy-paste philosophy,
 * automated for remixability.
 *
 * How it flows:
 * - The kit is authored as real, typechecked files under src/kit/files/,
 *   mirroring a generated project's /src layout exactly (so their relative
 *   imports resolve identically here and there).
 * - At preview time the registry merges UNDERNEATH the project's virtual
 *   FS: `{...KIT_FILES, ...projectFiles}`. Imports of `@/components/ui/*`
 *   resolve from the kit for free; a project file at the same path
 *   overrides it (ask the AI to customize a component and the custom
 *   version simply wins). Unused kit files cost nothing.
 * - At export/publish/sync time, `withKitFiles()` materializes just the
 *   kit files the project actually imports (plus their internal deps), so
 *   the app is self-contained anywhere outside the builder.
 */

import utilsSrc from './files/lib/utils.ts?raw';
import slotSrc from './files/components/ui/slot.tsx?raw';
import buttonSrc from './files/components/ui/button.tsx?raw';
import cardSrc from './files/components/ui/card.tsx?raw';
import inputSrc from './files/components/ui/input.tsx?raw';
import textareaSrc from './files/components/ui/textarea.tsx?raw';
import labelSrc from './files/components/ui/label.tsx?raw';
import badgeSrc from './files/components/ui/badge.tsx?raw';
import avatarSrc from './files/components/ui/avatar.tsx?raw';
import tabsSrc from './files/components/ui/tabs.tsx?raw';
import dialogSrc from './files/components/ui/dialog.tsx?raw';
import switchSrc from './files/components/ui/switch.tsx?raw';
import checkboxSrc from './files/components/ui/checkbox.tsx?raw';
import selectSrc from './files/components/ui/select.tsx?raw';
import appBarSrc from './files/components/ui/app-bar.tsx?raw';
import emptyStateSrc from './files/components/ui/empty-state.tsx?raw';
import skeletonSrc from './files/components/ui/skeleton.tsx?raw';

/** Kit sources by the path they occupy inside a generated project. */
export const KIT_FILES: Record<string, string> = {
  '/src/lib/utils.ts': utilsSrc,
  '/src/components/ui/slot.tsx': slotSrc,
  '/src/components/ui/button.tsx': buttonSrc,
  '/src/components/ui/card.tsx': cardSrc,
  '/src/components/ui/input.tsx': inputSrc,
  '/src/components/ui/textarea.tsx': textareaSrc,
  '/src/components/ui/label.tsx': labelSrc,
  '/src/components/ui/badge.tsx': badgeSrc,
  '/src/components/ui/avatar.tsx': avatarSrc,
  '/src/components/ui/tabs.tsx': tabsSrc,
  '/src/components/ui/dialog.tsx': dialogSrc,
  '/src/components/ui/switch.tsx': switchSrc,
  '/src/components/ui/checkbox.tsx': checkboxSrc,
  '/src/components/ui/select.tsx': selectSrc,
  '/src/components/ui/app-bar.tsx': appBarSrc,
  '/src/components/ui/empty-state.tsx': emptyStateSrc,
  '/src/components/ui/skeleton.tsx': skeletonSrc,
};

/** Resolve an import specifier (`@/…` or a relative path already joined to
 * an absolute one) against the kit's paths, Vite-style. */
function resolveKitPath(path: string): string | null {
  if (path in KIT_FILES) return path;
  for (const ext of ['.tsx', '.ts']) {
    if (path + ext in KIT_FILES) return path + ext;
  }
  return null;
}

const IMPORT_RE = /(?:from|import\()\s*['"]([^'"]+)['"]/g;

/** Absolute VFS paths a file's imports point at (aliases + relative). */
function importTargets(filePath: string, content: string): string[] {
  const targets: string[] = [];
  for (const m of content.matchAll(IMPORT_RE)) {
    let spec = m[1];
    if (spec.startsWith('@/')) spec = '/src/' + spec.slice(2);
    else if (spec.startsWith('./') || spec.startsWith('../')) {
      const base = filePath.slice(0, filePath.lastIndexOf('/'));
      const parts = (base + '/' + spec).split('/');
      const out: string[] = [];
      for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') out.pop();
        else out.push(p);
      }
      spec = '/' + out.join('/');
    } else {
      continue; // bare import — not a kit file
    }
    targets.push(spec);
  }
  return targets;
}

/**
 * The kit files a project actually uses: every kit path reachable from the
 * project's own imports, transitively (button pulls slot pulls utils).
 */
export function kitFilesUsed(projectFiles: Record<string, string>): Record<string, string> {
  const used: Record<string, string> = {};
  const queue: Array<[path: string, content: string]> = Object.entries(projectFiles)
    .filter(([p]) => /\.(t|j)sx?$/.test(p));

  while (queue.length > 0) {
    const [path, content] = queue.pop()!;
    for (const target of importTargets(path, content)) {
      const kitPath = resolveKitPath(target);
      // The project's own file at this path wins — not a kit usage.
      if (!kitPath || kitPath in projectFiles || kitPath in used) continue;
      used[kitPath] = KIT_FILES[kitPath];
      queue.push([kitPath, KIT_FILES[kitPath]]);
    }
  }
  return used;
}

/**
 * Project files + the kit files they import — the self-contained set that
 * export, publish, and GitHub sync should write.
 */
export function withKitFiles(projectFiles: Record<string, string>): Record<string, string> {
  return { ...kitFilesUsed(projectFiles), ...projectFiles };
}
