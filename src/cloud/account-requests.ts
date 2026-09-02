import { builderClient } from '@/cloud/builder-client';

/**
 * Account requests — the open front door and the steward's dashboard.
 * Requesting needs no account (that's the point); deciding requires a
 * super admin session, verified server-side in the admin-requests function.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

/**
 * The stewards — who sees the Steward dashboard. Kept in code so the list is
 * reviewable and travels with a deploy instead of living only in a hosting
 * dashboard; `VITE_SUPER_ADMIN_EMAILS` adds to it rather than replacing it,
 * so a missing (or stale) env var can never lock the stewards out. Removing
 * someone is a code change, which is the point: it leaves a trace.
 * This gate is for the UI only — the admin-requests function keeps its own
 * copy and is the real boundary.
 */
const STEWARD_EMAILS = ['joshuanesbit@gmail.com', 'deborah@relationaltechproject.org'];

const SUPER_ADMIN_EMAILS = [
  ...STEWARD_EMAILS,
  ...((import.meta.env.VITE_SUPER_ADMIN_EMAILS as string | undefined) ?? '').split(','),
]
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

export function isSuperAdmin(email: string | null | undefined): boolean {
  return !!email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface AccountRequest {
  id: string;
  email: string;
  name: string | null;
  neighborhood: string | null;
  reason: string | null;
  /** The studio doorway they arrived through (?studio=slug), if any */
  studio_slug: string | null;
  studio_label: string | null;
  /** An existing builder's project invitation waiting on this address. Never
   *  grants anything — it's the referral, so approving is an informed call. */
  invited_by_email: string | null;
  invited_project_name: string | null;
  /** A builder's personal invite code, validated server-side. Unlike a
   *  project invitation this one DOES grant access: the request arrives
   *  already approved, and the steward sees it here after the fact. */
  referral_code: string | null;
  /** A steward-minted event code — grants access the same way, and tags the
   *  joiner's profile as a participant of that event at first sign-in. */
  event_code: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export type RequestOutcome = 'pending' | 'already-member' | 'approved';

export interface RequestResult {
  status: RequestOutcome;
  /** How the referral code fared, when one was sent: 'accepted' came with
   *  status 'approved'; 'unknown' means it matched nobody and the request
   *  fell back to the normal pending flow. */
  referral: 'accepted' | 'unknown' | null;
}

export async function requestAccount(input: {
  email: string;
  name?: string;
  neighborhood?: string;
  reason?: string;
  /** Studio doorway (?studio=slug) — files their join request at first sign-in */
  studioSlug?: string;
  studioLabel?: string;
  /** A builder's invite code (?ref=CODE) — a valid one approves on the spot */
  referralCode?: string;
}): Promise<RequestResult> {
  const { studioSlug, studioLabel, referralCode, ...rest } = input;
  const res = await fetch(`${FUNCTIONS_URL}/request-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...rest,
      ...(studioSlug ? { studio_slug: studioSlug, studio_label: studioLabel } : {}),
      ...(referralCode?.trim() ? { referral_code: referralCode.trim() } : {}),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send your request');
  const status: RequestOutcome =
    data.status === 'already-member' || data.status === 'approved' ? data.status : 'pending';
  const referral =
    data.referral === 'accepted' || data.referral === 'unknown' ? data.referral : null;
  return { status, referral };
}

/** Authenticated call into the admin-requests function (shared by the whole super admin dashboard) */
export async function adminCall(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first');
  const res = await fetch(`${FUNCTIONS_URL}/admin-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((result as { error?: string }).error ?? 'Request failed');
  return result as Record<string, unknown>;
}

export async function adminListRequests(): Promise<AccountRequest[]> {
  const result = await adminCall({ action: 'list' });
  return (result.requests as AccountRequest[]) ?? [];
}

export async function adminDecideRequest(id: string, action: 'approve' | 'decline'): Promise<void> {
  await adminCall({ action, id });
}
