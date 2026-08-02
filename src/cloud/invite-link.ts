import { builderClient } from '@/cloud/builder-client';

/**
 * Invite links — `?invite=<project id>&to=<invited email>`.
 *
 * The collaborator email used to point at the bare app origin, which meant
 * clicking it opened whatever account the browser was already signed into and
 * showed exactly nothing: membership is matched on the JWT's email, so a
 * project invited to one address is simply absent from another's list. There
 * was no code anywhere that compared the two, so there was nothing to say.
 *
 * The link now carries both halves, and they're stashed the moment the page
 * loads because the params do not survive the round trip: signing in sends a
 * magic link whose redirect lands on the site root, stripping the query. The
 * pending invite outlives that and is consumed on the way back in.
 */

const PENDING_KEY = 'rb-pending-invite';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PendingInvite {
  projectId: string;
  /** The address the invitation was actually sent to */
  email: string;
}

function read(): PendingInvite | null {
  try {
    const raw = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null');
    if (!raw || typeof raw !== 'object') return null;
    const { projectId, email } = raw as Partial<PendingInvite>;
    if (typeof projectId !== 'string' || !UUID_RE.test(projectId)) return null;
    if (typeof email !== 'string' || !email.includes('@')) return null;
    return { projectId, email: email.toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Take the invite out of the address bar and hold onto it. Scrubbing the
 * params keeps the invited address from riding along in every subsequent
 * link, bookmark, or shared screenshot — it has done its job by now.
 */
export function captureInviteFromUrl(): void {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return;
  }
  const projectId = params.get('invite');
  const email = params.get('to');
  if (!projectId) return;

  if (UUID_RE.test(projectId) && email && email.includes('@')) {
    try {
      localStorage.setItem(
        PENDING_KEY,
        JSON.stringify({ projectId, email: email.trim().toLowerCase() }),
      );
    } catch {
      // Private-mode storage failures shouldn't strand someone on a blank page
    }
  }

  params.delete('invite');
  params.delete('to');
  const qs = params.toString();
  window.history.replaceState(
    null,
    '',
    window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash,
  );
}

export function getPendingInvite(): PendingInvite | null {
  return read();
}

export function clearPendingInvite(): void {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    // Nothing to do — worst case the banner offers itself once more
  }
}

/** Whether the signed-in address is the one the invitation was sent to */
export function inviteMatches(invite: PendingInvite, email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === invite.email;
}

/**
 * Ask the project's owner to invite the address you're actually signed in as.
 * Grants nothing — it puts the ask in the owner's inbox, and they add you from
 * the same Collaborate dialog they'd use anyway.
 */
export async function requestProjectAccess(
  invite: PendingInvite,
  message: string,
): Promise<'sent' | 'already-member'> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first');
  const url = import.meta.env.VITE_BUILDER_SUPABASE_URL;
  const res = await fetch(`${url}/functions/v1/request-project-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      project_id: invite.projectId,
      invited_email: invite.email,
      message,
    }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error ?? 'Could not send your request');
  return result.status === 'already-member' ? 'already-member' : 'sent';
}
