/**
 * Removing a file from a project — the one human-only edit.
 *
 * The AI can write files and make targeted edits; it cannot delete. That's
 * deliberate: a build that silently drops a file a person was relying on is a
 * different kind of surprise from one that writes something wrong, and the
 * second is always visible in the preview while the first isn't.
 *
 * So a deletion only ever comes from someone clicking it, and it does three
 * things at once: snapshots the project first (a deletion is the least
 * undoable thing in the workspace, and the checkpoint makes it the most),
 * removes the file, and — when a repo is connected — remembers the path so
 * the next push takes it out there too.
 */

import { useProjectStore } from '@/store/project-store';
import { useSyncStore } from '@/store/sync-store';
import { connectedRepoForCurrentProject, projectRepoKey } from './code-sync';

/** How a path reads in a sentence — no leading slash */
export function displayPath(path: string): string {
  return path.replace(/^\//, '');
}

/**
 * Delete one file. Returns false when there was nothing there — a
 * double-click on a confirm button shouldn't take a second checkpoint.
 */
export function deleteProjectFile(path: string): boolean {
  const store = useProjectStore.getState();
  if (!store.getFile(path)) return false;

  store.takeCheckpoint(`Before deleting ${displayPath(path)}`);
  store.deleteFile(path);

  // The repo has to be told separately: a push adds and updates, and never
  // removes a file that only exists there (a README, workflows, docs written
  // on the forge). Without this the file would live on in the repo — and
  // anything built from the repo side would keep carrying it.
  if (connectedRepoForCurrentProject()) {
    useSyncStore.getState().recordDeletion(projectRepoKey(), path);
  }
  return true;
}
