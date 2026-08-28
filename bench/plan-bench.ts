import { parseArgs } from 'node:util';
import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { buildPromptContext, TURN_BREAK } from '@/knowledge/context-builder';
import { retrieveCommonsContext, findMentionedResults } from '@/knowledge/retrieval';
import { detectFrames, framesFromSlugs } from '@/knowledge/frames';
import { loadGalleryReferences } from '@/cloud/gallery-references';
import { COMMUNITY_PLAN_MODEL } from '@/store/community-store';
import type { ChatMessage, LLMProvider } from '@/providers/types';
import { contentToText } from '@/providers/types';
import { BENCH_MODELS, ENV_KEYS, resolveModels } from './models';
import { PLAN_SCENARIOS, PLAN_SCENARIOS_VERSION, resolvePlanScenarios, type PlanScenario } from './plan-tasks';
import type { PlanRunReport, PlanTrial } from './plan-types';
import { runPlanChecks } from './lib/plan-checks';
import { complete, judgeEntriesFromResults, judgePrompt, parseVerdict } from './lib/judge';
import { providerFor } from './lib/providers';
import { charsToTokens, estimateCostUsd } from './lib/cost';
import { writePlanReport } from './lib/plan-report';
import { writePlanReviewPage } from './lib/plan-review-page';
import { runPlanSelftest } from './plan-selftest';

/**
 * Plan-phase bench — the strategy stage gets its own numbers.
 *
 *   npm run bench -- plan [--models a,b] [--trials N] [--judge alias]
 *                         [--no-judge] [--scenarios x,y] [--dry-run] [--out dir]
 *   npm run bench -- plan report <runDir>     regenerate report.md (merges scores.json)
 *   npm run bench -- plan review <runDir>     regenerate review/index.html
 *   npm run bench -- plan selftest            checks on canned replies, no network
 *
 * Every trial runs the REAL production pipeline: live commons retrieval
 * through the retrieval policy, frames sensed from what surfaced, the
 * production plan-mode prompt via buildPromptContext, and the volatile turn
 * context appended to the outgoing user message after TURN_BREAK — the exact
 * message shape ChatPanel sends. The default model is COMMUNITY_PLAN_MODEL,
 * imported from the store so the bench always measures whatever production's
 * community plan default actually is.
 *
 * Retrieval runs ONCE per scenario per run and the surfaced set is shared by
 * every model and trial — comparisons within a run are apples to apples; the
 * corpus is live, so cross-run drift is expected and run.json records what
 * was surfaced.
 *
 * Scoring is three layers (see README § Plan-phase bench): mechanical
 * contract checks (free), the factual commons-honesty judge, and the human
 * review page — RT alignment / creativity / overall on 0–10, overall
 * weighted 2× in the composite. The humans decide; the machines keep them
 * honest and catch regressions between reviews.
 */

export const PLAN_BENCH_VERSION = '1.0.0';

const GEN_TIMEOUT_MS = 300_000;
const JUDGE_TIMEOUT_MS = 180_000;

/** Typical plan-mode reply, for pre-run cost estimates only. */
const EST_PLAN_OUTPUT_TOKENS = 1_500;

function resolveModel(alias: string) {
  const m = BENCH_MODELS.find(x => x.alias === alias || x.modelId === alias);
  if (!m) throw new Error(`Unknown model "${alias}" — see npm run bench -- --list-models`);
  return m;
}

interface Completion {
  text: string;
  ttftMs: number | null;
  finishReason: string | null;
  latencyMs: number;
}

/** One streamed completion with a timeout and a hard deadline — plan replies
 *  are single-shot prose, so no continuation loop (production's continuation
 *  machinery is for builds cut off mid-file). */
function completeTimed(
  provider: LLMProvider,
  messages: ChatMessage[],
  modelId: string,
  timeoutMs: number,
): Promise<Completion> {
  const start = Date.now();
  let text = '';
  let ttftMs: number | null = null;
  let finishReason: string | null = null;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  let hardTimer: ReturnType<typeof setTimeout>;
  const hardDeadline = new Promise<never>((_, reject) => {
    hardTimer = setTimeout(
      () => reject(new Error(`timed out after ${Math.round(timeoutMs / 1000)}s (stream never settled)`)),
      timeoutMs + 60_000,
    );
  });
  const streamed = new Promise<void>((resolve, reject) => {
    provider
      .chat(messages, modelId, {
        onToken: t => {
          if (ttftMs === null) ttftMs = Date.now() - start;
          text += t;
        },
        onFinishReason: r => { finishReason = r; },
        onComplete: () => resolve(),
        onError: reject,
      }, ac.signal)
      .catch(reject);
  });
  return Promise.race([streamed, hardDeadline])
    .then(() => {
      if (text.length === 0) throw new Error('empty completion — provider streamed no content');
      return { text, ttftMs, finishReason, latencyMs: Date.now() - start };
    })
    .catch(err => {
      if (ac.signal.aborted) {
        throw new Error(`timed out after ${Math.round(timeoutMs / 1000)}s (partial reply: ${text.length} chars)`);
      }
      throw err;
    })
    .finally(() => {
      clearTimeout(timer);
      clearTimeout(hardTimer);
    });
}

