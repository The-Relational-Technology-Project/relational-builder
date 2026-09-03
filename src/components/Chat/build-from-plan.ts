import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';

/**
 * What building the plan actually means — one definition, two doors: the
 * action under the conversation, and the "Ready to build" answer on a
 * readiness card.
 *
 * The send carries the WHOLE conversation, so refinements made after the plan
 * document landed ("also add a lending toggle") ride along with it: "the plan
 * above" is the plan as it now stands, not the first draft of it. That is why
 * the action can outlive the message it first appeared under.
 */
export function buildFromPlanPrompt(existing: boolean): string {
  return existing
    ? 'Make the changes agreed in the plan above — only those changes, keeping everything else in the app exactly as it is. Generate the complete added or edited files with filename annotations. End by naming, in one line, anything you deliberately left for a later pass.'
    : 'Build the first version of the app described in the plan above — the plan\'s First-build features, not its Later ones. Generate complete, working files with filename annotations, following the plan\'s look & feel and data decisions. End by naming, in one line, what you left for the next pass.';
}

/**
 * Start the build from the plan as it stands. Mode flips first — handleSend
 * reads it fresh from the store — and the message rides the same queue the
 * plan answers already use, so there is one send path, not two.
 */
export function startBuildFromPlan(): void {
  const existing = useProjectStore.getState().getFileCount() > 0;
  useChatStore.getState().setMode('build');
  useChatStore.getState().queueMessage(buildFromPlanPrompt(existing));
}

/**
 * Answer options that mean "go" — the person approving the plan rather than
 * asking for another change. A tap on one of these IS the press: relaying the
 * words to the model instead would spend a whole reply re-offering a button.
 *
 * Deliberately tight. The prompt asks for these exact words, and anything not
 * recognised here simply sends as an ordinary answer — the action under the
 * conversation is still there — so a miss costs a round trip, never a build
 * nobody asked for.
 */
const READY_ANSWERS: readonly RegExp[] = [
  /^(yes[,—-]?\s*)?(i'?m\s+)?ready(\s+to\s+build)?$/,
  /^(yes[,—-]?\s*)?(let'?s\s+)?build\s+(it|this|this\s+plan)$/,
  /^(yes[,—-]?\s*)?approve\s+(this|the)\s+plan$/,
];

export function isReadyToBuildOption(option: string): boolean {
  const normalized = option
    .toLowerCase()
    .replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.!]+$/, '');
  return READY_ANSWERS.some(re => re.test(normalized));
}
