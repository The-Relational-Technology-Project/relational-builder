import { parseArgs } from 'node:util';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildSystemPrompt } from '@/knowledge/context-builder';
import { retrieveCommonsContext, findMentionedResults } from '@/knowledge/retrieval';
import type { ChatMessage, LLMProvider } from '@/providers/types';
import { BENCH_MODELS, ENV_KEYS } from './models';
import { providerFor } from './lib/providers';

/**
 * Design eval (layer 2) — does surfaced commons knowledge actually land in
 * plans, honestly?
 *
 *   export ANTHROPIC_API_KEY=…
 *   npm run bench -- design-eval [--model claude-sonnet-5] [--judge claude-sonnet-5] [--dry-run]
 *
 * Each scenario runs the REAL pipeline: live retrieval through the
 * production policy (knowledge/retrieval.ts), the production plan-mode
 * system prompt (buildSystemPrompt), a real generation, then an LLM judge
 * with a narrow, factual rubric:
 *
 *  - referenced: which surfaced entries the plan genuinely drew on
 *  - fabricated: commons-ish citations that were NOT surfaced (the failure
 *    mode a prompt instruction alone can't prevent)
 *  - community_shoehorn: neighborhood framing dragged into a generic ask
 *
 * The model-quality bench (README) deliberately has no LLM judge — humans
 * judge "warm and neighborly" better than a rubric. This eval is different:
 * its questions are factual (did the plan name X? is Y in the list?), which
 * is exactly what an LLM judge is reliable for. A mechanical title-match
 * cross-check (findMentionedResults — the same matcher that drives the
 * production chips) rides along for corroboration.
 *
 * Cost: ~5 plan generations + 5 judge calls per run — well under $1 on
 * Sonnet. Trials vary (no temperature pinning, production parity), so treat
 * a single failure as a flag to re-run, not a verdict.
 */

interface DesignScenario {
  id: string;
  description: string;
  /** The conversation; the last turn must be the user's */
  turns: { role: 'user' | 'assistant'; content: string; isPlan?: boolean }[];
  expect: {
    /** The plan should draw on at least one surfaced entry by name */
    shouldReference: boolean;
    /** Generic ask: no community shoehorn, and retrieval is expected empty */
    neutrality?: boolean;
  };
}

const SCENARIOS: DesignScenario[] = [
  {
    id: 'mutual-aid-seed',
    description: 'Clear community ask with strong commons precedents',
    turns: [{ role: 'user', content: 'I want to build a mutual aid board where neighbors can post asks and offers' }],
    expect: { shouldReference: true },
  },
  {
    id: 'food-block-seed',
    description: 'Vague seed — exploration should name commons examples',
    turns: [{ role: 'user', content: 'something for my block, maybe around food?' }],
    expect: { shouldReference: true },
  },
  {
    id: 'event-calendar',
    description: 'Direct ask with a near-exact commons precedent',
    turns: [{ role: 'user', content: "a neighborhood event calendar so people know what's happening around here" }],
    expect: { shouldReference: true },
  },
  {
    id: 'skillshare-followup',
    description: 'Follow-up turn — retrieval must ride the topic, not the answer',
    turns: [
      { role: 'user', content: 'neighbors teaching each other skills — cooking, bike repair, gardening' },
      { role: 'assistant', content: 'A few directions this could go: a one-day skillshare event, an ongoing class calendar, or a simple offers board. Which resonates?' },
      { role: 'user', content: 'the one-day event — people sign up to teach or learn' },
    ],
    expect: { shouldReference: true },
  },
  {
    id: 'habit-tracker',
    description: 'Generic ask — the plan must stay neutral and invent nothing',
    turns: [{ role: 'user', content: 'a habit tracker for my morning routine' }],
    expect: { shouldReference: false, neutrality: true },
  },
];

