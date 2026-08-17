import { stashAndStartFresh } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import type { StudioLibraryItem } from '@/cloud/studio-library';

/**
 * Building from a studio library item — the gallery path for a gated
 * studio's own shelf. Like a commons practice, it seeds Plan mode with the
 * item itself; unlike one, the item is already in the member's AI context
 * (the whole studio library rides along), so the draft just points the
 * conversation at it. The studio frame the member is building in carries
 * the lineage.
 */
export function startFromStudioItem(item: StudioLibraryItem, studioLabel: string): void {
  const who = item.attribution ? ` (from ${item.attribution})` : '';
  const opening =
    item.kind === 'prompt'
      ? `I'd like to build from ${studioLabel}'s prompt "${item.title}"${who}.`
      : item.kind === 'principle'
        ? `I'd like to build something grounded in ${studioLabel}'s principle "${item.title}"${who}.`
        : `I'd like to bring ${studioLabel}'s ${item.kind} "${item.title}"${who} to life for my community.`;
  const draft = [
    opening,
    item.summary ? `\nWhat it is: ${item.summary}` : '',
    '\nHelp me plan this — where would we start?',
    // The shelf item's screenshot rides along as a visible attachment, same
    // as the relational tech tools' remix flow: the model sees what the
    // original actually looks like, and the person sees what context travels
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
    promptTitle: item.title,
    sourceUrl: item.url ?? undefined,
    importedAt: new Date().toISOString(),
    // Remembering the shelf item closes the loop: sharing this build back
    // to the studio records it as a remix of what it grew from
    studioItemId: item.id,
  });
  useChatStore.getState().setDraftMessage(draft);
  useChatStore.getState().setDraftAttachments(item.image_url ? [item.image_url] : null);
}
