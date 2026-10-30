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
  // --- Human-scale branch, workstream 2 (Oct 30, 2026): representative
  //     commons builds, one task per tool-shaped commons item (slugs in
  //     scripts/geotag/places.json), each grounded in a real place the way
  //     builders actually ask. With the four experiment tasks above that is
  //     18 builds. Generic checks; exp-v1 so they never read as headline
  //     numbers. ---
  ...([
    ['hs-community-fridge', 'community-fridge',
      'Build a community fridge app for the fridge outside the laundromat on ' +
      'Judah St in the Outer Sunset, San Francisco: anyone can post what they ' +
      'just stocked or what is running low, volunteers claim cleaning and ' +
      'restocking shifts, and there is a simple "fridge is full / fridge is ' +
      'empty" status on the front. Foggy-coastal palette, big friendly type, ' +
      'phone-first. Seed it with realistic recent updates and a week of shifts.'],
    ['hs-meal-train', 'meal-train',
      'Build a meal train for a family on our block in Lawrence, Massachusetts ' +
      'whose dad just had surgery: a calendar of dinner slots neighbors can ' +
      'claim, dietary notes and a drop-off spot the family set once, a place to ' +
      'leave a short note with each meal, and a gentle reminder of who is up ' +
      'next. Warm, simple, works on an old phone. Seed it with two weeks of ' +
      'slots, some claimed and some open.'],
    ['hs-library-of-things', 'library-of-things-toolkit',
      'Build a library of things for the Montavilla neighborhood in Portland, ' +
      'OR: neighbors list tools and gear they will lend (ladder, pressure ' +
      'washer, folding tables, a sewing machine), others request to borrow for ' +
      'a date range, and each item shows who stewards it and its condition. ' +
      'Earthy Pacific Northwest look. Seed it with twenty realistic items and a ' +
      'few open requests.'],
    ['hs-asset-map', 'neighborhood-asset-map',
      'Build a neighborhood asset map for Edmonton\'s Ritchie community: a map ' +
      'and a list of the places and people that hold the neighborhood together ' +
      '(the community league hall, a corner store that lets kids run tabs, a ' +
      'retired nurse, the tool-lending shed), each with a short story of why it ' +
      'matters and who added it. Anyone can add an asset; a steward can tidy. ' +
      'Prairie-winter palette, works on phones. Seed with a dozen assets.'],
    ['hs-mutual-aid-intake', 'build-mutual-aid-intake',
      'Build a mutual aid intake and matching tool for Bed-Stuy, Brooklyn: ' +
      'neighbors post a need (groceries, a ride, a phone call, help with a ' +
      'form) or an offer, a small team of coordinators sees open needs, ' +
      'matches each to an offer, and marks it done, and the person who asked ' +
      'can see where their request stands without an account. Dignified, ' +
      'never bureaucratic. Seed it with realistic needs and offers.'],
    ['hs-neighborhood-calendar', 'neighborhood-today-calendar',
      'Build a "what is happening today" calendar for Ithaca, NY\'s Fall Creek ' +
      'neighborhood: a single scrolling day view first, then the week, with ' +
      'events anyone can add (porch concerts, the farm stand, a library ' +
      'story hour, a block cleanup), each tagged by who it is for. A ' +
      'print-friendly weekly view for the laundromat bulletin board. Autumn ' +
      'palette. Seed it with a full week of real-feeling events.'],
    ['hs-help-desk', 'community-help-desk',
      'Build a community help desk for the Hilltop neighborhood in Tacoma, WA: ' +
      'neighbors ask a question (where do I report a streetlight, who can fix a ' +
      'bike, is the clinic open Saturdays), volunteer answerers claim it and ' +
      'reply, and good answers are kept as a browsable neighborhood FAQ with ' +
      'the name of the neighbor who answered. Friendly and plain. Seed it with ' +
      'a dozen answered questions and a few open ones.'],
    ['hs-promise-tracker', 'promise-tracker',
      'Build a promise tracker for the Logan Square neighborhood council in ' +
      'Chicago: the public commitments the alderman and city departments made ' +
      'at meetings (fix the crosswalk by June, fund the garden), each with a ' +
      'date, a status neighbors update with evidence, and a timeline of what ' +
      'happened. Firm but fair in tone, printable. Seed it with eight promises ' +
      'in different states.'],
    ['hs-babysitting-coop', 'babysitting-co-op',
      'Build a babysitting co-op for a dozen families in Decatur, Georgia: ' +
      'families earn and spend points by sitting for each other, post requests ' +
      'for a date and time, see who is free, and keep a simple ledger everyone ' +
      'can check. Trust and clarity over features. Seed it with real-feeling ' +
      'families, a month of sits, and a couple of open requests.'],
    ['hs-listening-wall', 'neighborhood-listening-wall',
      'Build a neighborhood listening wall for Frome, England: three big ' +
      'questions the town council is asking this season, where anyone can pin a ' +
      'short answer (with a first name or anonymously), read others\', and ' +
      'add a "me too". Organizers can group answers into themes and publish ' +
      'what they heard. Calm, readable, no voting. Seed it with sixty short ' +
      'responses across the three questions.'],
    ['hs-front-porch-digest', 'build-front-porch-digest',
      'Build a weekly front porch digest for Peoria, Illinois\'s West Bluff: ' +
      'neighbors submit short items through the week (a lost cat, a garage ' +
      'sale, thanks to whoever shoveled the corner), an editor arranges them ' +
      'into Friday\'s issue, and the issue reads like a small newsletter on a ' +
      'phone and prints to one page. Keep an archive of past issues. Seed it ' +
      'with three past issues and this week\'s submissions.'],
    ['hs-block-preparedness', 'map-your-neighborhood',
      'Build a block emergency preparedness plan for our street in Central ' +
      'Oregon: who has a generator, medical training, a chainsaw, a spare ' +
      'room; who may need a check-in (lives alone, uses oxygen); a gathering ' +
      'point; and a simple check-in board that works when the power is out and ' +
      'phones are on their last bar. Calm, high contrast, offline-friendly. ' +
      'Seed it with a realistic block of fourteen households.'],
  ] as const).map(([id, , prompt]) => ({
    id,
    version: 'exp-v1',
    prompt,
    expectedPreviewKind: 'framework',
    checks: CHECKS,
  })),
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
