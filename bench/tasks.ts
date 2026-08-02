import {
  CHECKS,
  EXPECTED_PREVIEW_KIND,
  PROMPT,
  TASK_ID,
  TASK_VERSION,
  type TaskCheck,
} from './task';
import { EDIT_SEED_FILES, EDIT_SEED_VERSION, EDIT_TASKS } from './edit-task';

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
  /** Edit tasks start from a frozen project instead of an empty one. When
   *  set, the run sends the production build prompt WITH this snapshot in
   *  its Current Project Files section, exactly as an edit turn does. */
  seedFiles?: Record<string, string>;
  /** Paths this edit may legitimately touch; anything else is collateral. */
  editTargets?: string[];
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

  // --- Thread Studio workshop dry-run (run these with --studio thread so the
  //     build sees Thread's frame + private library, like an approved member).
  //     A brand-new-prompt build and a gallery remix — the two shapes the
  //     in-person Thread × RTP workshop will actually produce. ---
  {
    // Fresh idea a workshop pair might bring: a clubs platform for the Thread
    // extended family. New prompt (no seed item) — first-build from scratch.
    id: 'thread-clubs',
    version: 'exp-v1',
    prompt:
      "I want to build a platform for clubs within the Thread extended family " +
      "here in Baltimore. Anyone in the Thread community can propose a club, " +
      "check out clubs that other members have started, and join the ones they " +
      "like — book clubs, run clubs, a cooking circle, a coding club, whatever " +
      "people dream up. Each club has someone who proposes and runs it, a short " +
      "description, and members who've joined. And it should have a calendar of " +
      "upcoming club events you can browse and join, too. Make it warm and easy " +
      "on a phone, and seed it with a handful of real-feeling Thread clubs and " +
      "upcoming events so it doesn't look empty.",
    expectedPreviewKind: 'framework',
    checks: CHECKS,
  },
  {
    // Gallery remix: start from Thread Gatherings (the "roles to play" events
    // app — it rides in the studio library context) and add a rides layer, a
    // twist grounded in a real Thread access barrier. Mirrors what the remix
    // path seeds: a build ON an existing studio item.
    id: 'thread-gatherings-remix',
    version: 'exp-v1',
    prompt:
      "I want to remix Thread Gatherings — our events app with \"roles to " +
      "play\" — for my corner of the Thread family. Keep everything that makes " +
      "it warm (the roles to claim, the gentle propose-a-gathering flow, the " +
      "persona switcher, the Thread voice and amber/teal look), but add a ride " +
      "circle. Getting there is the number one thing that keeps our young " +
      "people from showing up, so make rides a first-class part of every " +
      "gathering: a driver can offer seats with a pickup spot and time, anyone " +
      "can claim a seat, and each event clearly shows who still needs a ride so " +
      "nobody gets left behind. Seed it so the rides feel real alongside the " +
      "existing gatherings and roles.",
    expectedPreviewKind: 'framework',
    checks: CHECKS,
  },
  // --- Edit tasks (bench/edit-task.ts): the same frozen seed project, three
  //     kinds of change. These measure restraint, not ambition — see the
  //     editDiscipline columns in the report. ---
  ...EDIT_TASKS.map(
    (e): TaskSpec => ({
      id: e.id,
      version: EDIT_SEED_VERSION,
      prompt: e.prompt,
      expectedPreviewKind: 'framework',
      checks: e.checks,
      seedFiles: EDIT_SEED_FILES,
      editTargets: e.targets,
    }),
  ),
];

/** Every edit task, for `--tasks edit` shorthand. */
export const EDIT_TASK_IDS = EDIT_TASKS.map(e => e.id);

export function resolveTasks(csv: string | undefined): TaskSpec[] {
  if (csv === 'edit') return TASKS.filter(t => EDIT_TASK_IDS.includes(t.id));
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
