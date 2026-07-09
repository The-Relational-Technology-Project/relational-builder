/**
 * Supabase Edge Function: studio-import — the opt-in door for RT Studio
 * members bringing their history into the Builder.
 *
 * The one-time Studio export lives in public.studio_imports (RLS enabled,
 * no policies — only this function's service role can see it). Nothing is
 * imported until the person says yes during onboarding; declining erases
 * their staged payload.
 *
 * Any signed-in builder may call it — rows are matched strictly on the
 * caller's verified email, so you can only ever see your own Studio data.
 *
 * POST JSON:
 *   { action: "check" }   → { available, display_name?, plan_count? }
 *                           (is there an unclaimed row for my email?)
 *   { action: "claim" }   → { profile: {...}, imported_prompts }
 *                           marks the row claimed, imports the member's
 *                           Studio build plans as Builder prompts (lineage
 *                           marks their Studio origin), and returns the
 *                           profile fields so onboarding can prefill
 *   { action: "decline" } → { ok: true } — marks declined and erases the
 *                           staged profile + plans payload
 *
 * Deploy: supabase functions deploy studio-import
 * (verify_jwt stays ON — every caller is a signed-in builder, so the
 * platform gate composes with the email-scoped checks below.)
 * Secrets: none beyond the standard SUPABASE_* runtime ones.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function svc(): Record<string, string> {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  return { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

function rest(path: string): string {
  return `${Deno.env.get('SUPABASE_URL')}/rest/v1${path}`;
}

interface StudioPlan {
  id?: string;
  title?: string;
  detailed_prompt?: string;
  plan_markdown?: string;
  recommended_track?: string;
  share_id?: string;
  is_shared?: boolean;
  library_item_ids?: unknown;
  source_chat_summary?: string;
  created_at?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Who's asking? Rows are matched on the verified session email only.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in required' }, 401);
    const user = await userRes.json();
    const email = String(user.email ?? '').trim().toLowerCase();
    const userId = String(user.id ?? '');
    if (!email || !userId) return json({ error: 'Sign in required' }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    const rowUrl =
      rest('/studio_imports') +
      `?email=eq.${encodeURIComponent(email)}&claimed_at=is.null&declined_at=is.null&select=*&limit=1`;

    if (action === 'check') {
      const res = await fetch(rowUrl, { headers: svc() });
      const rows = res.ok ? await res.json() : [];
      if (rows.length === 0) return json({ available: false });
      const row = rows[0];
      const plans: StudioPlan[] = Array.isArray(row.build_plans) ? row.build_plans : [];
      return json({
        available: true,
        display_name: row.profile?.display_name ?? row.profile?.full_name ?? null,
        plan_count: plans.length,
      });
    }

    if (action === 'claim') {
      // Compare-and-set claim so a double-click can't import twice
      const claimRes = await fetch(
        rest('/studio_imports') +
          `?email=eq.${encodeURIComponent(email)}&claimed_at=is.null&declined_at=is.null`,
        {
          method: 'PATCH',
          headers: { ...svc(), Prefer: 'return=representation' },
          body: JSON.stringify({ claimed_at: new Date().toISOString(), claimed_by: userId }),
        },
      );
      const claimed = claimRes.ok ? await claimRes.json() : [];
      if (claimed.length === 0) return json({ error: 'Nothing to bring over for this email' }, 404);
      const row = claimed[0];
      const profile = row.profile ?? {};
      const plans: StudioPlan[] = Array.isArray(row.build_plans) ? row.build_plans : [];

      // Studio build plans → Builder prompts, provenance in lineage
      let imported = 0;
      if (plans.length > 0) {
        const authorName = profile.display_name ?? profile.full_name ?? null;
        const inserts = plans
          .filter(p => (p.detailed_prompt ?? '').trim())
          .map(p => ({
            owner_id: userId,
            title: p.title || 'Untitled Studio build plan',
            body: p.detailed_prompt,
            author_name: authorName,
            lineage: {
              source: 'rt-studio',
              studio_plan_id: p.id ?? null,
              studio_share_id: p.share_id ?? null,
              recommended_track: p.recommended_track ?? null,
              library_item_ids: p.library_item_ids ?? null,
              source_chat_summary: p.source_chat_summary ?? null,
              plan_markdown: p.plan_markdown ?? null,
              studio_created_at: p.created_at ?? null,
              imported_at: new Date().toISOString(),
            },
          }));
        if (inserts.length > 0) {
          const insRes = await fetch(rest('/prompts'), {
            method: 'POST',
            headers: { ...svc(), Prefer: 'return=representation' },
            body: JSON.stringify(inserts),
          });
          if (insRes.ok) imported = (await insRes.json()).length;
        }
      }

      return json({
        profile: {
          display_name: profile.display_name ?? null,
          full_name: profile.full_name ?? null,
          neighborhood: profile.neighborhood ?? null,
          neighborhood_description: profile.neighborhood_description ?? null,
          dreams: profile.dreams ?? null,
          tech_familiarity: profile.tech_familiarity ?? null,
          ai_coding_experience: profile.ai_coding_experience ?? null,
        },
        imported_prompts: imported,
      });
    }

    if (action === 'decline') {
      // No is no: the staged payload is erased, only the bookkeeping stays
      await fetch(
        rest('/studio_imports') +
          `?email=eq.${encodeURIComponent(email)}&claimed_at=is.null&declined_at=is.null`,
        {
          method: 'PATCH',
          headers: svc(),
          body: JSON.stringify({ declined_at: new Date().toISOString(), profile: {}, build_plans: [] }),
        },
      );
      return json({ ok: true });
    }

    return json({ error: 'action must be check, claim, or decline' }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
