/**
 * Shared types for the model benchmark harness.
 *
 * A "run" sends the frozen bench task (bench/task.ts) to each selected model
 * through the production pipeline, records mechanical metrics per trial, and
 * leaves human scoring to the generated review page. See bench/README.md.
 */

export interface BenchModel {
  /** Short name used in flags, results, and reports (e.g. 'claude-sonnet-5') */
  alias: string;
  providerId: 'claude' | 'openai' | 'gemini' | 'together' | 'openrouter';
  /** Provider-native model id (e.g. 'Qwen/Qwen3-Coder-Next-FP8') */
  modelId: string;
  /** Published list price, for the estimated-cost column */
  pricing?: { inputPerMTok: number; outputPerMTok: number; asOf: string };
  /** Disabled entries are pre-listed (future models) but skipped unless
   *  explicitly named in --models */
  enabled: boolean;
}

export interface TrialResult {
  alias: string;
  providerId: string;
  modelId: string;
  taskId: string;
  taskVersion: string;
  trial: number;
  startedAt: string;
  /** Present when the run used --plan-first: the plan-mode generation that
   *  preceded the build (Fable plans + builds in production) */
  plan: { latencyMs: number; ttftMs: number | null; chars: number } | null;
  /** Wall time across all segments, ms */
  latencyMs: number;
  /** Time to first streamed token of the first segment, ms */
  ttftMs: number | null;
  /** finish reason per segment ('stop' | 'length' | null if stream ended silently) */
  segments: Array<{ finishReason: string | null; latencyMs: number; chars: number }>;
  /** Automatic continuations used (production cap is 3) */
  continuations: number;
  /** Still inside a code fence after the continuation cap — reply incomplete */
  truncatedFinal: boolean;
  outputChars: number;
  /** chars/4 heuristic — no exact usage without provider changes */
  estTokens: { input: number; output: number; estimated: true };
  estCostUsd: number | null;
  extraction: {
    writes: number;
    editBlocks: number;
    failedEditBlocks: number;
  };
  previewKind: string;
  previewKindMatch: boolean;
  bundle: { ok: boolean; errors: string[] } | null;
  securityFindings: number;
  checks: Array<{ id: string; description: string; pass: boolean }>;
  /** Relative to the run directory */
  artifactDir: string | null;
  error: string | null;
}

export interface RunReport {
  harnessVersion: string;
  taskVersion: string;
  gitCommit: string;
  createdAt: string;
  runId: string;
  config: { trials: number; timeoutMs: number; planFirst: boolean };
  models: BenchModel[];
  tasks: Array<{ id: string; version: string }>;
  trials: TrialResult[];
}

/** Human scores exported by the review page (review/scores.json) */
export interface HumanScores {
  runId: string;
  reviewer: string;
  /** alias → 1-5 per dimension */
  scores: Record<
    string,
    { designQuality?: number; rtpFit?: number; completeness?: number; notes?: string }
  >;
  /** Best first */
  ranking: string[];
}
