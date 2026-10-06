import { referenceCodebaseNote } from '@/project/remix';
import { stashAndStartFresh } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import type { EventShelfItem } from '@/cloud/event-shelf-items';

/**
 * "Build it" on an event's inspiration shelf — the same door as a commons
 * tool card. The item is a real neighborhood tool as it runs, so the draft
 * frames the build as a neighborhood-scale remix of an open tool: the
 * screenshot rides along as the visual reference, the repo (when there is
 * one) as the codebase to consult, and lineage records what it grew from.
 */
export function startFromEventShelfItem(item: EventShelfItem, eventName: string): void {
  const where = item.attribution ? ` (${item.attribution})` : '';
  const draft = [
    `I'd like to build a remix of "${item.title}"${where} for my neighborhood — a tool I found on the ${eventName} shelf.`,
    item.summary ? `\nWhat it is: ${item.summary}` : '',
    referenceCodebaseNote(item.repo_url),
    item.site_url ? `\nThe original runs at ${item.site_url}.` : '',
    '\nHelp me plan this for my place — where would we start?',
    item.image_url
      ? '\nThe attached screenshot shows the original. Use it as the visual reference: keep the parts that transfer close to the original, and adapt the look and details to my place.'
      : '',
  ].join('\n').trim();

  // Never destructive: open work goes to the local shelf first
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useChatStore.getState().clearMessages();
  useEnvStore.getState().clearAll();
  useChatStore.getState().setMode('plan');
  useProjectStore.getState().setLineage({
    source: 'remix',
    promptSlug: `event-shelf:${item.id}`,
    promptTitle: item.title,
    sourceUrl: item.repo_url ?? item.site_url ?? undefined,
    importedAt: new Date().toISOString(),
  });
  useChatStore.getState().setDraftMessage(draft);
  useChatStore.getState().setDraftAttachments(item.image_url ? [item.image_url] : null);
}
