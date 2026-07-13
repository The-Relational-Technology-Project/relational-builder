/**
 * The sign-in gate — approval opens the door.
 *
 * Before a magic link is sent, the signin-gate function checks the email:
 * existing accounts and approved members walk through; everyone else gets a
 * friendly pointer to the request-account form instead of a dead-end email.
 * If the gate itself is unreachable we fail OPEN: Supabase Auth still
 * refuses to create unapproved accounts (shouldCreateUser: false +
 * disable_signup), so an outage can never lock existing builders out.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

export type SignInGateStatus = 'member' | 'pending' | 'not-approved' | 'unknown';

export interface SignInGateResult {
  allowed: boolean;
  status: SignInGateStatus;
}

export async function checkSignInGate(email: string): Promise<SignInGateResult> {
  try {
    const res = await fetch(`${FUNCTIONS_URL}/signin-gate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.allowed !== 'boolean') {
      return { allowed: true, status: 'unknown' };
    }
    return { allowed: data.allowed, status: (data.status as SignInGateStatus) ?? 'unknown' };
  } catch {
    return { allowed: true, status: 'unknown' };
  }
}

/** The friendly copy for a closed door — shown right under the sign-in form */
export function gateMessage(status: SignInGateStatus): string {
  return status === 'pending'
    ? 'Your account request is still with the stewards — you’ll get a welcome email the moment it’s approved, and then you can sign in right here.'
    : 'This email doesn’t have a Builder account yet. Request an account (it’s the form on the home page) and a steward will wave you in with a welcome email.';
}
