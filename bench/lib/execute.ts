import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChatMessage } from '@/providers/types';
import type { BenchModel, RunReport, TrialResult } from '../types';
import { BUILD_GO_PROMPT, type TaskSpec } from '../tasks';
import { charsToTokens, estimateCostUsd, HARNESS_VERSION } from './cost';
import { providerFor } from './providers';
import { runSession, type SessionResult } from './session';
import { scoreOutput } from './pipeline';
import { writeTrialArtifacts } from './artifacts';

export interface ExecuteOptions {
  models: BenchModel[];
  tasks: TaskSpec[];
  trials: number;
  /** buildSystemPrompt({ mode: 'build' }) — the production build prompt */
  systemPrompt: string;
  /** buildSystemPrompt({ mode: 'plan' }) — used when planFirst is on */
  planSystemPrompt: string;
  /** Plan-mode generation precedes each build (mirrors production flow) */
  planFirst: boolean;
  outDir: string;
  screenshots: boolean;
  /** Studio slug when the run is studio-framed (--studio) — recorded in run.json */
  studio?: string | null;
  /** Injectable session (selftest) — bypasses providers entirely */
  sessioner?: (messages: ChatMessage[]) => Promise<SessionResult>;
}

/** Generous ceiling — Opus-class first builds stream for minutes, not hours. */
const TRIAL_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * The fix prompt production fires when a build breaks the preview — copied in
 * shape from src/components/preview/FixBanner.tsx (a React component the
 * harness can't import, same as session.ts's continuation constant). The
 * bench models a bundle failure as the trigger (a build that won't compile is
 * the deterministic, headless-measurable version of "the preview threw"), and
 * runs the single automatic pass production arms per build — so "how solves
 * go" is measured, not guessed.
 */
function bundleFixPrompt(errors: string[]): string {
  const errorText = errors.join('\n').slice(0, 2000);
  return [
    'The live preview is showing this error:',
    '',
    '```',
    errorText,
    '```',
    '',
    'Please fix it. Re-output the complete corrected file(s) with filename annotations, changing as little else as possible.',
  ].join('\n');
}

function gitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    return 'unknown';
  }
}

function newRunId(sha: string): string {
  const stamp = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
  return `${stamp}-${sha}`;
}