interface ScenarioContext {
  scenario: PlanScenario;
  /** Provider payload minus nothing: production's exact message shape */
  messages: ChatMessage[];
  retrieval: PlanTrial['retrieval'];
  surfaced: Awaited<ReturnType<typeof retrieveCommonsContext>>['results'];
  inputChars: number;
}

async function assembleScenario(
  scenario: PlanScenario,
  galleryReferences: Awaited<ReturnType<typeof loadGalleryReferences>>,
): Promise<ScenarioContext> {
  const last = scenario.turns[scenario.turns.length - 1];
  const retrieval = await retrieveCommonsContext({
    message: last.content,
    mode: 'plan',
    isFixSend: false,
    messages: scenario.turns.slice(0, -1),
  }).catch(() => ({ results: [], query: null, dropped: 0, skipped: null }));

  // Frames sensed from what retrieval surfaced — same as ChatPanel (fresh
  // projects carry no lineage frames, so sensing is the whole set here)
  const frames = framesFromSlugs(detectFrames(retrieval.results, last.content).map(f => f.slug));

  const { system, turnContext } = buildPromptContext({
    mode: 'plan',
    commonsResults: retrieval.results,
    frames,
    galleryReferences,
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: system },
    ...scenario.turns.map(t => ({ role: t.role, content: t.content })),
  ];
  // The volatile turn context rides at the end of the outgoing user message
  // after TURN_BREAK — past every cache breakpoint, exactly as production
  // sends it (ChatPanel). Non-Claude providers strip the marker.
  if (turnContext) {
    const lastMsg = messages[messages.length - 1];
    lastMsg.content = `${lastMsg.content}\n${TURN_BREAK}\n${turnContext}`;
  }

  return {
    scenario,
    messages,
    retrieval: {
      query: retrieval.query,
      dropped: retrieval.dropped,
      surfaced: retrieval.results.map(r => ({
        slug: r.slug,
        title: r.title,
        kind: r.kind,
        similarity: r.similarity ?? null,
      })),
    },
    surfaced: retrieval.results,
    inputChars: messages.reduce((n, m) => n + contentToText(m.content).length, 0),
  };
}

