import type { BenchModel } from './types';

/**
 * Shared types for the plan-phase bench (bench/plan-bench.ts).
 *
 * A plan trial is one plan-mode generation for one frozen scenario: live
 * commons retrieval → the production plan prompt → one reply, then the
 * mechanical checks, the honesty judge, and (later, from the review page)
 * human scores. See bench/README.md § Plan-phase bench.
 */

export interface PlanCheck {
  id: string;
  description: string;
  pass: boolean;
  /** What the check actually saw — the report and review page surface it */
  detail?: string;
}

export interface PlanTrial {
  alias: string;
  providerId: string;
  modelId: string;
  scenarioId: string;
  scenarioVersion: string;
  trial: number;
  startedAt: string;
  latencyMs: number;
  ttftMs: number | null;
  finishReason: string | null;
  outputChars: number;
  words: number;
  estTokens: { input: number; output: number; estimated: true };
  estCostUsd: number | null;
  /** What retrieval surfaced for this scenario (shared across the run) */
  retrieval: {
    query: string | null;
    dropped: number;
    surfaced: Array<{ slug: string; title: string; kind: string; similarity: number | null }>;
  };
  /** Surfaced entries the reply drew on, per the production chip matcher */
  mentionedTitles: string[];
  checks: PlanCheck[];
  /** Commons-honesty judge (bench/lib/judge.ts) — null when skipped */
  judge: {
    model: string;
    referenced: string[];
    fabricated: string[];
    notes: string;
    estCostUsd: number | null;
  } | null;
  /** The reply itself — small enough to live in run.json, and the review
   *  page + report regenerate from run.json alone */
  planText: string;
  error: string | null;
}

export interface PlanRunReport {
  planBenchVersion: string;
  scenariosVersion: string;
  gitCommit: string;
  createdAt: string;
  runId: string;
  config: { trials: number; judge: string | null };
  models: BenchModel[];
  scenarios: Array<{ id: string; expect: 'draft' | 'explore' }>;
  trials: PlanTrial[];
}

/** One card's human scores: 0–10 each, overall weighted 2× in the composite */
export interface PlanDimScores {
  rtAlignment?: number;
  creativity?: number;
  overall?: number;
  notes?: string;
}

/** Exported by the plan review page (review/scores.json) */
export interface PlanHumanScores {
  runId: string;
  reviewer: string;
  /** alias → scenarioId → scores */
  scores: Record<string, Record<string, PlanDimScores>>;
}

/** The agreed weighting: overall counts double. Null until all three are in. */
export function weightedComposite(s: PlanDimScores | undefined): number | null {
  if (s?.rtAlignment == null || s.creativity == null || s.overall == null) return null;
  return (s.rtAlignment + s.creativity + 2 * s.overall) / 4;
}
