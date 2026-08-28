/**
 * The frozen plan-phase scenarios — the inputs that stay constant so plan
 * runs are comparable over time.
 *
 * Three stances a person actually arrives in, one scenario each:
 *  1. a "normal" neighborhood PROJECT (organizing first, artifacts follow)
 *  2. a "normal" relational-tech TOOL request (a clear thing to build)
 *  3. an open-ended STARTER (a seed — the right reply explores, it does
 *     not draft)
 *
 * The two draft scenarios script the shaping conversation (the assistant's
 * questions and the person's one-tap answers, in production's
 * "question → answer" format) so the measured generation is the drafted
 * plan itself — plan mode's contract says the draft comes only after the
 * questions are answered. The starter is a single turn: the measured
 * generation is the exploration reply.
 *
 * STABILITY: never edit a scenario's turns or the meaning of its checks in
 * place — bump PLAN_SCENARIOS_VERSION and note the change. Reports carry
 * the version; never compare across versions.
 */

export const PLAN_SCENARIOS_VERSION = 'p1';

export interface PlanScenario {
  id: string;
  description: string;
  /** Frozen conversation; the last turn is the user's. Scripted assistant
   *  turns are exploration questions, deliberately NOT flagged isPlan —
   *  topic derivation must ride the person's founding ask. */
  turns: { role: 'user' | 'assistant'; content: string }[];
  /** The reply shape plan mode's own contract calls for at this point */
  expect: 'draft' | 'explore';
}

export const PLAN_SCENARIOS: PlanScenario[] = [
  {
    id: 'neighborhood-project',
    description:
      'A normal neighborhood project ask — organizing before software; the plan should commit to inviting artifacts',
    turns: [
      {
        role: 'user',
        content:
          'I want to start a community garden with the neighbors on my block. ' +
          "There's an empty lot on Hartwell Street the owner says we can use, " +
          'and about six families seem interested. Where do I start?',
      },
      {
        role: 'assistant',
        content: [
          'A garden with a real lot and six interested families is already further along than most starts — the first job now is inviting, not coordination software. A few decisions shape what we make first:',
          '',
          '## Question for you',
          '1. What should we make first to help you invite people in?',
          '   - A flyer for the block',
          '   - A landing page neighbors can visit',
          '   - A draft invitation message',
          '   - An outreach plan for the first two weeks',
          '2. Is there a first gathering this could point to?',
          '   - A Saturday workday at the lot',
          '   - A planning potluck at someone’s house',
          '   - Nothing set yet',
          '3. Which of these does it look like?',
          '   - A hand-painted garden sign — deep green ground, painted lettering, soft edges',
          '   - The civic bulletin board at the library — cool white, ink navy, square corners',
          '   - A seed catalog — warm cream, botanical line drawings, fine serif',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          'What should we make first to help you invite people in? → A flyer for the block, and an outreach plan',
          'Is there a first gathering this could point to? → A Saturday workday at the lot — first Saturday in October',
          'Which of these does it look like? → A hand-painted garden sign — deep green ground, painted lettering, soft edges',
        ].join('\n'),
      },
    ],
    expect: 'draft',
  },
  {
    id: 'rt-tool-request',
    description:
      'A normal relational-tech tool ask — a lending board with the shaping answers in hand; the plan should draft',
    turns: [
      {
        role: 'user',
        content:
          'Our block already has a group chat but things get lost in it. I want ' +
          'a lending board — a place where neighbors can offer stuff like ' +
          'ladders and folding tables, and ask to borrow things, so we stop ' +
          'all buying the same tools.',
      },
      {
        role: 'assistant',
        content: [
          'A lending board is a classic piece of relational tech — the software matters less than the moment two neighbors meet on a porch to hand over a ladder. Two decisions shape the build most:',
          '',
          '## Question for you',
          '1. Who can post offers and asks?',
          '   - Any neighbor, right away',
          '   - Neighbors suggest, you approve',
          '   - Just you at first, to seed it',
          '2. Which of these does it look like?',
          '   - The corkboard at the hardware store — plywood tan, hand-pinned cards, sturdy stencil type',
          '   - The civic bulletin at the library — cool white, ink navy, one red flag color, square corners',
          '   - A copy-shop zine — marigold paper, near-black chunky type, stamps and hard edges',
        ].join('\n'),
      },
      {
        role: 'user',
        content: [
          'Who can post offers and asks? → Any neighbor, right away',
          'Which of these does it look like? → The corkboard at the hardware store — plywood tan, hand-pinned cards, sturdy stencil type',
        ].join('\n'),
      },
    ],
    expect: 'draft',
  },
  {
    id: 'open-ended-starter',
    description:
      'An open-ended seed — the right reply explores (directions + questions), and does not draft a plan',
    turns: [
      {
        role: 'user',
        content:
          'I keep thinking my street could feel more like an actual ' +
          'neighborhood. People wave, but nobody really knows each other. ' +
          "I don't know what to build, or whether building anything is even " +
          'the right move.',
      },
    ],
    expect: 'explore',
  },
];

export function resolvePlanScenarios(csv: string | undefined): PlanScenario[] {
  if (!csv) return PLAN_SCENARIOS;
  const wanted = csv.split(',').map(s => s.trim()).filter(Boolean);
  const unknown = wanted.filter(w => !PLAN_SCENARIOS.some(s => s.id === w));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown plan scenario(s): ${unknown.join(', ')}. Known: ${PLAN_SCENARIOS.map(s => s.id).join(', ')}`,
    );
  }
  return wanted.map(w => PLAN_SCENARIOS.find(s => s.id === w)!);
}
