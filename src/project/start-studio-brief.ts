import { STUDIO_BRIEF_CARD_SUMMARY } from '@/knowledge/studio-brief';
import { startFromCommonsItem } from '@/project/start-from-commons';

/**
 * The one door into designing a Studio: the /studiobrief address the public
 * /studios page links to, and anywhere else that wants to start a network
 * partner off. Same mechanics as the build day door — the studio-brief frame
 * is stamped into lineage and the partner's four-stage conversation opens,
 * ending in a Studio Brief and a one-page site they can share with RTP.
 */
export async function startStudioBrief(): Promise<void> {
  await startFromCommonsItem(STUDIO_BRIEF_CARD_SUMMARY);
}
