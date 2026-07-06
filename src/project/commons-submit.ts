/**
 * Submit a finished build to the RT Commons contribution queue.
 *
 * Consent-gated by design: `builder_confirmed` must only be sent after the
 * builder has reviewed exactly what will be shared and said yes. Submissions
 * land as `pending` for steward review — nothing is public until approved.
 */

const COMMONS_URL =
  import.meta.env.VITE_COMMONS_SUPABASE_URL ?? 'https://odowkowcinyoxejyzhwl.supabase.co';

const COMMONS_ANON_KEY =
  import.meta.env.VITE_COMMONS_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kb3drb3djaW55b3hlanl6aHdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2OTE5MzksImV4cCI6MjA3MDI2NzkzOX0.2Y2Dw66ORJ5DyBA11H5ziNFtdH1dG9BcOmFWYSicTSc';

export interface CommonsSubmission {
  title: string;
  summary: string;
  body?: string;
  builderName: string;
  neighborhood?: string;
  contactEmail?: string;
  sourceUrl?: string;
  tags?: string[];
}

export interface SubmitResult {
  ok: boolean;
  contributionId?: string;
  error?: string;
}

export async function submitToCommons(submission: CommonsSubmission): Promise<SubmitResult> {
  try {
    // Builds grow inside a studio frame — the contribution carries it, so
    // studio-scoped views of the commons know where this one came from
    const { useStudioStore } = await import('@/store/studio-store');
    const activeStudio = useStudioStore.getState().activeStudio;

    const res = await fetch(`${COMMONS_URL}/functions/v1/submit-contribution`, {
      method: 'POST',
      headers: {
        apikey: COMMONS_ANON_KEY,
        Authorization: `Bearer ${COMMONS_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contribution_type: 'tool',
        title: submission.title,
        summary: submission.summary,
        body: submission.body,
        builder_name: submission.builderName,
        neighborhood: submission.neighborhood || undefined,
        contact_email: submission.contactEmail || undefined,
        source_url: submission.sourceUrl || undefined,
        tags: submission.tags?.slice(0, 8),
        submitted_via: 'relational-builder',
        ...(activeStudio
          ? { studio_slug: activeStudio.slug, studio_label: activeStudio.label }
          : {}),
        // The UI only calls this after the builder reviewed the draft and
        // explicitly checked the consent box
        builder_confirmed: true,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data.error ?? `Submission failed (${res.status})` };
    }
    // Offering a build to the commons is studio life too (best-effort)
    if (activeStudio) {
      void import('@/cloud/studios').then(({ recordStudioActivity }) =>
        recordStudioActivity('publish', activeStudio.slug, submission.title, submission.sourceUrl),
      );
    }
    return { ok: true, contributionId: data.contribution_id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Submission failed' };
  }
}
