import { adminCall } from '@/cloud/account-requests';

/**
 * The steward's accounts overview — every builder, their place, and how many
 * cloud projects they've made. Profiles and projects are RLS-locked to their
 * owners, so this cross-account read lives in the admin-requests function
 * (service role, super-admin gated); the client just asks.
 */

export interface StewardAccount {
  id: string;
  email: string;
  name: string | null;
  neighborhood: string | null;
  profile_completed: boolean;
  created_at: string;
  /** Cloud projects owned — local-only (shelf) builds are invisible here */
  project_count: number;
}

export async function adminListAccounts(): Promise<StewardAccount[]> {
  const result = await adminCall({ action: 'accounts' });
  return (result.accounts as StewardAccount[]) ?? [];
}
