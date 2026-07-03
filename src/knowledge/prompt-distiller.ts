import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useStudioStore } from '@/store/studio-store';

/**
 * The prompt distiller: reverse-engineer the conversation and files into
 * one self-contained "prompt to build this" — the version of the app that
 * travels. A good build prompt carries intent, not implementation: someone
 * in another neighborhood should be able to paste it into any capable
 * builder and grow their own version with their own aesthetics.
 */

const DISTILLER_SYSTEM = [
  'You distill a finished build conversation into ONE self-contained build prompt — the prompt a stranger could use to grow their own version of this app.',
  '',
  'Write it as the person would say it, in second person to a future AI builder ("Build a …"). It must stand completely alone: no references to "the conversation", "the files above", or this session.',
  '',
  'Structure (no headings, just short paragraphs and lists):',
  '1. One opening sentence: what to build and who it serves.',
  '2. The features that matter, as a short list — include the decisions that were made along the way (moderation choices, sign-in or not, what is public).',
  '3. How data works, in plain words (stored on the device, shared community storage, sign-in via email codes — whatever this app actually does).',
  '4. The feel: describe the app\'s character and design intent in a sentence or two.',
  '',
  'Place-rooting: this prompt will travel to OTHER neighborhoods. Where the app references a specific place, group, or event, write it generically with a bracketed adaptation point, e.g. "[your neighborhood]", "[your weekly gathering]". Keep at most 3-5 such brackets — the prompt should invite adaptation, not read like a form.',
  '',
  'Do NOT include code, file names, framework choices, or model names — the next builder\'s tools decide those. 150-350 words.',
  '',
  'Reply with EXACTLY this format:',
  'TITLE: <a short name for this prompt, max 8 words>',
  '',
  '<the build prompt>',
].join('\n');

const MAX_FILE_CHARS = 4000;
const MAX_TOTAL_CHARS = 24000;

export interface DistilledPrompt {
  title: string;
  body: string;
}

export async function distillBuildPrompt(): Promise<DistilledPrompt> {
  const { activeProviderId, activeModelId } = useProviderStore.getState();
  const provider = registry.getProvider(activeProviderId);
  if (!provider) throw new Error('No model available to distill with');

  const messages = useChatStore.getState().messages;
  const asks = messages
    .filter(m => m.role === 'user')
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .filter(t => t && !t.startsWith('The live preview is showing this error'))
    .slice(0, 12);

  const files = useProjectStore.getState().getAllFiles()
    .filter(f => !/^\/?assets\//.test(f.path));

  if (asks.length === 0 && files.length === 0) {
    throw new Error('Nothing to distill yet — build something first');
  }

  const parts: string[] = ['What the person asked for, in order:', ''];
  asks.forEach((a, i) => parts.push(`${i + 1}. ${a.slice(0, 500)}`));
  parts.push('', 'The finished app\'s files (for understanding what got built — do not reference them):', '');
  let budget = MAX_TOTAL_CHARS;
  for (const f of files) {
    if (budget <= 0) break;
    const body = f.content.slice(0, MAX_FILE_CHARS);
    budget -= body.length;
    parts.push(`--- ${f.path} ---`, body, '');
  }

  let reply = '';
  await new Promise<void>((resolve, reject) => {
    provider.chat(
      [
        { role: 'system', content: DISTILLER_SYSTEM },
        { role: 'user', content: parts.join('\n') },
      ],
      activeModelId,
      {
        onToken: t => { reply += t; },
        onComplete: () => resolve(),
        onError: err => reject(err),
      },
      new AbortController().signal,
    );
  });

  const match = reply.match(/^TITLE:\s*(.+)$/m);
  const title = (match?.[1] ?? 'Build prompt').trim().slice(0, 80);
  const body = reply.replace(/^TITLE:.*$/m, '').trim();
  if (!body) throw new Error('The distiller came back empty — try again');
  return { title, body };
}

/** Lineage a fresh prompt carries: where and how it grew */
export function promptLineage(): Record<string, unknown> {
  const studio = useStudioStore.getState().activeStudio;
  const { activeModelId } = useProviderStore.getState();
  const projectLineage = useProjectStore.getState().lineage;
  return {
    studio: studio?.slug ?? null,
    distilled_with: activeModelId,
    ...(projectLineage?.source ? { project_source: projectLineage.source } : {}),
    ...(projectLineage?.promptSlug ? { grown_from_prompt: projectLineage.promptSlug } : {}),
  };
}
