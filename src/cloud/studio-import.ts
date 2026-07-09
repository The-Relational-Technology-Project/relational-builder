import { builderClient } from '@/cloud/builder-client';

/**
 * The opt-in bridge from RT Studio: a one-time export of Studio members'
 * profiles and build plans sits staged server-side (service-role only).
 * During onboarding — or from profile editing, for people who joined
 * before the migration — a Studio member can claim it: profile fields
 * prefill, and their build plans land in the prompt library with lineage
 * marking the Studio origin. Declining erases their staged data.
 *
 * All matching happens server-side on the verified session email; the
 * client never sees anyone else's staged data.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

export interface StudioImportCheck {
  available: boolean;
  display_name: string | null;
  plan_count: number;
}

export interface StudioImportedProfile {
  display_name: string | null;
  full_name: string | null;
  neighborhood: string | null;
  neighborhood_description: string | null;
  dreams: string | null;
  tech_familiarity: string | null;
  ai_coding_experience: string | null;
}

async function call(action: 'check' | 'claim' | 'decline'): Promise<Record<string, unknown>> {
  if (!builderClient) throw new Error('Cloud backend not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in first');
  const res = await fetch(`${FUNCTIONS_URL}/studio-import`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((result as { error?: string }).error ?? 'Request failed');
  return result as Record<string, unknown>;
}

/** Is there unclaimed Studio data waiting for the signed-in email? */
export async function checkStudioImport(): Promise<StudioImportCheck> {
  const r = await call('check');
  return {
    available: !!r.available,
    display_name: (r.display_name as string | null) ?? null,
    plan_count: Number(r.plan_count ?? 0),
  };
}

/** Bring it over: returns profile fields for prefill; plans become prompts server-side */
export async function claimStudioImport(): Promise<{
  profile: StudioImportedProfile;
  imported_prompts: number;
}> {
  const r = await call('claim');
  return {
    profile: r.profile as StudioImportedProfile,
    imported_prompts: Number(r.imported_prompts ?? 0),
  };
}

/** No thanks — erases the staged Studio data for this email */
export async function declineStudioImport(): Promise<void> {
  await call('decline');
}
