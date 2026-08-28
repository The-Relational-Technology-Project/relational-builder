import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { runPlanChecks } from './lib/plan-checks';
import { writePlanReport } from './lib/plan-report';
import { writePlanReviewPage } from './lib/plan-review-page';
import type { PlanRunReport } from './plan-types';
import { weightedComposite } from './plan-types';

/**
 * Plan-bench selftest — the whole scoring pipeline on canned replies, no
 * network, no keys, no cost:
 *
 *  1. mechanical checks against known-good and known-bad fixtures for both
 *     expected shapes (draft / explore)
 *  2. the report and review-page writers on a fake run — including a syntax
 *     compile of the review page's embedded script, which is generated from
 *     an escaped template literal and would otherwise only break in a
 *     browser after a paid run
 *  3. the composite weighting formula
 */

const GOOD_DRAFT = `Here is the plan for the garden, shaped by everything you told me.

## The vision

On the first Saturday in October, six families walk down to the empty lot on Hartwell Street carrying shovels and a thermos, because a flyer on the corkboard told them exactly where and when. By spring, the fence has a hand-painted sign, the beds have names on them, and neighbors who had only waved are trading tomatoes. The Adopt-a-Bed recipe from the commons shaped how the plots are offered: each bed belongs to a household, and the path between them belongs to everyone.

## People & practices

You are the tender of this project for now — the person whose name is on the flyer. The practice that matters most is the monthly workday, not any screen: the garden grows at the pace of gatherings. The commons story of the Alvarado lot garden warns that gardens die when one person holds every key, so the plan names two other families as co-stewards from day one.

## Artifacts

**First build**
- A flyer for the block — print-ready for the laundromat and the school gate
- An outreach plan for the first two weeks — who to invite first, where to post, what to say

**Later**
- A landing page neighbors can visit when the flyer sends them looking
- A bed-signup sheet, once there are beds to sign up for
- The full coordination tool — earned only when the garden itself outgrows a group chat

## Look & feel

This is a hand-painted garden sign, not an app. The ground is a deep leaf green (#1F3D2B), the ink a warm off-white (#F5F1E6), and the one signal color a marigold (#E8A33D) reserved for the date and the "come by" line. Type pairs Fraunces for display with Karla for body — painted-letter warmth over plain legibility. Edges are soft, borders hand-drawn heavy, spacing generous like a sign you read from across the street.

## The first screen

The flyer IS the first screen: the garden's name, the lot's address, the October workday date, and one line — "bring gloves if you have them." Deliberately not on it: any explanation of what a community garden is, any URL longer than a breath, any signup demand before the first hello.

## Pages & files

- materials/flyer.html — the printable flyer
- program/outreach-plan.md — the two-week outreach plan

## Data & services

Nothing needs a backend. The flyer prints; the outreach plan is words. When the landing page arrives later, it can still be a plain page — no env vars, no services, until real signups earn them.

Refine anything above, or press **Build this plan** when it feels right.

PROJECT-NAME: Hartwell Street Garden`;

const BAD_DRAFT = `Great idea! Here is your plan.

## Features

**First build**
- Login system
- User profiles
- Admin dashboard
- Notifications
- Calendar
- Messaging
- Photo gallery
- Analytics

\`\`\`html filename="index.html"
<h1>Garden</h1>
\`\`\`

## Question for you
1. What color?

PROJECT-NAME: Community Garden App
PROJECT-NAME: Garden App`;

const GOOD_EXPLORE = `Streets like yours usually don't need an app first — they need one small excuse to knock. A few directions this could go, each borrowed from another neighborhood: a front-porch signal (the Porch Lights pattern — one lamp means "come say hi"), a tiny street newsletter someone photocopies, or a shared-meal rotation that starts with just three houses.

## Question for you
1. What already happens on your street, even a little?
   - A few people garden out front
   - Kids play outside sometimes
   - Honestly, nothing visible yet
2. Which first moment feels right?
   - One small gathering to test the water
   - Something printed neighbors find on their door
   - A quiet signal people can opt into`;

const BAD_EXPLORE = GOOD_DRAFT; // drafting a full plan at a seed is the failure

interface Expectation {
  name: string;
  reply: string;
  shape: 'draft' | 'explore';
  surfaced: number;
  mentioned: number;
  /** check id → expected pass */
  expect: Record<string, boolean>;
}

const CASES: Expectation[] = [
  {
    name: 'good draft',
    reply: GOOD_DRAFT,
    shape: 'draft',
    surfaced: 3,
    mentioned: 2,
    expect: {
      'no-file-blocks': true,
      'no-flattery-open': true,
      'commons-grounded': true,
      'sections-present': true,
      'project-name': true,
      'first-build-restraint': true,
      'look-concrete': true,
      'no-question-section': true,
      'invites-build': true,
      'size-band': true,
    },
  },
  {
    name: 'bad draft',
    reply: BAD_DRAFT,
    shape: 'draft',
    surfaced: 3,
    mentioned: 0,
    expect: {
      'no-file-blocks': false,
      'no-flattery-open': false,
      'commons-grounded': false,
      'sections-present': false,
      'project-name': false,
      'first-build-restraint': false,
      'look-concrete': false,
      'no-question-section': false,
      'invites-build': false,
      'size-band': false,
    },
  },
  {
    name: 'good explore',
    reply: GOOD_EXPLORE,
    shape: 'explore',
    surfaced: 2,
    mentioned: 1,
    expect: {
      'no-file-blocks': true,
      'no-flattery-open': true,
      'commons-grounded': true,
      'does-not-draft': true,
      'question-format': true,
      'explore-brevity': true,
    },
  },
  {
    name: 'bad explore (drafted at a seed)',
    reply: BAD_EXPLORE,
    shape: 'explore',
    surfaced: 0,
    mentioned: 0,
    expect: {
      'does-not-draft': false,
      'question-format': false,
      'explore-brevity': false,
    },
  },
  {
    name: 'draft with nothing surfaced (commons auto-pass)',
    reply: GOOD_DRAFT,
    shape: 'draft',
    surfaced: 0,
    mentioned: 0,
    expect: { 'commons-grounded': true },
  },
];

