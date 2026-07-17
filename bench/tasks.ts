import {
  CHECKS,
  EXPECTED_PREVIEW_KIND,
  PROMPT,
  TASK_ID,
  TASK_VERSION,
  type TaskCheck,
} from './task';

/**
 * Task registry. The frozen headline task (bench/task.ts) is entry one and
 * its stability rules stand. Experiment tasks carry their own `version`
 * (`exp-*`) so their numbers are never mistaken for headline-task numbers.
 *
 * Experiment tasks reuse the generic quality checks — theme tokens, kit
 * usage, router choice, seeded data, no-backend — which are task-agnostic.
 */

export interface TaskSpec {
  id: string;
  version: string;
  prompt: string;
  expectedPreviewKind: string;
  checks: TaskCheck[];
}

/** Sent after the plan reply when a run uses --plan-first (mirrors a
 *  builder reading the plan and saying go). */
export const BUILD_GO_PROMPT = 'Looks good — build it.';

export const TASKS: TaskSpec[] = [
  {
    id: TASK_ID,
    version: TASK_VERSION,
    prompt: PROMPT,
    expectedPreviewKind: EXPECTED_PREVIEW_KIND,
    checks: CHECKS,
  },
  {
    // From the RT commons library: "Block Party Organizing" — sign-ups,
    // task coordination, event planning. Place-grounded per experiment.
    id: 'pdx-block-party',
    version: 'exp-v1',
    prompt:
      'Build a block party organizing app for our street in the Montavilla ' +
      'neighborhood of Portland, OR: neighbors can RSVP, sign up to bring food ' +
      'or gear, claim setup and cleanup tasks, and see the day-of schedule. ' +
      'Aesthetic: Pacific Northwest — mossy greens, warm cedar tones, cozy ' +
      'even when it drizzles. Seed it with realistic example neighbors and ' +
      'tasks, and make it work great on phones.',
    expectedPreviewKind: 'framework',
    checks: CHECKS,
  },
  {
    // From the RT commons library: "Neighbor Story Sharing" — personal
    // narratives strengthening community bonds. Content-first UI.
    id: 'pdx-story-porch',
    version: 'exp-v1',
    prompt:
      'Build a neighbor story-sharing site for the Montavilla neighborhood of ' +
      'Portland, OR — a digital front porch where neighbors post short stories, ' +
      'memories, and dreams about the neighborhood, browse by theme, and leave ' +
      'a warm response. Content-first and readable, like a small literary zine: ' +
      'Pacific Northwest palette, generous type, no engagement mechanics. Seed ' +
      'it with a handful of realistic stories. Works beautifully on phones.',
    expectedPreviewKind: 'framework',
    checks: CHECKS,
  },
];

export function resolveTasks(csv: string | undefined): TaskSpec[] {
  if (!csv) return [TASKS[0]];
  const wanted = csv.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = wanted.filter(w => !TASKS.some(t => t.id === w));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown task id(s): ${unknown.join(', ')}. Known: ${TASKS.map(t => t.id).join(', ')}`,
    );
  }
  return wanted.map(w => TASKS.find(t => t.id === w)!);
}