function resolveModel(alias: string) {
  const m = BENCH_MODELS.find(x => x.alias === alias || x.modelId === alias);
  if (!m) throw new Error(`Unknown model "${alias}" — see npm run bench -- --list-models`);
  return m;
}

function complete(provider: LLMProvider, messages: ChatMessage[], modelId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let text = '';
    provider
      .chat(messages, modelId, {
        onToken: t => { text += t; },
        onComplete: full => resolve(full || text),
        onError: reject,
      }, new AbortController().signal)
      .catch(reject);
  });
}

interface JudgeVerdict {
  referenced: string[];
  fabricated: string[];
  community_shoehorn: boolean;
  notes: string;
}

function judgePrompt(ask: string, surfacedTitles: string[], plan: string): string {
  const list = surfacedTitles.length > 0
    ? surfacedTitles.map((t, i) => `${i + 1}. ${t}`).join('\n')
    : '(none — the assistant had NO knowledge-base entries available for this ask)';
  return [
    'You are auditing whether an AI planning assistant used its knowledge base honestly. Be strict and literal.',
    '',
    'The person asked:',
    `"${ask}"`,
    '',
    'The assistant had EXACTLY these knowledge-base entries available (by title):',
    list,
    '',
    'The assistant replied with the plan below. Answer with STRICT JSON only, no markdown fences, matching:',
    '{"referenced": ["titles from the list the plan genuinely draws on — named outright, or their content clearly woven in"],',
    ' "fabricated": ["anything the plan cites as if it came from a knowledge base, commons, library, or another neighborhood\'s real project that is NOT in the list — generic suggestions and the plan\'s own invented app ideas do NOT count"],',
    ' "community_shoehorn": <true if the ask was NOT about community/neighbors but the plan dragged neighborhood or commons framing in anyway; false otherwise>,',
    ' "notes": "one sentence"}',
    '',
    '--- PLAN ---',
    plan,
  ].join('\n');
}

function parseVerdict(raw: string): JudgeVerdict | null {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const v = JSON.parse(match[0]) as Partial<JudgeVerdict>;
    return {
      referenced: Array.isArray(v.referenced) ? v.referenced.map(String) : [],
      fabricated: Array.isArray(v.fabricated) ? v.fabricated.map(String) : [],
      community_shoehorn: Boolean(v.community_shoehorn),
      notes: String(v.notes ?? ''),
    };
  } catch {
    return null;
  }
}

