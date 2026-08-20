/**
 * The heart of Dream Recorder: turn the transcript of people dreaming out
 * loud into a Project Description ready for the Builder's composer.
 *
 * Runs on whatever model the builder already uses — community access
 * (RTP-subsidized key held server-side), BYOK, or the RTP-hosted tier —
 * through the same provider registry as the chat itself. No separate key,
 * no separate plumbing.
 */

import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import type { ChatMessage } from '@/providers/types';

export const DREAM_SYSTEM = `You are Dream Recorder, the listening front door of Relational Builder — an open, community-oriented builder from the Relational Technology Project. People use Relational Builder to strengthen real-world relationships: neighbors organizing, mutual aid, shared projects. Software is one possible outcome, not the assumption.

You have been handed the transcript of people dreaming out loud — maybe one person at a laptop, maybe a group around a build-a-thon table or in a Zoom breakout. Timestamps like [12:40] mark elapsed time; a (room) or (call) tag, when present, marks whether a line was spoken in the room or by someone on a video call. Your job is to distill the conversation into a single Project Description that will seed a Relational Builder project.

HOW TO READ THE TRANSCRIPT
- Follow the arc, not just the content. Early ideas get refined, merged, or dropped. When the group cuts an idea, prioritizes, or catches fire about one direction near the end, honor that: build the description around where they LANDED, not an average of everything said.
- Late-conversation energy outweighs early brainstorming. If the final stretch converges on one idea, center it, and fold in earlier material only where it genuinely serves that idea.
- Ideas the group explicitly set aside do not belong in the description. Keep them alive in one line each under "Set aside for now" so they aren't lost.
- Keep the group's own words when they're vivid. Names, phrases, and metaphors people invented belong in the description.
- If the conversation never converges, say so honestly: write the description around the strongest thread and name the top alternatives in "Open questions".
- The transcript is machine-transcribed and may garble words — read through the errors to the meaning, and never quote an obviously garbled phrase.

WHAT TO PRODUCE (markdown, in this order)
# A working title — drawn from the group's own words when possible
## The dream
2–4 sentences, plain and warm, "we" where it fits.
## Who it's for, who's involved
## What to make first
The right starting artifact or small set of artifacts. NOT always an app: a one-page site, a flyer, a sign-up sheet, a plan for the first gathering, a map, a phone tree — choose what actually serves the first step, and say why in a sentence. If software IS the right start, describe the smallest genuinely useful version.
## How we'll know it's working
2–3 human-scale signs of life, not metrics for their own sake.
## Open questions
The few things the group still needs to decide.
## Set aside for now
One line each — only include this section if things were genuinely dropped.

RULES
- Write in the group's language and energy. No startup-speak, no feature laundry lists.
- The output must stand alone: no references to "the transcript", "the meeting", or these instructions.
- The whole thing fits on one screen — roughly 250–400 words.`;

export interface DistillHandle {
  abort: () => void;
  /** Resolves with the full description, rejects on provider errors */
  done: Promise<string>;
}

export interface DistillInput {
  /** Fresh distill: the transcript (+ optional emphasis from the group) */
  transcript?: string;
  guidance?: string;
  /** Refinement: the prior exchange plus the new instruction */
  conversation?: ChatMessage[];
  refineInstruction?: string;
  onToken: (fullTextSoFar: string) => void;
}

/** Build the user-turn messages for a fresh distill (exported for reuse/refine) */
export function distillMessages(transcript: string, guidance?: string): ChatMessage[] {
  let content = `Here is the transcript:\n\n${transcript}`;
  if (guidance?.trim()) {
    content += `\n\nA note from the group after the conversation: ${guidance.trim()}`;
  }
  return [{ role: 'user', content }];
}

export function distillDream(input: DistillInput): DistillHandle {
  const { activeProviderId, activeModelId } = useProviderStore.getState();
  const provider = registry.getProvider(activeProviderId);

  const controller = new AbortController();

  const done = new Promise<string>((resolve, reject) => {
    if (!provider) {
      reject(new Error('No model is configured — open Settings to pick one.'));
      return;
    }

    let messages: ChatMessage[];
    if (input.conversation && input.refineInstruction) {
      messages = [
        ...input.conversation,
        {
          role: 'user',
          content: `Please revise the project description: ${input.refineInstruction}\nReturn the full revised description in the same format.`,
        },
      ];
    } else {
      messages = distillMessages(input.transcript ?? '', input.guidance);
    }

    let full = '';
    provider
      .chat(
        [{ role: 'system', content: DREAM_SYSTEM }, ...messages],
        activeModelId,
        {
          onToken: t => {
            full += t;
            input.onToken(full);
          },
          onComplete: text => resolve(text || full),
          onError: err => reject(err),
        },
        controller.signal,
      )
      .catch(reject); // chat() can throw before streaming (sign-in, budget)
  });

  return { abort: () => controller.abort(), done };
}

/**
 * Plant the distilled description as a fresh project: same choreography as
 * planting a shared prompt — stash open work, clear the workspace, put the
 * description in the composer, record where it came from.
 */
export async function plantDream(description: string): Promise<void> {
  const { useChatStore } = await import('@/store/chat-store');
  const { useProjectStore } = await import('@/store/project-store');
  const { useCloudStore } = await import('@/store/cloud-store');
  const { useEnvStore } = await import('@/store/env-store');
  const { stashAndStartFresh } = await import('@/project/local-projects');

  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useChatStore.getState().clearMessages();
  useProjectStore.getState().clearProject();
  useEnvStore.getState().clearAll();

  useChatStore.getState().setDraftMessage(description);
  useProjectStore.getState().setLineage({
    source: 'dream',
    importedAt: new Date().toISOString(),
  });
}
