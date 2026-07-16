import { execSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { BenchModel, RunReport, TrialResult } from '../types';
import { PROMPT, TASK_VERSION } from '../task';
import { charsToTokens, estimateCostUsd, HARNESS_VERSION } from './cost';
import { providerFor } from './providers';
import { runSession, type SessionResult } from './session';
import { scoreOutput } from './pipeline';
import { writeTrialArtifacts } from './artifacts';

export interface ExecuteOptions {
  models: BenchModel[];
  trials: number;
  systemPrompt: string;
  outDir: string;
  screenshots: boolean;
  /** Injectable session (selftest) — bypasses providers entirely */
  sessioner?: () => Promise<SessionResult>;
}

/** Generous ceiling — Opus-class first builds stream for minutes, not hours. */
const TRIAL_TIMEOUT_MS = 10 * 60 * 1000;

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

/** Input chars actually sent across all segments (continuations resend history). */
function inputChars(systemPrompt: string, session: SessionResult): number {
  let total = 0;
  let history = systemPrompt.length + PROMPT.length;
  for (let i = 0; i < session.segments.length; i++) {
    total += history;
    history += session.segments[i].chars + 400; // + continuation prompt
  }
  return total;
}

async function runTrial(
  model: BenchModel,
  trial: number,
  systemPrompt: string,
  runDir: string,
  sessioner?: () => Promise<SessionResult>,
): Promise<TrialResult> {
  const base: TrialResult = {
    alias: model.alias,
    providerId: model.providerId,
    modelId: model.modelId,
    trial,
    startedAt: new Date().toISOString(),
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
    error: null,
  };

  let session: SessionResult;
  try {
    const runOnce =
      sessioner ??
      (() => runSession(providerFor(model), model.modelId, systemPrompt, PROMPT, TRIAL_TIMEOUT_MS));
    try {
      session = await runOnce();
    } catch (err) {
      // One transport retry — OpenAI-compatible providers have none built in,
      // and a single 5xx blip shouldn't cost a whole matrix cell. (Timeouts
      // are real signal, not blips: they fail the trial.)
      if (err instanceof Error && /timed out/.test(err.message)) throw err;
      console.warn(`  ${model.alias} t${trial}: retrying after error — ${String(err)}`);
      session = await runOnce();
    }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : String(err) };
  }

  const outputChars = session.segmentTexts.reduce((n, t) => n + t.length, 0);
  const inTokens = charsToTokens(inputChars(systemPrompt, session));
  const outTokens = charsToTokens(outputChars);

  const result: TrialResult = {
    ...base,
    latencyMs: session.latencyMs,
    ttftMs: session.ttftMs,
    segments: session.segments,
    continuations: session.continuations,
    truncatedFinal: session.truncatedFinal,
    outputChars,
    estTokens: { input: inTokens, output: outTokens, estimated: true },
    estCostUsd: estimateCostUsd(model, inTokens, outTokens),
  };

  try {
    const mech = await scoreOutput(session.segmentTexts);
    result.extraction = mech.extraction;
    result.previewKind = mech.previewKind;
    result.previewKindMatch = mech.previewKindMatch;
    result.bundle = mech.bundle;
    result.securityFindings = mech.securityFindings;
    result.checks = mech.checks;
    result.artifactDir = await writeTrialArtifacts(runDir, model.alias, trial, session, mech);
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
        for (let t = 1; t <= opts.trials; t++) {
          console.log(`▶ ${model.alias} (trial ${t}/${opts.trials})…`);
          const result = await runTrial(model, t, opts.systemPrompt, runDir, opts.sessioner);
          trials.push(result);
          const status = result.error
            ? `✗ ${result.error.slice(0, 120)}`
            : `${result.bundle?.ok ? 'bundle ✓' : 'bundle ✗'} · ${result.extraction.writes} files · ` +
              `${Math.round(result.latencyMs / 1000)}s · ~$${result.estCostUsd?.toFixed(2) ?? '?'}`;
          console.log(`  ${model.alias} t${t}: ${status}`);
          // Partial results survive a crash / Ctrl-C
          await snapshot();
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
    taskVersion: TASK_VERSION,
    gitCommit: sha,
    createdAt: new Date().toISOString(),
    runId,
    config: { trials: opts.trials, timeoutMs: TRIAL_TIMEOUT_MS },
    models: opts.models,
    trials,
  };
  await writeFile(path.join(runDir, 'run.json'), JSON.stringify(report, null, 2), 'utf8');
}
