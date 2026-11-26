/**
 * Going back, from the chat.
 *
 * The model cannot revert a project and should not be able to: going back is
 * the person's decision. But it can see the list of saved versions, and when
 * someone asks for "how it looked before the map" it usually knows which one
 * they mean. So it ends its reply with one line,
 *
 *   REVERT-TO: k3f9a2
 *
 * and the Builder swaps that line for a card under the reply: the version's
 * name and time, a way to look at it first, and a Revert button with the
 * same confirmation History uses. The reference is short because small
 * models miscopy long ids.
 */

import type { Checkpoint } from '@/store/project-store';

/** A short, stable handle for a version: its id minus the prefix, in base 36 */
export function versionRef(checkpoint: Pick<Checkpoint, 'id'>): string {
  const [, stamp = '0', kind = ''] = checkpoint.id.match(/^ckpt-(\d+)(?:-(\w+))?$/) ?? [];
  return Number(stamp).toString(36).slice(-6) + kind.slice(0, 1);
}

const POINTER = /^[ \t>*`]*REVERT-TO:[ \t]*`?([a-z0-9]{1,8})`?[ \t*`]*$/im;

/** The version reference a reply points at, or null */
export function parseVersionPointer(content: string): string | null {
  return content.match(POINTER)?.[1].toLowerCase() ?? null;
}

/** The reply without its pointer line, for display */
export function stripVersionPointer(content: string): string {
  return content.replace(new RegExp(POINTER.source + '\\n?', 'gim'), '');
}

export function findVersion(checkpoints: Checkpoint[], ref: string): Checkpoint | undefined {
  return checkpoints.find(c => versionRef(c) === ref);
}
