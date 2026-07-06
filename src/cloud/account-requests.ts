import { builderClient } from '@/cloud/builder-client';

/**
 * Account requests — the open front door and the steward's dashboard.
 * Requesting needs no account (that's the point); deciding requires a
 * super admin session, verified server-side in the admin-requests function.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

/** Emails that see the super admin dashboard (server enforces the real gate) */
const SUPER_ADMIN_EMAILS = (
  (import.meta.env.VITE_SUPER_ADMIN_EMAILS as string | undefined) ?? 'joshuanesbit@gmail.com'
)
  .split(',')
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
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
  decided_at: string | null;
  decided_by: string | null;
}

export type RequestOutcome = 'pending' | 'already-member';

export async function requestAccount(input: {
  email: string;
  name?: string;
  neighborhood?: string;
  reason?: string;
}): Promise<RequestOutcome> {
  const res = await fetch(`${FUNCTIONS_URL}/request-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send your request');
  return data.status === 'already-member' ? 'already-member' : 'pending';
}

async function adminCall(body: Record<string, unknown>): Promise<Record<string, unknown>> {
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
