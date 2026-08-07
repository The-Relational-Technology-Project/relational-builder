import { stashAndStartFresh } from '@/project/local-projects';
import { useCloudStore } from '@/store/cloud-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useEnvStore } from '@/store/env-store';
import { DELIBERATIVE_FRAME } from '@/knowledge/frames';
import { DELIB_STAGE_META, type DelibStage, type DelibTool } from '@/knowledge/delib-tools';

/**
 * Growing a local version of a deliberative tool — the gallery path for the
 * Deliberative Tools shelf. Like the commons practices, this seeds Plan mode
 * rather than sending: the person shapes the pattern to their place and their
 * question before anything generates. The deliberative frame is stamped into
 * lineage at birth, so its guardrails (tension-first design, facilitation
 * scaffolding, flatfile exports, attribution) ride every turn — and the
 * pattern's builders stay named from the very first message.
 */
export function startFromDelibTool(tool: DelibTool): void {
  const credit = tool.builders
    .map(b => (b.org ? `${b.name} — ${b.org}` : b.name))
    .join(', ');

  const draft = [
    `I'd like to grow a ${tool.name}-style tool for my neighborhood — ${tool.tagline.toLowerCase()}.`,
    `\nThe pattern (credit: ${credit}; ${tool.url}): ${tool.remixPattern}`,
    '\nOur situation: [what question or tension is your neighborhood working through?]',
    'Who should be heard: [the whole block? renters and owners? youth and elders?]',
    'Where it meets people on land: [a flyer with a QR code? the bulletin board? a standing meeting?]',
    '\nHelp me plan a first version — the tool itself, plus a facilitation agenda, an outreach plan, and a printable flyer to bring people in.',
  ].join('\n');

  // Never destructive: open work goes to the local shelf first
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useChatStore.getState().clearMessages();
  useEnvStore.getState().clearAll();
  useChatStore.getState().setMode('plan');
  useProjectStore.getState().setLineage({
    source: 'prompt',
    promptSlug: `delib-${tool.id}`,
    promptTitle: tool.name,
    sourceUrl: tool.url,
    importedAt: new Date().toISOString(),
    frames: [DELIBERATIVE_FRAME.slug],
  });
  useChatStore.getState().setDraftMessage(draft);
}

export interface DeliberationKitInput {
  question: string;
  place?: string;
  tension?: { pair: string; blurb: string } | null;
  stages: DelibStage[];
  tool?: DelibTool | null;
}

/**
 * The Deliberation Studio's hand-off: a neighborhood question, the tension it
 * sits on, the stages the process needs, and (optionally) a pattern to grow
 * from become one editable Plan-mode draft. Same ritual as every start-from —
 * the person sends it, not us.
 */
export function startDeliberationKit(input: DeliberationKitInput): void {
  const stages = input.stages.length > 0 ? input.stages : ['eliciting', 'deliberating', 'proposing'] as DelibStage[];
  const stageLine = stages.map(s => DELIB_STAGE_META[s].label.toLowerCase()).join(', ');
  const toolCredit = input.tool
    ? input.tool.builders.map(b => (b.org ? `${b.name} — ${b.org}` : b.name)).join(', ')
    : null;

  const draft = [
    `Our neighborhood${input.place ? ` (${input.place})` : ''} has a question to work through together: ${input.question.trim()}`,
    input.tension
      ? `\nThe tension underneath it feels like **${input.tension.pair}** — ${input.tension.blurb}.`
      : '',
    `\nThe process should cover: ${stageLine}.`,
    input.tool && toolCredit
      ? `\nA pattern to grow from: ${input.tool.name} (${toolCredit}; ${input.tool.url}) — ${input.tool.remixPattern}`
      : '',
    '\nHelp me plan a deliberation kit: a small tool that serves those stages, a facilitation agenda with the tension and a few starting prompts written in, an outreach plan for who invites whom, and a printable flyer with room for a QR code. Results should be exportable so what we learn can travel.',
  ].filter(Boolean).join('\n');

  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useChatStore.getState().clearMessages();
  useEnvStore.getState().clearAll();
  useChatStore.getState().setMode('plan');
  useProjectStore.getState().setLineage({
    source: 'prompt',
    promptSlug: 'deliberation-studio',
    promptTitle: 'Neighborhood deliberation',
    importedAt: new Date().toISOString(),
    frames: [DELIBERATIVE_FRAME.slug],
  });
  useChatStore.getState().setDraftMessage(draft);
}
