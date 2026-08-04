/**
 * Direct text edits — fixing a typo shouldn't cost a model call.
 *
 * When the builder points at a piece of copy in the preview and its exact
 * wording appears at ONE place in the project source, we can change it
 * with a plain string replacement: instant, free, and safe. Anything
 * ambiguous — text rendered from data, wording that appears twice, copy
 * assembled across elements — quietly falls back to the AI path, which
 * was the only path before.
 */

import { useProjectStore } from '@/store/project-store';
import { isBinaryPath } from './forge/types';

/**
 * Where this exact text lives in the project — or null when it doesn't
 * appear exactly once (then only the AI can be trusted to find it).
 */
export function locateExactText(text: string): { path: string } | null {
  if (!text || text.trim().length < 3) return null;
  const files = useProjectStore.getState().getAllFiles();
  let hit: string | null = null;
  let total = 0;
  for (const f of files) {
    if (isBinaryPath(f.path)) continue;
    const count = f.content.split(text).length - 1;
    if (count > 0) {
      total += count;
      hit = f.path;
      if (total > 1) return null;
    }
  }
  return total === 1 && hit ? { path: hit } : null;
}

/**
 * Replace the single occurrence. Checkpoints first, so the stage strip's
 * undo covers hand edits exactly like AI ones. Returns false when the
 * text no longer matches (file changed since it was located) — callers
 * fall back to the AI path.
 */
export function applyDirectTextEdit(path: string, oldText: string, newText: string): boolean {
  const store = useProjectStore.getState();
  const file = store.getFile(path);
  if (!file || !file.content.includes(oldText)) return false;
  store.takeCheckpoint('Before text edit');
  // Function replacement: $-patterns in the new wording stay literal
  store.writeFile(path, file.content.replace(oldText, () => newText));
  return true;
}
