import type { FileEntry } from '@/project/virtual-fs';
import type { DisplayMessage } from '@/store/chat-store';
import type { ProjectNote, ProjectStory } from '@/store/notepad-store';

/**
 * Merging a teammate's snapshot into the open workspace.
 *
 * A cloud project row is one whole snapshot — files, chat, notes — and for
 * a long time a remote save simply replaced everything on every other
 * device. For one person on two devices that is right. For a team on four
 * devices it meant the last save won and the others' work quietly went:
 * a half-typed note, a prompt and its reply, the files a build had just
 * written. These functions take the two snapshots and keep both sides.
 *
 *   files    — per path, the newer `updatedAt` wins. A file only we have is
 *              kept while it is fresh (written after the remote snapshot,
 *              or protected because our own build is writing right now);
 *              an old file the remote no longer has was deleted there on
 *              purpose and goes.
 *   messages — union by id, in time order. Ids carry the device's clock
 *              and a counter, so two devices never mint the same one.
 *   notes    — union by id, newer edit wins. Nobody loses a note because a
 *              teammate saved first.
 *   story    — the more recently touched draft wins.
 */

/** How much older than the remote row a local-only file must be before it
 *  reads as "deleted there" rather than "new here". Saves debounce 1.5s;
 *  this leaves room for a slow network on top. */
const DELETED_REMOTELY_MARGIN_MS = 10_000;

export interface MergeFilesOptions {
  /** Server time of the remote snapshot (projects.updated_at) */
  remoteAt: number;
  /** Local files written at or after this instant are ours to keep whatever
   *  the remote says — a build in flight here is writing them right now */
  protectAfter?: number;
}

export function mergeFiles(
  local: FileEntry[],
  remote: FileEntry[],
  opts: MergeFilesOptions,
): FileEntry[] {
  const out = new Map<string, FileEntry>();
  const remoteByPath = new Map(remote.map(f => [f.path, f]));
  const protectAfter = opts.protectAfter ?? Number.POSITIVE_INFINITY;

  for (const mine of local) {
    const theirs = remoteByPath.get(mine.path);
    if (theirs) {
      out.set(mine.path, theirs.updatedAt > mine.updatedAt ? theirs : mine);
      continue;
    }
    const fresh =
      mine.updatedAt >= protectAfter ||
      mine.updatedAt > opts.remoteAt - DELETED_REMOTELY_MARGIN_MS;
    if (fresh) out.set(mine.path, mine);
    // else: they had this file when they loaded and saved without it — deleted
  }
  for (const theirs of remote) {
    if (!out.has(theirs.path)) out.set(theirs.path, theirs);
  }
  return Array.from(out.values()).sort((a, b) => a.path.localeCompare(b.path));
}

export function mergeMessages(local: DisplayMessage[], remote: DisplayMessage[]): DisplayMessage[] {
  const byId = new Map<string, DisplayMessage>();
  // Remote first, then ours on top: a message we are still streaming keeps
  // its live content and flag rather than the stale copy they saved
  for (const m of remote) byId.set(m.id, { ...m, isStreaming: false });
  for (const m of local) {
    const theirs = byId.get(m.id);
    if (!theirs || m.isStreaming || m.content.length >= theirs.content.length) byId.set(m.id, m);
  }
  return Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
}

export function mergeNotes(local: ProjectNote[], remote: ProjectNote[]): ProjectNote[] {
  const byId = new Map<string, ProjectNote>();
  for (const n of remote) byId.set(n.id, n);
  for (const n of local) {
    const theirs = byId.get(n.id);
    if (!theirs || n.updatedAt >= theirs.updatedAt) byId.set(n.id, n);
  }
  return Array.from(byId.values()).sort((a, b) => a.createdAt - b.createdAt);
}

export function mergeStory(local: ProjectStory | null, remote: ProjectStory | null): ProjectStory | null {
  if (!local) return remote;
  if (!remote) return local;
  const touched = (s: ProjectStory) => Math.max(s.draftedAt, s.editedAt ?? 0);
  return touched(remote) > touched(local) ? remote : local;
}

/** Union by id for anything else that travels as a list of ids */
export function mergeById<T extends { id: string }>(local: T[], remote: T[]): T[] {
  const byId = new Map<string, T>();
  for (const r of remote) byId.set(r.id, r);
  for (const l of local) if (!byId.has(l.id)) byId.set(l.id, l);
  return Array.from(byId.values());
}