async function runTrial(
  model: BenchModel,
  task: TaskSpec,
  trial: number,
  opts: ExecuteOptions,
  runDir: string,
): Promise<TrialResult> {
  const base: TrialResult = {
    alias: model.alias,
    providerId: model.providerId,
    modelId: model.modelId,
    taskId: task.id,
    taskVersion: task.version,
    trial,
    startedAt: new Date().toISOString(),
    plan: null,
    latencyMs: 0,
    ttftMs: null,
    segments: [],
    continuations: 0,
    truncatedFinal: false,
    outputChars: 0,
    estTokens: { input: 0, output: 0, estimated: true },
    estCostUsd: null,
    extraction: { writes: 0, editBlocks: 0, failedEditBlocks: 0 },
    previewKind: 'none',
    previewKindMatch: false,
    bundle: null,
    securityFindings: 0,
    checks: [],
    artifactDir: null,
    fixRound: null,
    error: null,
  };

  const session = (messages: ChatMessage[]) =>
    opts.sessioner
      ? opts.sessioner(messages)
      : runSession(providerFor(model), model.modelId, messages, TRIAL_TIMEOUT_MS);
  const withOneRetry = async (messages: ChatMessage[]): Promise<SessionResult> => {
    try {
      return await session(messages);
    } catch (err) {
      // One transport retry — OpenAI-compatible providers have none built in,
      // and a single 5xx blip shouldn't cost a whole matrix cell. (Timeouts
      // are real signal, not blips: they fail the trial.)
      if (err instanceof Error && /timed out/.test(err.message)) throw err;
      console.warn(`  ${model.alias} t${trial}: retrying after error — ${String(err)}`);
      return session(messages);
    }
  };

  let planSession: SessionResult | null = null;
  let buildSession: SessionResult;
  let buildMessages: ChatMessage[];
  try {
    if (opts.planFirst) {
      planSession = await withOneRetry([
        { role: 'system', content: opts.planSystemPrompt },
        { role: 'user', content: task.prompt },
      ]);
      buildMessages = [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: task.prompt },
        { role: 'assistant', content: planSession.segmentTexts.join('\n') },
        { role: 'user', content: BUILD_GO_PROMPT },
      ];
    } else {
      buildMessages = [
        { role: 'system', content: opts.systemPrompt },
        { role: 'user', content: task.prompt },
      ];
    }
    buildSession = await withOneRetry(buildMessages);
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }

  const outputChars =
    buildSession.segmentTexts.reduce((n, t) => n + t.length, 0) +
    (planSession?.segmentTexts.reduce((n, t) => n + t.length, 0) ?? 0);
  const inTokens = charsToTokens(buildSession.sentChars + (planSession?.sentChars ?? 0));
  const outTokens = charsToTokens(outputChars);

  const result: TrialResult = {
    ...base,
    plan: planSession
      ? {
          latencyMs: planSession.latencyMs,
          ttftMs: planSession.ttftMs,
          chars: planSession.segmentTexts.reduce((n, t) => n + t.length, 0),
        }
      : null,
    latencyMs: buildSession.latencyMs + (planSession?.latencyMs ?? 0),
    ttftMs: buildSession.ttftMs,
    segments: buildSession.segments,
    continuations: buildSession.continuations,
    truncatedFinal: buildSession.truncatedFinal,
    outputChars,
    estTokens: { input: inTokens, output: outTokens, estimated: true },
    estCostUsd: estimateCostUsd(model, inTokens, outTokens),
  };

  try {
    let mech = await scoreOutput(task, buildSession.segmentTexts);
    let allSegments = [...buildSession.segmentTexts];

    // One automatic fix pass when the first build won't bundle — the same
    // single shot production arms. Re-score over build + fix segments (writes
    // and edits accumulate exactly as the app re-extracts each message).
    if (mech.bundle && !mech.bundle.ok && buildSession.segmentTexts.length > 0) {
      const triggerErrors = mech.bundle.errors;
      const fixMessages: ChatMessage[] = [
        ...buildMessages,
        { role: 'assistant', content: buildSession.segmentTexts.join('\n') },
        { role: 'user', content: bundleFixPrompt(triggerErrors) },
      ];
      try {
        const fixSession = await withOneRetry(fixMessages);
        allSegments = [...allSegments, ...fixSession.segmentTexts];
        const fixedMech = await scoreOutput(task, allSegments);
        const fixOutChars = fixSession.segmentTexts.reduce((n, t) => n + t.length, 0);
        result.fixRound = {
          attempted: true,
          triggerErrors,
          solved: !!fixedMech.bundle?.ok,
          latencyMs: fixSession.latencyMs,
          remainingErrors: fixedMech.bundle?.ok ? [] : (fixedMech.bundle?.errors ?? []),
          estCostUsd: estimateCostUsd(
            model,
            charsToTokens(fixSession.sentChars),
            charsToTokens(fixOutChars),
          ),
        };
        // The fixed build is the one worth keeping — artifacts + screenshot
        // should show the state after the auto-fix, as a builder would see it.
        mech = fixedMech;
      } catch (err) {
        result.fixRound = {
          attempted: true,
          triggerErrors,
          solved: false,
          latencyMs: 0,
          remainingErrors: [`fix pass failed: ${err instanceof Error ? err.message : String(err)}`],
          estCostUsd: null,
        };
      }
    }

    result.extraction = mech.extraction;
    result.previewKind = mech.previewKind;
    result.previewKindMatch = mech.previewKindMatch;
    result.bundle = mech.bundle;
    result.securityFindings = mech.securityFindings;
    result.checks = mech.checks;
    result.artifactDir = await writeTrialArtifacts(
      runDir,
      task.id,
      model.alias,
      trial,
      planSession?.segmentTexts.join('\n') ?? null,
      buildSession,
      mech,
    );
  } catch (err) {
    result.error = `scoring failed: ${err instanceof Error ? err.message : String(err)}`;
  }
  return result;
}

