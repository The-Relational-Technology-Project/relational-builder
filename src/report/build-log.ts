import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The build log — a structured timeline of a project's initial build.
 *
 * What made hand-written build test briefs compelling wasn't the chat text,
 * it was the story: passes, cut-offs, error fixes, minutes of churn. The
 * moments in that story are already explicit, well-defined points in the
 * build loop (ChatPanel, FixBanner, review-pass) — this store just gives
 * them somewhere to land as timestamped events.
 *
 * Privacy shape: events live in localStorage next to the chat history they
 * describe and never leave the device on their own. They only travel if the
 * builder opts in to sharing a build report (BuildReportCard), which
 * assembles the payload from this store at the moment of consent.
 */

export type BuildEventType =
  /** First build of the project started */
  | 'build_start'
  /** A generation began — detail carries kind · provider · model, so every
   *  later event (cut-off, error, fix) is attributable to a specific reply */
  | 'gen_start'
  /** That generation ended — detail carries kind · duration · outcome.
   *  Two builds once died mid-stream at exactly +6:42 (the llm-proxy edge
   *  function's 400s wall clock); without per-reply start/end events that
   *  pattern took forensics to see. Now it's one line in the timeline. */
  | 'gen_end'
  /** A build reply was cut off — by the output cap or a silently dropped stream */
  | 'reply_cut_off'
  /** An automatic continuation was queued to finish the cut-off reply */
  | 'auto_continuation'
  /** Cut off again with no automatic passes left — the builder had to say "continue" */
  | 'continuation_cap'
  /** Some edits couldn't be applied cleanly to the project files */
  | 'apply_warnings'
  /** The live preview threw an error */
  | 'preview_error'
  /** The preview error cleared — the app renders again. Without this event a
   *  report can end on an open error with no way to tell whether the builder
   *  actually got a working app. */
  | 'preview_recovered'
  /** The one automatic error→fix pass fired */
  | 'auto_error_fix'
  /** The builder clicked "Ask AI to fix it" themselves */
  | 'manual_error_fix'
  /** The background quality review found defects and queued a fix */
  | 'quality_review_fix'
  /** The build (or its continuation chain) landed complete */
  | 'build_ready'
  /** Commons retrieval ran for a send — detail carries the query head and
   *  what survived the relevance floor (slugs · similarities). The eval
   *  data every retrieval-tuning decision has been missing. */
  | 'retrieval'
  /** A finished reply named surfaced commons entries — detail carries their
   *  slugs. Together with 'retrieval' this measures whether surfaced
   *  knowledge actually lands in plans and builds. */
  | 'commons_mentions';

export interface BuildEvent {
  /** Epoch ms */
  at: number;
  type: BuildEventType;
  /** Short human-readable specifics (error head, pass number) */
  detail?: string;
}

/**
 * Where the per-project sharing offer stands. 'armed' means the initial
 * build landed but the ask waits for a calm moment — it becomes 'pending'
 * (the visible consent card) only once the build has settled: nothing
 * generating, no fix queued, no review running, and a quiet stretch after
 * the last build event. 'declined' and 'sent' both retire it for good —
 * the ask is once per project, for the initial build only, and ignoring
 * the card (building on past it) counts as declining.
 */
export type ReportOfferState = 'armed' | 'pending' | 'declined' | 'sent' | null;

/** Enough for any real build's story; a pathological error loop stops adding */
const MAX_EVENTS = 200;
const MAX_DETAIL_CHARS = 240;

interface BuildLogState {
  events: BuildEvent[];
  offer: ReportOfferState;
  record: (type: BuildEventType, detail?: string) => void;
  setOffer: (offer: ReportOfferState) => void;
  /** A fresh project (or a fresh first build) starts a fresh story */
  reset: () => void;
}

export const useBuildLogStore = create<BuildLogState>()(persist((set) => ({
  events: [],
  offer: null,

  record: (type, detail) =>
    set(state =>
      state.events.length >= MAX_EVENTS
        ? state
        : {
            events: [
              ...state.events,
              { at: Date.now(), type, ...(detail ? { detail: detail.slice(0, MAX_DETAIL_CHARS) } : {}) },
            ],
          },
    ),

  setOffer: (offer) => set({ offer }),

  reset: () => set({ events: [], offer: null }),
}), {
  name: 'rb-build-log',
}));

/** Convenience for call sites outside React */
export function recordBuildEvent(type: BuildEventType, detail?: string): void {
  useBuildLogStore.getState().record(type, detail);
}
