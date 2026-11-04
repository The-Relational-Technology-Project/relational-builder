/**
 * Where the Builder's own calls are remembered (workstream 3). One row per
 * model call, newest last, capped; persisted in this browser only. Rows
 * carry the project they belonged to so the build report can show this
 * project's footprint. Tokens are ESTIMATED from characters (chars/4, the
 * bench's heuristic) because the provider layer does not report usage;
 * the row's `method` says so.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { provenanceRow, type ProvenanceRow, type ProvenanceHost } from './provenance';

const MAX_ROWS = 200;

export interface StoredRow extends ProvenanceRow {
  projectId: string | null;
}

interface ProvenanceState {
  rows: StoredRow[];
  record: (row: StoredRow) => void;
  clear: () => void;
}

export const useProvenanceStore = create<ProvenanceState>()(persist(set => ({
  rows: [],
  record: row => set(s => ({ rows: [...s.rows, row].slice(-MAX_ROWS) })),
  clear: () => set({ rows: [] }),
}), { name: 'rb.humanScale.provenance' }));

/** Where a Builder provider runs, from its id */
export function hostForProvider(providerId: string): ProvenanceHost {
  if (providerId === 'local') return 'local';
  if (providerId === 'rtp' || providerId === 'community') return 'community';
  return 'hosted';
}

export const charsToTokens = (chars: number): number => Math.max(0, Math.round(chars / 4));

/** The row for one Builder reply, from what the chat knows at the end of it */
export function builderCallRow(input: {
  providerId: string;
  model: string;
  promptChars: number;
  replyChars: number;
  projectId: string | null;
  at?: string;
  /** What the provider reported serving it (a router's upstream host) */
  servedBy?: string;
  servedModel?: string;
}): StoredRow {
  const row = provenanceRow({
    side: 'builder',
    provider: input.providerId,
    model: input.model,
    host: hostForProvider(input.providerId),
    tokensIn: charsToTokens(input.promptChars),
    tokensOut: charsToTokens(input.replyChars),
    at: input.at,
    servedBy: input.servedBy,
    servedModel: input.servedModel,
  });
  return {
    ...row,
    method: `${row.method} Tokens estimated as characters/4 (the provider does not report usage).`,
    projectId: input.projectId,
  };
}

/** Record one Builder reply (call from the chat when a reply completes) */
export function recordBuilderCall(input: Parameters<typeof builderCallRow>[0]): StoredRow {
  const row = builderCallRow(input);
  useProvenanceStore.getState().record(row);
  return row;
}

export interface FootprintSummary {
  calls: number;
  tokensIn: number;
  tokensOut: number;
  /** Sum over rows that had an estimate; null when none did */
  energyWhEstimate: number | null;
  /** Rows with no estimate (model size not public) */
  unestimated: number;
  models: string[];
}

export function summarizeRows(rows: ProvenanceRow[]): FootprintSummary {
  let wh = 0; let any = false; let unestimated = 0;
  for (const r of rows) {
    if (r.energyWhEstimate === null) unestimated++;
    else { wh += r.energyWhEstimate; any = true; }
  }
  return {
    calls: rows.length,
    tokensIn: rows.reduce((n, r) => n + r.tokensIn, 0),
    tokensOut: rows.reduce((n, r) => n + r.tokensOut, 0),
    energyWhEstimate: any ? Math.round(wh * 1000) / 1000 : null,
    unestimated,
    models: [...new Set(rows.map(r => r.model))],
  };
}