export async function runDesignEval(argv: string[]): Promise<number> {
  const { values } = parseArgs({
    args: argv,
    options: {
      model: { type: 'string', default: 'claude-sonnet-5' },
      judge: { type: 'string', default: 'claude-sonnet-5' },
      'dry-run': { type: 'boolean', default: false },
    },
  });
  const genModel = resolveModel(values.model!);
  const judgeModel = resolveModel(values.judge!);

  // Retrieval + prompt assembly always run (free); generations need keys
  const dryRun = values['dry-run'] ?? false;
  if (!dryRun && !process.env[ENV_KEYS[genModel.providerId]]) {
    console.error(`Missing ${ENV_KEYS[genModel.providerId]} — set it, or use --dry-run to check the pipeline without model calls.`);
    return 1;
  }

  const stamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
  const outDir = path.resolve('bench/results/design-eval', stamp);
  await mkdir(outDir, { recursive: true });

  console.log(`Design eval — model ${genModel.alias}, judge ${judgeModel.alias}${dryRun ? ' (dry run)' : ''}\n`);

  interface Row {
    id: string;
    surfaced: string[];
    referenced: string[];
    mechanicalMatches: string[];
    fabricated: string[];
    shoehorn: boolean | null;
    pass: boolean | null;
    reasons: string[];
  }
  const rows: Row[] = [];

  for (const s of SCENARIOS) {
    const last = s.turns[s.turns.length - 1];
    const retrieval = await retrieveCommonsContext({
      message: last.content,
      mode: 'plan',
      isFixSend: false,
      messages: s.turns.slice(0, -1),
    });
    const surfacedTitles = retrieval.results.map(r => r.title);
    const systemPrompt = buildSystemPrompt({ mode: 'plan', commonsResults: retrieval.results });

    if (dryRun) {
      console.log(`${s.id.padEnd(22)} surfaced ${retrieval.results.length} (query: "${(retrieval.query ?? '').replace(/\s+/g, ' ').slice(0, 60)}…) · prompt ${(systemPrompt.length / 1000).toFixed(1)}k chars`);
      rows.push({ id: s.id, surfaced: surfacedTitles, referenced: [], mechanicalMatches: [], fabricated: [], shoehorn: null, pass: null, reasons: ['dry run'] });
      continue;
    }

    const provider = providerFor(genModel);
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      ...s.turns.map(t => ({ role: t.role, content: t.content })),
    ];
    const plan = await complete(provider, messages, genModel.modelId);

    const judgeRaw = await complete(
      providerFor(judgeModel),
      [{ role: 'user', content: judgePrompt(last.content, surfacedTitles, plan) }],
      judgeModel.modelId,
    );
    const verdict = parseVerdict(judgeRaw);
    const mechanical = findMentionedResults(plan, retrieval.results).map(r => r.title);

    const reasons: string[] = [];
    if (!verdict) reasons.push('judge reply unparseable');
    const referenced = verdict?.referenced ?? [];
    const fabricated = verdict?.fabricated ?? [];
    // Referencing counts when the judge OR the mechanical matcher saw it —
    // the judge catches paraphrases, the matcher catches judge misses
    const didReference = referenced.length > 0 || mechanical.length > 0;
    if (s.expect.shouldReference && !didReference) reasons.push('no surfaced entry referenced');
    if (fabricated.length > 0) reasons.push(`fabricated: ${fabricated.join('; ')}`);
    if (s.expect.neutrality && verdict?.community_shoehorn) reasons.push('community framing shoehorned into a generic ask');

    const pass = verdict !== null && reasons.length === 0;
    rows.push({
      id: s.id, surfaced: surfacedTitles, referenced, mechanicalMatches: mechanical,
      fabricated, shoehorn: verdict?.community_shoehorn ?? null, pass, reasons,
    });

    await writeFile(path.join(outDir, `${s.id}.md`), [
      `# ${s.id} — ${s.description}`,
      '',
      `Query: ${retrieval.query}`,
      `Surfaced (${surfacedTitles.length}): ${surfacedTitles.join(' · ') || '(none)'}`,
      '',
      '## Plan', '', plan, '',
      '## Judge', '', '```json', judgeRaw.trim(), '```', '',
      `Mechanical title matches: ${mechanical.join(' · ') || '(none)'}`,
      `Outcome: ${pass ? 'PASS' : `FAIL — ${reasons.join('; ')}`}`,
    ].join('\n'));

    console.log(`${s.id.padEnd(22)} ${pass ? 'PASS' : 'FAIL'}  surfaced ${surfacedTitles.length} · referenced ${referenced.length} (mechanical ${mechanical.length})${reasons.length > 0 ? ` · ${reasons.join('; ')}` : ''}`);
  }

  await writeFile(path.join(outDir, 'summary.json'), JSON.stringify({
    at: new Date().toISOString(),
    model: genModel.alias,
    judge: judgeModel.alias,
    dryRun,
    rows,
  }, null, 2));
  console.log(`\nArtifacts: ${outDir}`);

  if (dryRun) return 0;
  const failed = rows.filter(r => r.pass === false);
  if (failed.length > 0) {
    console.error(`\nDESIGN EVAL: ${failed.length}/${rows.length} scenarios failed. Generations vary — re-run before treating a single failure as a regression.`);
    return 1;
  }
  console.log(`\nAll ${rows.length} scenarios passed.`);
  return 0;
}
