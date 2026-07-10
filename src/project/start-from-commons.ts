import { stashAndStartFresh } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import { fetchCommonsItemDetail, type CommonsCard } from '@/knowledge/commons-items';
import { frameSlugsForCommonsItem } from '@/knowledge/frames';

/**
 * Remixing a commons practice — the gallery path for Civic Media Recipes and
 * Neighboring Recipes. Unlike Studio tools (which distill a repo into a
 * build prompt), a practice seeds Plan mode with the recipe itself: the
 * person adapts it to their place, and the plan decides together with them
 * whether the build is a program doc, printable materials, software, or a
 * mix. The item's frame (civic media / practice-first) is stamped into
 * lineage at birth so its principles ride every turn of the project.
 */
export async function startFromCommonsItem(card: CommonsCard): Promise<void> {
  const detail = await fetchCommonsItemDetail(card.slug).catch(() => null);

  const who = card.attribution?.name ? ` (from ${card.attribution.name})` : '';
  const summary = detail?.summary ?? card.summary ?? '';
  const opening =
    card.kind === 'prompt'
      ? `I'd like to build from the commons prompt "${card.title}"${who}.`
      : `I'd like to bring the practice "${card.title}"${who} to my neighborhood.`;
  const draft = [
    opening,
    summary ? `\nWhat it is: ${summary}` : '',
    '\nHelp me plan this for my place — where would we start?',
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
    promptSlug: card.slug,
    promptTitle: card.title,
    sourceUrl: card.source_url ?? undefined,
    importedAt: new Date().toISOString(),
    frames: frameSlugsForCommonsItem(card),
  });
  useChatStore.getState().setDraftMessage(draft);
}
