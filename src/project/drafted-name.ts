import { useCloudStore } from '@/store/cloud-store';
import {
  renameLocalProject,
  saveCurrentLocally,
  useLocalProjects,
} from './local-projects';
import { extractDraftedName, suggestProjectName } from './suggest-name';

/**
 * Adopt the project name the model drafted in its reply (the PROJECT-NAME
 * marker line). Before this, projects were christened by a word-clipping
 * heuristic over the first ask — real projects landed as "I Have a Very
 * Special Guys" and "Our Community Needs a Way to", names nobody could
 * recognize in a header, a report email, or the gallery.
 *
 * A person's own rename always wins: the drafted name only replaces a name
 * the machinery minted — the heuristic's output or an Untitled fallback.
 * Anything else was typed by someone, and we never rename over a human.
 */
export function adoptDraftedProjectName(markdown: string): void {
  const drafted = extractDraftedName(markdown);
  if (!drafted) return;

  const cloud = useCloudStore.getState();
  if (cloud.currentProjectId) {
    if (isMachineMintedName(cloud.currentProjectName)) void cloud.renameProject(drafted);
    return;
  }

  const local = useLocalProjects.getState();
  if (local.currentId) {
    if (isMachineMintedName(local.currentName)) renameLocalProject(local.currentId, drafted);
    return;
  }

  // No slot yet — the reply landed before the autosaver's first beat.
  // Mint the slot now, under the drafted name.
  saveCurrentLocally(drafted);
}

/** Did the machinery produce this name, or did a person type it? The mint
 *  paths all go through suggestProjectName() or the Untitled fallbacks, so a
 *  name matching none of those was chosen by a human and is not ours to
 *  change. (Re-deriving the heuristic here can drift from what it said at
 *  mint time only if the first user message itself changed — it can't.) */
function isMachineMintedName(current: string): boolean {
  const name = current.trim();
  if (!name || name === 'Untitled project' || name.startsWith('Untitled — ')) return true;
  return name === suggestProjectName();
}
