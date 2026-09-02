import { adminCall } from '@/cloud/account-requests';

/**
 * The steward's community plan utilization view — who's building on the
 * subsidized plan, what it's costing, and roughly what it's drawing in
 * energy, today and all-time. Usage rows are
 * RLS-locked to each member, so the cross-member read (and the per-model
 * pricing, kept in lockstep with the community-monitor alerts) lives in the
 * admin-requests function; the client just asks.
 */

export interface UsageTotals {
  requests: number;
  tokens: number;
  usd: number;
  /**
   * Estimated energy in watt-hours — the CENTRAL estimate of a band that
   * spans roughly twentyfold. Never render it as a bare number: pass it
   * through `energyBand` / `kitchenEquivalent` in `@/lib/energy`, which
   * carry the reasoning and the honest range.
   */
  wh: number;
}

export interface MemberUsage {
  email: string;
  name: string | null;
  /** Tokens/day allowed on the plan (community_members.daily_token_budget) */
  daily_budget: number | null;
  today: UsageTotals;
  all_time: UsageTotals & { days_active: number };
  /** All-time cost per model, biggest first ('untracked' = no model recorded) */
  models: { model: string; usd: number }[];
}

export interface CommunityUsageReport {
  /** Today's date (UTC) — the day budgets and "today" columns refer to */
  day: string;
  /** Every member with any recorded usage, all-time cost descending */
  members: MemberUsage[];
  totals: { today: UsageTotals; all_time: UsageTotals };
  /** The last 14 days' community-wide tokens, cost and energy, oldest first */
  recent_days: { day: string; tokens: number; usd: number; wh: number }[];
}

export async function adminCommunityUsage(): Promise<CommunityUsageReport> {
  const result = await adminCall({ action: 'community_usage' });
  return result.usage as CommunityUsageReport;
}
