/**
 * steward-bridge — lets the Relational Builder's super admin dashboard
 * steward the commons contribution queue without holding commons secrets.
 *
 * Deployed to the RT Commons project. The Builder's admin-requests function
 * (which has already verified the caller is a super admin) calls this with
 * the shared STEWARD_BRIDGE_KEY; this function then reads the queue with its
 * own service role and forwards decisions to the commons' canonical
 * review-contribution function using the STEWARD_KEY available in this
 * project's environment. Review logic stays in one place; the Builder only
 * ever holds the narrow bridge key (list + review, nothing else).
 *
 * POST JSON (header x-bridge-key: <STEWARD_BRIDGE_KEY>):
 *   { action: "list" }
 *     → { contributions: [...] }  (pending first, then recent decisions)
 *   { action: "review", contribution_id, decision: "approve" | "reject",
 *     steward_name?, steward_notes? }
 *     → review-contribution's response, passed through
 *
 * Secrets: STEWARD_BRIDGE_KEY (bridge auth), STEWARD_KEY (already set),
 *          SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-provisioned)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-bridge-key',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  // Fail closed until the bridge key secret exists
  const bridgeKey = Deno.env.get('STEWARD_BRIDGE_KEY') ?? '';
  if (!bridgeKey || req.headers.get('x-bridge-key') !== bridgeKey) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) return json({ error: 'Missing environment' }, 500);

  const svc = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    if (action === 'list') {
      const select =
        'id,source_studio_slug,proposed_kind,proposed_slug,proposed_title,proposed_summary,' +
        'proposed_body,proposed_attribution,proposed_tags,proposed_metadata,status,' +
        'steward,steward_notes,submitted_at,reviewed_at';
      const [pendingRes, decidedRes] = await Promise.all([
        fetch(
          `${supabaseUrl}/rest/v1/commons_contributions?select=${select}` +
            `&status=in.(pending,changes_requested)&order=submitted_at.asc&limit=100`,
          { headers: svc },
        ),
        fetch(
          `${supabaseUrl}/rest/v1/commons_contributions?select=${select}` +
            `&status=in.(approved,rejected)&order=reviewed_at.desc&limit=15`,
          { headers: svc },
        ),
      ]);
      const pending = pendingRes.ok ? await pendingRes.json() : [];
      const decided = decidedRes.ok ? await decidedRes.json() : [];
      return json({ contributions: [...pending, ...decided] });
    }

    if (action === 'review') {
      const contributionId = String(body.contribution_id ?? '');
      const decision = String(body.decision ?? '');
      if (!contributionId || (decision !== 'approve' && decision !== 'reject')) {
        return json({ error: "review needs contribution_id and decision ('approve' | 'reject')" }, 400);
      }
      const stewardKey = Deno.env.get('STEWARD_KEY') ?? '';
      if (!stewardKey) return json({ error: 'STEWARD_KEY not configured on the commons project' }, 500);

      // Forward to the canonical reviewer — approval side effects (item
      // publication, embeddings, feed events) stay in one implementation
      const res = await fetch(`${supabaseUrl}/functions/v1/review-contribution`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-steward-key': stewardKey,
          apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? serviceKey,
        },
        body: JSON.stringify({
          contribution_id: contributionId,
          action: decision,
          steward_name: body.steward_name ?? null,
          steward_notes: body.steward_notes ?? null,
          ...(body.overrides ? { overrides: body.overrides } : {}),
        }),
      });
      const result = await res.json().catch(() => ({}));
      return json(result, res.status);
    }

    return json({ error: "action must be 'list' or 'review'" }, 400);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