function fakeRun(): PlanRunReport {
  const base = {
    providerId: 'claude',
    modelId: 'claude-fable-5',
    scenarioVersion: 'p-selftest',
    trial: 1,
    startedAt: new Date().toISOString(),
    latencyMs: 30_000,
    ttftMs: 2_000,
    finishReason: 'stop',
    estTokens: { input: 15_000, output: 800, estimated: true as const },
    estCostUsd: 0.19,
    retrieval: {
      query: 'community garden on my block',
      dropped: 4,
      surfaced: [
        { slug: 'adopt-a-bed', title: 'Recipe: Adopt-a-Bed', kind: 'recipe', similarity: 0.71 },
      ],
    },
    judge: {
      model: 'claude-sonnet-5',
      referenced: ['Recipe: Adopt-a-Bed'],
      fabricated: [],
      notes: 'clean',
      estCostUsd: 0.02,
    },
    error: null,
  };
  return {
    planBenchVersion: 'selftest',
    scenariosVersion: 'p-selftest',
    gitCommit: 'selftest',
    createdAt: new Date().toISOString(),
    runId: 'selftest',
    config: { trials: 1, judge: 'claude-sonnet-5' },
    models: [
      { alias: 'claude-fable-5', providerId: 'claude', modelId: 'claude-fable-5', enabled: true },
    ],
    scenarios: [{ id: 'neighborhood-project', expect: 'draft' }],
    trials: [
      {
        ...base,
        alias: 'claude-fable-5',
        scenarioId: 'neighborhood-project',
        outputChars: GOOD_DRAFT.length,
        words: GOOD_DRAFT.split(/\s+/).length,
        mentionedTitles: ['Recipe: Adopt-a-Bed'],
        checks: runPlanChecks(GOOD_DRAFT, 'draft', 1, 1),
        planText: GOOD_DRAFT,
      },
    ],
  };
}

export async function runPlanSelftest(): Promise<number> {
  let failures = 0;
  const fail = (msg: string) => {
    failures++;
    console.error(`  FAIL ${msg}`);
  };

  console.log('Plan-bench selftest — mechanical checks on canned replies\n');
  for (const c of CASES) {
    const checks = runPlanChecks(c.reply, c.shape, c.surfaced, c.mentioned);
    console.log(`${c.name}:`);
    for (const [id, expected] of Object.entries(c.expect)) {
      const check = checks.find(x => x.id === id);
      if (!check) {
        fail(`${id} — check missing from ${c.shape} output`);
        continue;
      }
      if (check.pass !== expected) {
        fail(`${id} — expected ${expected ? 'pass' : 'fail'}, got ${check.pass ? 'pass' : 'fail'}${check.detail ? ` (${check.detail})` : ''}`);
      } else {
        console.log(`  ok   ${id} ${expected ? 'passes' : 'fails as it should'}`);
      }
    }
  }

  console.log('\nComposite weighting:');
  const comp = weightedComposite({ rtAlignment: 6, creativity: 8, overall: 9 });
  if (comp !== (6 + 8 + 18) / 4) fail(`weightedComposite: expected 8, got ${comp}`);
  else console.log('  ok   (6 + 8 + 2×9)/4 = 8');
  if (weightedComposite({ rtAlignment: 6, creativity: 8 }) !== null) {
    fail('weightedComposite: partial scores must yield null');
  } else console.log('  ok   partial scores → null');

  console.log('\nReport + review page writers on a fake run:');
  const outDir = path.resolve('bench/results/selftest/plan');
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  const run = fakeRun();
  try {
    await writePlanReport(outDir, run, {
      runId: 'selftest',
      reviewer: 'selftest',
      scores: { 'claude-fable-5': { 'neighborhood-project': { rtAlignment: 7, creativity: 7, overall: 8, notes: 'canned' } } },
    });
    const report = await readFile(path.join(outDir, 'report.md'), 'utf8');
    for (const needle of ['Plan bench — selftest', 'Commons drawn', 'scored by selftest', '7.5']) {
      if (!report.includes(needle)) fail(`report.md missing "${needle}"`);
    }
    if (failures === 0) console.log('  ok   report.md written and scored composite (7.5) merged');
  } catch (err) {
    fail(`report writer threw: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    await writePlanReviewPage(outDir, run);
    const page = await readFile(path.join(outDir, 'review', 'index.html'), 'utf8');
    const script = /<script>([\s\S]*)<\/script>/.exec(page)?.[1];
    if (!script) fail('review page has no inline script');
    else {
      // Compile (not execute) the embedded script — catches escaping bugs in
      // the generated JS without a browser
      new Function(script);
      console.log('  ok   review/index.html written; embedded script compiles');
    }
    for (const needle of ['RT alignment', 'Overall (×2)', '2×Overall']) {
      if (!page.includes(needle)) fail(`review page missing "${needle}"`);
    }
  } catch (err) {
    fail(`review page: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (failures > 0) {
    console.error(`\nPLAN SELFTEST: ${failures} failure(s).`);
    return 1;
  }
  console.log('\nPlan selftest passed.');
  return 0;
}
