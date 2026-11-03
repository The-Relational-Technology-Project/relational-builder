/**
 * What the model is told about AI in built apps when the human-scale flag
 * is on. Goes into the same connected-services guidance list as the
 * Community Cloud blocks (ChatPanel), after them, so it overrides their
 * `askAI` snippet with the kit helper and the bounded-jobs rule.
 */

import { describeRuntime, type ProjectRuntime } from './runtime';

/**
 * Build rules added to the system prompt when the flag is on. Written for
 * small open models from what the bench saw them do (Oct 30 and 31, 2026):
 * every failure on the comparison prompts was an import, and the two the
 * static guard cannot repair are a file named but never written and an app
 * collapsed into one HTML file. Opus does not need these; they cost it
 * nothing. Measured by the bench with VITE_HUMAN_SCALE=1.
 */
export const HUMAN_SCALE_BUILD_RULES = [
  '## Imports, exactly (this build is checked by a static import pass before it is shown)',
  '',
  '- Every file you import must be in this same reply. Before you finish, read back every `import` line you wrote and confirm the file exists in the reply or in the kit. A page you planned but did not write is a blank screen.',
  '- The kit components export NAMES, never a default: `import { Button } from \'@/components/ui/button\'`, `import { AppBar, AppBarTitle } from \'@/components/ui/app-bar\'`, `import { EmptyState } from \'@/components/ui/empty-state\'`. `select` is a styled native `<select>`: there is no `SelectContent` or `SelectItem`; use `<option>`. `avatar` has no `AvatarFallback`; use `<Avatar name=... />`.',
  '- `zustand` and `lucide-react` export names only: `import { create } from \'zustand\'`, `import { Calendar, Users } from \'lucide-react\'`. Only import icons that exist in lucide-react; when unsure, use a common one (Calendar, Users, Plus, Check, MapPin, Heart, Home, List).',
  '- Every component you use in JSX must be imported or declared in that file. A `<Calendar />` with no import is a crash, not a warning.',
  '- An app-class request is always the multi-file app stack (`/src/main.tsx`, `/src/App.tsx`, `/src/index.css`, pages and components). Never answer an app request with a single HTML file.',
  '- Never write files under `src/components/ui/` or `src/lib/` unless the person asked to customize a kit component. The kit already provides them; a rewritten `avatar.tsx` or `button.tsx` that imports a helper the kit does not have (`@/lib/cn`) breaks every page that uses it. Import the kit, do not re-create it.',
].join('\n');

export function humanScaleAiGuidance(runtime: ProjectRuntime | null): string {
  const rt = runtime ?? { kind: 'community' as const, fallback: 'none' as const };
  return [
    '- **AI in this app goes through the kit helper `@/lib/ai`, not a hand-written `askAI`.** This project\'s runtime setting is: ' + describeRuntime(rt) + ' The helper reads that setting from the app\'s public env and routes the call; never write fetch code for AI yourself, never reference provider keys or endpoints in app code, and never let the app silently use a hosted frontier model.',
    '  ```ts',
    '  import { summarize, match, resurface, ask, aiRuntimeLabel, aiFootprintLabel, AIUnavailableError } from "@/lib/ai";',
    '  const r = await summarize(notesText, { sources: noteIds });   // r.text, r.sources (link each summary to them), r.ran (where it ran)',
    '  const m = await match(needs, offers);                           // m.pairs: [{need, offer, why}] — the app decides, people confirm',
    '  const p = await resurface(items, "what we decided about the gate"); // p.picks: item ids worth showing now',
    '  // ask(messages, system, {maxTokens, sources}) for a job the three above do not cover — still give it a named button',
    '  ```',
    '  Rules for built apps on this branch: (1) **Bounded jobs, not a chatbot.** Expose named actions ("Summarize this week\'s notes", "Find a match", "What did we decide?") rather than an open prompt box, unless the person building explicitly asks for a chat. (2) **Keep the record checkable.** Any text the model wrote is shown with links or references to the notes, posts or recordings it came from (`sources`); never show generated text as if a person wrote it. (3) **Say where it ran, and how much.** Show `aiRuntimeLabel()` and `aiFootprintLabel()` in a small footer or settings line (the footprint is the helper\'s own count of calls from this browser; read it after each call), and when `r.ran.fellBack` is true say the community answered because the local model was not reachable. (4) **Fail plainly.** Catch `AIUnavailableError` and show its `message` as-is: it is written for the person; no spinner forever, no retry loop. (5) AI runs only on a person\'s explicit action, never on page load or on every keystroke, and results worth keeping are saved rather than regenerated.',
  ].join('\n');
}