export async function executeRun(opts: ExecuteOptions): Promise<number> {
  const sha = gitCommit();
  const runId = newRunId(sha);
  const runDir = path.resolve(opts.outDir, runId);
  await mkdir(runDir, { recursive: true });
  console.log(`Run ${runId} → ${runDir}\n`);

  // Serial within a provider (rate limits), providers in parallel.
  const byProvider = new Map<string, BenchModel[]>();
  for (const m of opts.models) {
    byProvider.set(m.providerId, [...(byProvider.get(m.providerId) ?? []), m]);
  }

  const trials: TrialResult[] = [];
  // Provider groups run concurrently — chain snapshot writes so two groups
  // never interleave writeFile calls on run.json.
  let writeChain: Promise<void> = Promise.resolve();
  const snapshot = () => {
    writeChain = writeChain.then(() => writeRunJson(runDir, runId, sha, opts, trials));
    return writeChain;
  };
  await Promise.all(
    [...byProvider.values()].map(async models => {
      for (const model of models) {
        for (const task of opts.tasks) {
          for (let t = 1; t <= opts.trials; t++) {
            console.log(`▶ ${model.alias} · ${task.id} (trial ${t}/${opts.trials})…`);
            const result = await runTrial(model, task, t, opts, runDir);
            trials.push(result);
            const planNote = result.plan ? `plan ${Math.round(result.plan.latencyMs / 1000)}s + ` : '';
            const status = result.error
              ? `✗ ${result.error.slice(0, 120)}`
              : `${result.bundle?.ok ? 'bundle ✓' : 'bundle ✗'} · ${result.extraction.writes} files · ` +
                `${planNote}${Math.round((result.latencyMs - (result.plan?.latencyMs ?? 0)) / 1000)}s · ~$${result.estCostUsd?.toFixed(2) ?? '?'}`;
            console.log(`  ${model.alias} · ${task.id} t${t}: ${status}`);
            // Partial results survive a crash / Ctrl-C
            await snapshot();
          }
        }
      }
    }),
  );

  await snapshot();

  if (opts.screenshots) {
    try {
      const { captureScreenshots } = await import('./screenshots');
      await captureScreenshots(runDir, trials);
    } catch (err) {
      console.warn(`Screenshots skipped: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { writeReviewPage } = await import('./review-page');
  await writeReviewPage(runDir, runId, trials);

  const { generateReport } = await import('./report');
  await generateReport(runDir);

  const failed = trials.filter(t => t.error).length;
  console.log(
    `\nDone: ${trials.length} trials (${failed} errored). ` +
      `Review: ${path.join(runDir, 'review/index.html')} · Report: ${path.join(runDir, 'report.md')}`,
  );
  return 0;
}

async function writeRunJson(
  runDir: string,
  runId: string,
  sha: string,
  opts: ExecuteOptions,
  trials: TrialResult[],
): Promise<void> {
  const report: RunReport = {
    harnessVersion: HARNESS_VERSION,
    taskVersion: opts.tasks.map(t => t.version).join(','),
    gitCommit: sha,
    createdAt: new Date().toISOString(),
    runId,
    config: { trials: opts.trials, timeoutMs: TRIAL_TIMEOUT_MS, planFirst: opts.planFirst, studio: opts.studio ?? null },
    models: opts.models,
    tasks: opts.tasks.map(t => ({ id: t.id, version: t.version })),
    trials,
  };
  await writeFile(path.join(runDir, 'run.json'), JSON.stringify(report, null, 2), 'utf8');
}
