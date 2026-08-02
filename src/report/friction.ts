import { builderClient } from '@/cloud/builder-client';
import { useAuthStore } from '@/store/auth-store';

/**
 * Counting the moments a builder acted and the app didn't visibly answer.
 *
 * Every kind here has a fix that would drive it to zero. That is the bar for
 * belonging: if a number can't be driven down by changing something, it is
 * analytics, not instrumentation, and it doesn't go in.
 *
 * - `submit_while_busy` — they sent something mid-generation. Not a failure by
 *   itself; it is the denominator. It only became one when the app said
 *   nothing back.
 * - `duplicate_submit` — the same text sent twice inside a minute. This is the
 *   signature of "nothing happened, did it hear me?", and it is the number to
 *   watch. Leslie hit it three times in one session before anyone knew.
 * - `dropped_submit` — the app refused input and told the person nothing. This
 *   should be structurally impossible now; it is recorded so that if a path
 *   ever reintroduces it, it shows up as a number instead of an email months
 *   later.
 *
 * Never records what was typed. Text someone writes while confused is theirs,
 * and the count is what's actionable anyway.
 */
export type FrictionKind = 'submit_while_busy' | 'duplicate_submit' | 'dropped_submit';

/** Local tally so the number is visible with or without a signed-in account
 *  (workshops run signed-out, and that is exactly the cohort most likely to
 *  hit this). */
const LOCAL_KEY = 'rb-friction-tally';

function bumpLocal(kind: FrictionKind): number {
  try {
    const tally = JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}') as Record<string, number>;
    tally[kind] = (tally[kind] ?? 0) + 1;
    localStorage.setItem(LOCAL_KEY, JSON.stringify(tally));
    return tally[kind];
  } catch {
    return 0;
  }
}

export function frictionTally(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_KEY) ?? '{}');
  } catch {
    return {};
  }
}

/**
 * Fire-and-forget. Instrumentation must never be able to break the thing it
 * measures, so every failure path here is swallowed: no await at call sites,
 * no thrown errors, no retries.
 */
export function recordFriction(kind: FrictionKind, detail: Record<string, unknown> = {}): void {
  bumpLocal(kind);
  const email = useAuthStore.getState().user?.email;
  if (!builderClient || !email) return;
  void builderClient
    .from('friction_events')
    .insert({ email, kind, detail })
    .then(undefined, () => {});
}

/** Same text, twice, inside this window = "did it hear me?" */
const DUPLICATE_WINDOW_MS = 60_000;

let lastSubmit: { text: string; at: number } | null = null;

/**
 * Call on every send attempt. Returns true when this looks like a re-send of
 * the same request — the signature of a person who got no acknowledgement.
 */
export function noteSubmit(text: string): boolean {
  const now = Date.now();
  const trimmed = text.trim();
  const isDuplicate =
    !!lastSubmit && lastSubmit.text === trimmed && now - lastSubmit.at < DUPLICATE_WINDOW_MS;
  if (isDuplicate) {
    recordFriction('duplicate_submit', {
      secondsSinceFirst: Math.round((now - lastSubmit!.at) / 1000),
    });
  }
  lastSubmit = { text: trimmed, at: now };
  return isDuplicate;
}

/** A fresh conversation shouldn't inherit the previous one's last submit. */
export function resetSubmitTracking(): void {
  lastSubmit = null;
}
