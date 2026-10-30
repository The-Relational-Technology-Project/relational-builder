/**
 * What the model is told about AI in built apps when the human-scale flag
 * is on. Goes into the same connected-services guidance list as the
 * Community Cloud blocks (ChatPanel), after them, so it overrides their
 * `askAI` snippet with the kit helper and the bounded-jobs rule.
 */

import { describeRuntime, type ProjectRuntime } from './runtime';

export function humanScaleAiGuidance(runtime: ProjectRuntime | null): string {
  const rt = runtime ?? { kind: 'community' as const, fallback: 'none' as const };
  return [
    '- **AI in this app goes through the kit helper `@/lib/ai`, not a hand-written `askAI`.** This project\'s runtime setting is: ' + describeRuntime(rt) + ' The helper reads that setting from the app\'s public env and routes the call; never write fetch code for AI yourself, never reference provider keys or endpoints in app code, and never let the app silently use a hosted frontier model.',
    '  ```ts',
    '  import { summarize, match, resurface, ask, aiRuntimeLabel, AIUnavailableError } from "@/lib/ai";',
    '  const r = await summarize(notesText, { sources: noteIds });   // r.text, r.sources (link each summary to them), r.ran (where it ran)',
    '  const m = await match(needs, offers);                           // m.pairs: [{need, offer, why}] — the app decides, people confirm',
    '  const p = await resurface(items, "what we decided about the gate"); // p.picks: item ids worth showing now',
    '  // ask(messages, system, {maxTokens, sources}) for a job the three above do not cover — still give it a named button',
    '  ```',
    '  Rules for built apps on this branch: (1) **Bounded jobs, not a chatbot.** Expose named actions ("Summarize this week\'s notes", "Find a match", "What did we decide?") rather than an open prompt box, unless the person building explicitly asks for a chat. (2) **Keep the record checkable.** Any text the model wrote is shown with links or references to the notes, posts or recordings it came from (`sources`); never show generated text as if a person wrote it. (3) **Say where it ran.** Show `aiRuntimeLabel()` in a small footer or settings line, and when `r.ran.fellBack` is true say the community answered because the local model was not reachable. (4) **Fail plainly.** Catch `AIUnavailableError` and show its `message` as-is: it is written for the person; no spinner forever, no retry loop. (5) AI runs only on a person\'s explicit action, never on page load or on every keystroke, and results worth keeping are saved rather than regenerated.',
  ].join('\n');
}
