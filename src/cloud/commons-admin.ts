import { adminCall } from '@/cloud/account-requests';

/**
 * The commons review queue, absorbed into the super admin dashboard.
 * Reads and decisions go through the Builder's admin-requests function,
 * which proxies to the RT Commons project's steward-bridge — the Builder
 * client never touches commons credentials, and review side effects
 * (publication, embeddings, feed events) stay in the commons' own
 * review-contribution function.
 */

export interface CommonsContribution {
  id: string;
  source_studio_slug: string;
  proposed_kind: string;
  proposed_slug: string | null;
  proposed_title: string;
  proposed_summary: string | null;
  proposed_body: string | null;
  proposed_attribution: { name?: string; neighborhood?: string } | null;
  proposed_tags: string[] | null;
  proposed_metadata: Record<string, unknown> | null;
  status: 'pending' | 'changes_requested' | 'approved' | 'rejected';
  steward: string | null;
  steward_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export async function adminListContributions(): Promise<CommonsContribution[]> {
  const result = await adminCall({ action: 'commons_list' });
  return (result.contributions as CommonsContribution[]) ?? [];
}

export async function adminReviewContribution(
  id: string,
  decision: 'approve' | 'reject',
  notes?: string,
): Promise<void> {
  await adminCall({ action: 'commons_review', id, decision, notes: notes || undefined });
}
