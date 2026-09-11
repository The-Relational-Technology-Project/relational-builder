/**
 * Plan approval — the shared reading of "is there a plan to build, and did
 * the person just say yes to it".
 *
 * A real build report showed the cost of getting this wrong: a builder drafted
 * a full plan, asked two refinements (each reply a short bulleted delta, no
 * headings), and the Build button vanished because only the LAST reply was
 * checked for being a plan document. The model, told to say "press Build this
 * plan", kept pointing at a control that wasn't there; the person typed
 * "approved" into plan mode and got a chat reply. A day passed before the
 * build ran. So: the plan is the thread's, not the last message's, and a typed
 * approval counts as the button.
 */

export interface PlanThreadMessage {
  role: 'user' | 'assistant';
  content: string;
  isPlan?: boolean;
  isStreaming?: boolean;
}

export const QUESTION_HEADING_RE = /^#{2,3}\s+Questions?\s+for\s+you\s*$/im;

/** Markdown headings that aren't the question section — the tell of a
 *  drafted document rather than a conversational reply */
export function docHeadingCount(content: string): number {
  const headings = content.match(/^#{1,3}\s+.+$/gm) ?? [];
  return headings.filter(h => !QUESTION_HEADING_RE.test(h)).length;
}

/**
 * Plan-mode replies come in two registers. Conversation — exploring an idea,
 * asking the shaping questions as one-tap cards — renders like any chat
 * message. The drafted plan document (sections under markdown headings) gets
 * the plan dress and carries the Build/Approve action.
 */
export function isPlanDocument(content: string): boolean {
  return docHeadingCount(content) >= 2;
}

/** Does a settled plan document exist anywhere in the conversation? */
export function threadHasPlanDocument(messages: readonly PlanThreadMessage[]): boolean {
  return messages.some(
    m => m.role === 'assistant' && !!m.isPlan && !m.isStreaming && isPlanDocument(m.content),
  );
}

/** Does this reply end by asking the person something (a question section)? */
export function asksQuestions(content: string): boolean {
  return QUESTION_HEADING_RE.test(content);
}

/**
 * Whether the Build/Approve action belongs under the last reply. The action
 * needs something to approve: from scratch, a drafted plan document somewhere
 * in the thread; on an existing project, any settled plan-mode reply (a
 * two-sentence change IS the plan). Either way the last reply must be a
 * settled plan-mode reply that isn't waiting on answers — a reply that just
 * asked questions wants those, not approval. Refinement replies after the plan
 * ("Done — the plan now covers all eight estates…") keep the action live.
 */
export function shouldOfferBuild(
  messages: readonly PlanThreadMessage[],
  hasProject: boolean,
): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== 'assistant' || !last.isPlan || last.isStreaming) return false;
  if (asksQuestions(last.content)) return false;
  return hasProject || threadHasPlanDocument(messages);
}

/**
 * A short message that says yes to the plan. Deliberately narrow: whole
 * message, a few words, nothing else — "approved", "build this plan", "yes,
 * build it", "go ahead". A sentence that mentions building among other things
 * ("build it but make the header green") is a refinement and goes to the
 * model as typed.
 */
const APPROVAL_RE =
  /^(?:(?:ok(?:ay)?|yes|yep|yeah|sure|great|perfect|please|alright|sounds good)[,.!\s]*)*(?:approved?|approve (?:this|the) plan|build(?: this| the| it| that)?(?: plan| now| it)?|(?:go ahead|proceed|start)(?: and| with)?(?: the)?(?: build(?:ing)?)?(?: this| the| it)?(?: plan)?|let'?s (?:build|go|do it)|do it|make it|ship it|start (?:the )?build(?:ing)?|looks good,? build(?: it)?)[.!\s]*$/i;

export function isPlanApproval(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 60) return false;
  return APPROVAL_RE.test(t);
}

/** The build ask the button sends — the same words whether pressed or typed */
export function buildPlanPrompt(existingProject: boolean): string {
  return existingProject
    ? 'Make the changes agreed in the plan above — only those changes, keeping everything else in the app exactly as it is. Generate the complete added or edited files with filename annotations. End by naming, in one line, anything you deliberately left for a later pass.'
    : "Build the first version of the app described in the plan above — the plan's First-build features, not its Later ones. Generate complete, working files with filename annotations, following the plan's look & feel and data decisions. End by naming, in one line, what you left for the next pass.";
}
