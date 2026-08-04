/**
 * The retrieval golden set — frozen queries with expectations against the
 * live RT Commons corpus.
 *
 * Four kinds of case, mirroring what the Builder actually sends:
 *  - build / plan-seed asks that SHOULD surface specific entries (recall)
 *  - exact-term keyword queries where the full-text arm must fire (the
 *    text-arm canary: if these come back semantic-only, the FTS half of the
 *    hybrid search has regressed)
 *  - mid-build edits and off-topic asks that should surface NOTHING after
 *    the relevance floor (noise leakage)
 *
 * Expected slugs are real rows in commons_items (status=canonical), chosen
 * from the corpus as of 2026-08. When the commons grows, a failing case can
 * mean either a retrieval regression or a corpus change — check which before
 * editing an expectation, and bump GOLDEN_VERSION when expectations move so
 * runs stay comparable.
 */

export const GOLDEN_VERSION = 'v1';

export interface GoldenCase {
  id: string;
  category: 'build' | 'plan-seed' | 'exact-term' | 'edit' | 'off-topic';
  /** Which mode's kind-weighting to apply in selectRelevant */
  mode: 'plan' | 'build';
  query: string;
  /** Slugs expected in the post-pipeline top K (K = 5 for build/exact, 8 for seeds).
   *  Recall counts a case as a hit when ANY expected slug appears. */
  expect?: string[];
  /** The pipeline should return zero results for this query */
  expectEmpty?: boolean;
  /** exact-term only: the top post-pipeline hit must be a text/both match */
  textArmCanary?: boolean;
}

export const GOLDEN: GoldenCase[] = [
  // ── Build asks: retrieval should find the obvious precedents ──────────
  {
    id: 'mutual-aid-board',
    category: 'build',
    mode: 'plan',
    query: 'I want to build a mutual aid board where neighbors can post asks and offers',
    expect: ['mutual-aid-pod', 'buy-nothing-group', 'asking-for-help-offering-support'],
  },
  {
    id: 'event-calendar',
    category: 'build',
    mode: 'plan',
    query: "a neighborhood event calendar so people know what's happening",
    expect: ['our-neighborhood-today', 'neighborhood-today-calendar'],
  },
  {
    id: 'tool-lending',
    category: 'build',
    mode: 'plan',
    query: 'a way for neighbors to lend and borrow tools and equipment',
    expect: ['tool-library', 'buy-nothing-group', 'library-of-things'],
  },
  {
    id: 'welcome-newcomers',
    category: 'build',
    mode: 'plan',
    query: 'something to welcome new neighbors when they move onto the street',
    expect: ['welcome-wagon', 'welcome-group-program', 'welcome-groups-training-manual'],
  },
  {
    id: 'skill-swap',
    category: 'build',
    mode: 'plan',
    query: 'neighbors teaching each other skills — cooking, bike repair, gardening',
    expect: ['skillshare', 'skillshare-event', 'how-to-organize-a-skillshare', 'repair-cafe'],
  },
  {
    id: 'time-exchange',
    category: 'build',
    mode: 'plan',
    query: 'an hour-for-hour service exchange where helping a neighbor earns credit',
    expect: ['time-banking'],
  },
  {
    id: 'community-fridge',
    category: 'build',
    mode: 'plan',
    query: 'organize a shared fridge where anyone can leave or take food',
    expect: ['community-fridge', 'community-fridges-public-food-sharing', 'little-free-pantry'],
  },
  {
    id: 'neighborhood-walk',
    category: 'build',
    mode: 'plan',
    query: 'a walking tour where longtime residents share the history of our streets',
    expect: ['janes-walk', 'format-walking-tour', 'neighborhood-history-and-future-walking-app'],
  },

  // ── Plan seeds: vague asks that should still land in the right shelf ──
  {
    id: 'seed-block-food',
    category: 'plan-seed',
    mode: 'plan',
    query: 'something for my block, maybe around food?',
    expect: ['block-party', 'block-stewards', 'community-fridge', 'story-sharing-potluck-supper', 'reinvent-the-potluck'],
  },
  {
    id: 'seed-lonely-seniors',
    category: 'plan-seed',
    mode: 'plan',
    query: 'help seniors on my street feel less alone',
    expect: [], // open: any results are plausible — this case only tracks the sim distribution
  },
  {
    id: 'seed-know-neighbors',
    category: 'plan-seed',
    mode: 'plan',
    query: 'I want neighbors to actually know each other, not sure what shape yet',
    expect: [],
  },

  // ── Exact-term keyword queries: the text arm must fire ────────────────
  {
    id: 'exact-skillshare',
    category: 'exact-term',
    mode: 'build',
    query: 'skillshare',
    expect: ['skillshare', 'skillshare-event', 'how-to-organize-a-skillshare'],
    textArmCanary: true,
  },
  {
    id: 'exact-block-party',
    category: 'exact-term',
    mode: 'build',
    query: 'block party',
    expect: ['block-party', 'block-party-organizing'],
    textArmCanary: true,
  },
  {
    id: 'exact-time-banking',
    category: 'exact-term',
    mode: 'build',
    query: 'time banking',
    expect: ['time-banking'],
    textArmCanary: true,
  },
  {
    id: 'exact-repair-cafe',
    category: 'exact-term',
    mode: 'build',
    query: 'repair cafe',
    expect: ['repair-cafe'],
    textArmCanary: true,
  },

  // ── Mid-build edits: the floor should clear everything ────────────────
  {
    id: 'edit-header-color',
    category: 'edit',
    mode: 'build',
    query: 'make the header blue and move the button to the top',
    expectEmpty: true,
  },
  {
    id: 'edit-font-size',
    category: 'edit',
    mode: 'build',
    query: 'the text is too small on my phone, make it bigger',
    expectEmpty: true,
  },
  {
    id: 'edit-typo',
    category: 'edit',
    mode: 'build',
    query: 'change "Welcom" to "Welcome" in the title',
    expectEmpty: true,
  },
  {
    id: 'edit-remove-footer',
    category: 'edit',
    mode: 'build',
    query: 'remove the footer and make the cards rounder',
    expectEmpty: true,
  },
  {
    id: 'edit-loading-bug',
    category: 'edit',
    mode: 'build',
    query: 'the submit button spins forever after clicking it',
    expectEmpty: true,
  },

  // ── Off-topic asks: nothing in the commons should survive ─────────────
  {
    id: 'off-habit-tracker',
    category: 'off-topic',
    mode: 'plan',
    query: 'a habit tracker for my morning routine',
    expectEmpty: true,
  },
  {
    id: 'off-invoice-tool',
    category: 'off-topic',
    mode: 'plan',
    query: 'an invoice generator for my freelance design work',
    expectEmpty: true,
  },
  {
    id: 'off-workout-log',
    category: 'off-topic',
    mode: 'plan',
    query: 'log my gym workouts and track personal records',
    expectEmpty: true,
  },
  {
    id: 'off-crypto',
    category: 'off-topic',
    mode: 'plan',
    query: 'a dashboard showing live cryptocurrency prices',
    expectEmpty: true,
  },
];