export async function runPlanBench(argv: string[]): Promise<number> {
  if (argv[0] === 'report') {
    const { generatePlanReport } = await import('./lib/plan-report');
    return generatePlanReport(argv[1]);
  }
  if (argv[0] === 'review') {
    if (!argv[1]) {
      console.error('Usage: npm run bench -- plan review <runDir>');
      return 1;
    }
    const { readFile } = await import('node:fs/promises');
    const run: PlanRunReport = JSON.parse(
      await readFile(path.resolve(argv[1], 'run.json'), 'utf8'),
    );
    await writePlanReviewPage(path.resolve(argv[1]), run);
    console.log(`Review page written: ${path.resolve(argv[1], 'review/index.html')}`);
    return 0;
  }
  if (argv[0] === 'selftest') return runPlanSelftest();

  const { values } = parseArgs({
    args: argv,
    options: {
      models: { type: 'string' },
      scenarios: { type: 'string' },
      trials: { type: 'string', default: '1' },
      judge: { type: 'string', default: 'claude-sonnet-5' },
      'no-judge': { type: 'boolean', default: false },
      'dry-run': { type: 'boolean', default: false },
      out: { type: 'string', default: 'bench/results/plan' },
      'list-scenarios': { type: 'boolean', default: false },
      help: { type: 'boolean', default: false },
    },
  });

  if (values.help) {
    console.log(
      'npm run bench -- plan [--models a,b] [--trials N] [--judge alias] [--no-judge] ' +
        '[--scenarios x,y] [--dry-run] [--out dir] [--list-scenarios]\n' +
        'npm run bench -- plan report <runDir> | review <runDir> | selftest',
    );
    return 0;
  }

  if (values['list-scenarios']) {
    for (const s of PLAN_SCENARIOS) {
      console.log(`${s.id.padEnd(24)} ${s.expect.padEnd(8)} ${s.description}`);
    }
    return 0;
  }

  // Default: the production community plan default, so a bare `plan` run
  // always measures what builders actually get.
  const models = values.models
    ? resolveModels(values.models)
    : [resolveModel(COMMUNITY_PLAN_MODEL)];
  const scenarios = resolvePlanScenarios(values.scenarios);
  const trials = Math.max(1, parseInt(values.trials ?? '1', 10) || 1);
  const noJudge = values['no-judge'] ?? false;
  const judgeModel = noJudge ? null : resolveModel(values.judge!);
  const dryRun = values['dry-run'] ?? false;

  console.log(
    `Plan bench — scenarios ${PLAN_SCENARIOS_VERSION}, models ${models.map(m => m.alias).join(', ')}` +
      `${judgeModel ? `, judge ${judgeModel.alias}` : ', judge off'}, trials ${trials}` +
      `${dryRun ? ' (dry run)' : ''}`,
  );
  console.log('Assembling production plan prompts (live commons retrieval)…\n');

  const galleryReferences = await loadGalleryReferences().catch(() => []);
  const contexts: ScenarioContext[] = [];
  for (const s of scenarios) contexts.push(await assembleScenario(s, galleryReferences));

  let estTotal = 0;
  for (const ctx of contexts) {
    const inTokens = charsToTokens(ctx.inputChars);
    console.log(
      `${ctx.scenario.id.padEnd(24)} expect ${ctx.scenario.expect.padEnd(8)} ` +
        `surfaced ${String(ctx.retrieval.surfaced.length).padEnd(2)} (dropped ${ctx.retrieval.dropped}) · ` +
        `~${inTokens.toLocaleString()} input tokens`,
    );
    for (const m of models) {
      estTotal += (estimateCostUsd(m, inTokens, EST_PLAN_OUTPUT_TOKENS) ?? 0) * trials;
    }
  }
  console.log(
    `\nEstimated generation total: ~$${estTotal.toFixed(2)} (chars/4 heuristic, list prices` +
      `${judgeModel ? '; judge calls extra, typically cents' : ''})\n`,
  );

  if (dryRun) {
    console.log('Dry run — no API calls made.');
    return 0;
  }

  const needKeys = [...models, ...(judgeModel ? [judgeModel] : [])];
  const missing = [...new Set(needKeys.filter(m => !process.env[ENV_KEYS[m.providerId]]).map(m => ENV_KEYS[m.providerId]))];
  if (missing.length > 0) {
    console.error(`Missing API keys: ${missing.join(', ')}. Set them or use --dry-run.`);
    return 1;
  }

  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch { /* not a repo */ }
  const stamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
  const runId = `${stamp}-${gitCommit}`;
  const runDir = path.resolve(values.out ?? 'bench/results/plan', runId);
  await mkdir(runDir, { recursive: true });

  const trialsOut: PlanTrial[] = [];

  for (const ctx of contexts) {
    for (const model of models) {
      const provider = providerFor(model);
      for (let trial = 1; trial <= trials; trial++) {
        const label = `${ctx.scenario.id} · ${model.alias} t${trial}`;
        const startedAt = new Date().toISOString();
        let completion: Completion | null = null;
        let error: string | null = null;
        // One retry — capacity weather (429/529/empty stream) is not model
        // signal; a second failure is recorded as the trial's outcome.
        for (let attempt = 0; attempt < 2 && !completion; attempt++) {
          try {
            completion = await completeTimed(provider, ctx.messages, model.modelId, GEN_TIMEOUT_MS);
          } catch (err) {
            error = err instanceof Error ? err.message : String(err);
            if (attempt === 0) await new Promise(r => setTimeout(r, 3_000));
          }
        }

        if (!completion) {
          trialsOut.push({
            alias: model.alias, providerId: model.providerId, modelId: model.modelId,
            scenarioId: ctx.scenario.id, scenarioVersion: PLAN_SCENARIOS_VERSION, trial,
            startedAt, latencyMs: 0, ttftMs: null, finishReason: null, outputChars: 0,
            words: 0, estTokens: { input: charsToTokens(ctx.inputChars), output: 0, estimated: true },
            estCostUsd: null, retrieval: ctx.retrieval, mentionedTitles: [], checks: [],
            judge: null, planText: '', error,
          });
          console.log(`${label.padEnd(44)} ERROR — ${error}`);
          continue;
        }

        const mentioned = findMentionedResults(completion.text, ctx.surfaced);
        const checks = runPlanChecks(
          completion.text,
          ctx.scenario.expect,
          ctx.surfaced.length,
          mentioned.length,
        );

        let judge: PlanTrial['judge'] = null;
        let judgeRaw = '';
        if (judgeModel) {
          const ask = ctx.scenario.turns[ctx.scenario.turns.length - 1].content;
          try {
            const prompt = judgePrompt(ask, judgeEntriesFromResults(ctx.surfaced), completion.text);
            judgeRaw = await Promise.race([
              complete(providerFor(judgeModel), [{ role: 'user', content: prompt }], judgeModel.modelId),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('judge timed out')), JUDGE_TIMEOUT_MS)),
            ]);
            const verdict = parseVerdict(judgeRaw);
            judge = {
              model: judgeModel.alias,
              referenced: verdict?.referenced ?? [],
              fabricated: verdict?.fabricated ?? [],
              notes: verdict ? verdict.notes : 'judge reply unparseable',
              estCostUsd: estimateCostUsd(
                judgeModel,
                charsToTokens(prompt.length),
                charsToTokens(judgeRaw.length),
              ),
            };
          } catch (err) {
            judge = {
              model: judgeModel.alias, referenced: [], fabricated: [],
              notes: `judge failed: ${err instanceof Error ? err.message : String(err)}`,
              estCostUsd: null,
            };
          }
        }

        const inputTokens = charsToTokens(ctx.inputChars);
        const outputTokens = charsToTokens(completion.text.length);
        const t: PlanTrial = {
          alias: model.alias, providerId: model.providerId, modelId: model.modelId,
          scenarioId: ctx.scenario.id, scenarioVersion: PLAN_SCENARIOS_VERSION, trial,
          startedAt,
          latencyMs: completion.latencyMs,
          ttftMs: completion.ttftMs,
          finishReason: completion.finishReason,
          outputChars: completion.text.length,
          words: completion.text.split(/\s+/).filter(Boolean).length,
          estTokens: { input: inputTokens, output: outputTokens, estimated: true },
          estCostUsd: estimateCostUsd(model, inputTokens, outputTokens),
          retrieval: ctx.retrieval,
          mentionedTitles: mentioned.map(r => r.title),
          checks,
          judge,
          planText: completion.text,
          error: null,
        };
        trialsOut.push(t);

        const artDir = path.join(runDir, 'artifacts', `${ctx.scenario.id}--${model.alias}-t${trial}`);
        await mkdir(artDir, { recursive: true });
        await writeFile(path.join(artDir, 'plan.md'), [
          `# ${ctx.scenario.id} — ${model.alias} (trial ${trial})`,
          '',
          `Query: ${ctx.retrieval.query ?? '(retrieval sat out)'}`,
          `Surfaced (${ctx.retrieval.surfaced.length}): ${ctx.retrieval.surfaced.map(r => r.title).join(' · ') || '(none)'}`,
          `Mentioned: ${t.mentionedTitles.join(' · ') || '(none)'}`,
          '',
          '---',
          '',
          completion.text,
          ...(judge ? ['', '## Judge', '', '```json', judgeRaw.trim() || JSON.stringify(judge, null, 2), '```'] : []),
        ].join('\n'));

        const passed = checks.filter(c => c.pass).length;
        console.log(
          `${label.padEnd(44)} checks ${passed}/${checks.length} · ` +
            `commons ${t.mentionedTitles.length}/${ctx.surfaced.length}` +
            `${judge && judge.fabricated.length > 0 ? ` · FABRICATED ${judge.fabricated.length}` : ''} · ` +
            `${Math.round(completion.latencyMs / 1000)}s · ~$${t.estCostUsd?.toFixed(2) ?? '?'}`,
        );
        for (const c of checks.filter(c => !c.pass)) {
          console.log(`  ✗ ${c.id}${c.detail ? ` — ${c.detail}` : ''}`);
        }
      }
    }
  }

  const run: PlanRunReport = {
    planBenchVersion: PLAN_BENCH_VERSION,
    scenariosVersion: PLAN_SCENARIOS_VERSION,
    gitCommit,
    createdAt: new Date().toISOString(),
    runId,
    config: { trials, judge: judgeModel?.alias ?? null },
    models,
    scenarios: scenarios.map(s => ({ id: s.id, expect: s.expect })),
    trials: trialsOut,
  };
  await writeFile(path.join(runDir, 'run.json'), JSON.stringify(run, null, 2));
  await writePlanReviewPage(runDir, run);
  await writePlanReport(runDir, run);

  console.log(`\nRun: ${runDir}`);
  console.log('Human review: open review/index.html, score 0–10 (overall counts 2×), export,');
  console.log('save as review/scores.json, then: npm run bench -- plan report ' + path.relative(process.cwd(), runDir));

  const errored = trialsOut.filter(t => t.error).length;
  if (errored > 0) console.error(`\n${errored}/${trialsOut.length} trials errored.`);
  return errored === trialsOut.length && trialsOut.length > 0 ? 1 : 0;
}
