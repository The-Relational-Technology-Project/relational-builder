/**
 * Supabase Edge Function: admin-requests — the steward's side of the door,
 * and the rest of the super admin dashboard's server half.
 *
 * Only super admins may call it: the caller's verified session email must be
 * in SUPER_ADMIN_EMAILS.
 *
 * POST JSON — account requests:
 *   { action: "list" }                     → { requests: [...] }
 *   { action: "approve", id }              → adds community membership,
 *                                            emails the person a welcome
 *   { action: "decline", id }              → marks declined (no email —
 *                                            the steward reaches out
 *                                            personally when it matters)
 *
 * POST JSON — commons review queue (proxied to the RT Commons project's
 * steward-bridge function; the commons keeps its own review logic):
 *   { action: "commons_list" }             → { contributions: [...] }
 *   { action: "commons_review", id,
 *     decision: "approve" | "reject",
 *     notes? }                             → review result, passed through
 *
 * POST JSON — studio gallery curation (which KB tools belong to which
 * studios; reads are public, writes come only through here):
 *   { action: "gallery_add", studio_slug, tool_id, tool_name? }
 *   { action: "gallery_remove", studio_slug, tool_id }
 *
 * POST JSON — gallery connections (cross-references between gallery
 * entries; reads are public, writes come only through here):
 *   { action: "reference_add", from_source, from_id, from_title, from_kind?,
 *     to_source, to_id, to_title, to_kind?, relation?, note? }
 *   { action: "reference_set_status", id, status: "suggested" | "confirmed" }
 *   { action: "reference_remove", id }
 *
 * POST JSON — studio access control (gated studios + Studio Admin grants;
 * admins approve members and curate the private library client-side under
 * RLS, but gating a studio and granting the admin role are steward acts):
 *   { action: "studio_access_set", studio_slug, access: "open" | "gated" }
 *   { action: "studio_admin_set", studio_slug, studio_label, email,
 *     grant: boolean }
 *
 * POST JSON — accounts overview (profiles + cloud project counts; both
 * tables are RLS-locked to their owners, so the steward's cross-account
 * view can only exist here, behind the service role):
 *   { action: "accounts" }                 → { accounts: [...] }
 *
 * Deploy: supabase functions deploy admin-requests
 * (verify_jwt ON — every caller is a signed-in steward; the real gate is
 * the SUPER_ADMIN_EMAILS check below.)
 * Secrets:
 *   SUPER_ADMIN_EMAILS  — comma-separated (default joshuanesbit@gmail.com)
 *   RESEND_API_KEY      — for the welcome email (optional but recommended)
 *   APP_URL             — sign-in link target
 *   COMMONS_URL         — RT Commons project URL (default the RTP website
 *                         project)
 *   COMMONS_BRIDGE_KEY  — shared secret for the commons steward-bridge
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

function superAdmins(): string[] {
  return (Deno.env.get('SUPER_ADMIN_EMAILS') ?? 'joshuanesbit@gmail.com')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Verify the caller and check they're a super admin
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!userRes.ok) return json({ error: 'Sign in required' }, 401);
    const user = await userRes.json();
    const callerEmail = String(user.email ?? '').toLowerCase();
    if (!callerEmail || !superAdmins().includes(callerEmail)) {
      return json({ error: 'Not authorized' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? '');

    // --- Commons review queue (proxied to the commons' steward-bridge) ---
    if (action === 'commons_list' || action === 'commons_review') {
      const commonsUrl = Deno.env.get('COMMONS_URL') ?? 'https://odowkowcinyoxejyzhwl.supabase.co';
      const bridgeKey = Deno.env.get('COMMONS_BRIDGE_KEY') ?? '';
      if (!bridgeKey) return json({ error: 'COMMONS_BRIDGE_KEY not configured' }, 500);
      const bridgeBody =
        action === 'commons_list'
          ? { action: 'list' }
          : {
              action: 'review',
              contribution_id: String(body.id ?? ''),
              decision: String(body.decision ?? ''),
              steward_name: callerEmail,
              steward_notes: body.notes ?? null,
            };
      const res = await fetch(`${commonsUrl}/functions/v1/steward-bridge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-bridge-key': bridgeKey },
        body: JSON.stringify(bridgeBody),
      });
      const result = await res.json().catch(() => ({}));
      return json(result, res.status);
    }

    // --- Studio gallery curation ---
    if (action === 'gallery_add' || action === 'gallery_remove') {
      const studioSlug = String(body.studio_slug ?? '').trim().toLowerCase();
      const toolId = String(body.tool_id ?? '').trim();
      if (!studioSlug || !toolId) {
        return json({ error: 'studio_slug and tool_id are required' }, 400);
      }
      if (action === 'gallery_add') {
        const res = await fetch(rest('/studio_gallery_links'), {
          method: 'POST',
          headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
          body: JSON.stringify({
            studio_slug: studioSlug,
            tool_id: toolId,
            tool_name: body.tool_name ?? null,
            added_by: callerEmail,
          }),
        });
        if (!res.ok && res.status !== 409) {
          return json({ error: 'Could not save the gallery link' }, 500);
        }
      } else {
        await fetch(
          rest(
            `/studio_gallery_links?studio_slug=eq.${encodeURIComponent(studioSlug)}` +
              `&tool_id=eq.${encodeURIComponent(toolId)}`,
          ),
          { method: 'DELETE', headers: svc() },
        );
      }
      return json({ ok: true });
    }

    // --- Gallery connections: cross-references between entries ---
    if (action === 'reference_add') {
      const SOURCES = ['kb_tool', 'kb_story', 'commons', 'studio'];
      const RELATIONS = ['mentions', 'used_in', 'paired_with', 'related'];
      const row = {
        from_source: String(body.from_source ?? ''),
        from_id: String(body.from_id ?? '').trim(),
        from_title: String(body.from_title ?? '').trim(),
        from_kind: body.from_kind ? String(body.from_kind) : null,
        to_source: String(body.to_source ?? ''),
        to_id: String(body.to_id ?? '').trim(),
        to_title: String(body.to_title ?? '').trim(),
        to_kind: body.to_kind ? String(body.to_kind) : null,
        relation: RELATIONS.includes(String(body.relation)) ? String(body.relation) : 'mentions',
        note: body.note ? String(body.note).slice(0, 500) : null,
        status: 'confirmed',
        created_by: callerEmail,
      };
      if (
        !SOURCES.includes(row.from_source) || !SOURCES.includes(row.to_source) ||
        !row.from_id || !row.to_id || !row.from_title || !row.to_title
      ) {
        return json({ error: 'from/to source, id, and title are required' }, 400);
      }
      if (row.from_source === row.to_source && row.from_id === row.to_id) {
        return json({ error: 'An entry cannot reference itself' }, 400);
      }
      const res = await fetch(rest('/gallery_references'), {
        method: 'POST',
        headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify(row),
      });
      if (!res.ok && res.status !== 409) {
        return json({ error: 'Could not save the connection' }, 500);
      }
      return json({ ok: true });
    }

    if (action === 'reference_set_status' || action === 'reference_remove') {
      const refId = String(body.id ?? '').trim();
      if (!refId) return json({ error: 'id is required' }, 400);
      if (action === 'reference_remove') {
        await fetch(rest(`/gallery_references?id=eq.${encodeURIComponent(refId)}`), {
          method: 'DELETE',
          headers: svc(),
        });
      } else {
        const status = String(body.status ?? '');
        if (status !== 'suggested' && status !== 'confirmed') {
          return json({ error: 'status must be suggested or confirmed' }, 400);
        }
        const res = await fetch(rest(`/gallery_references?id=eq.${encodeURIComponent(refId)}`), {
          method: 'PATCH',
          headers: svc(),
          body: JSON.stringify({ status }),
        });
        if (!res.ok) return json({ error: 'Could not update the connection' }, 500);
      }
      return json({ ok: true });
    }

    // --- Studio access: gate/ungate a studio ---
    if (action === 'studio_access_set') {
      const studioSlug = String(body.studio_slug ?? '').trim().toLowerCase();
      const access = String(body.access ?? '');
      if (!studioSlug || (access !== 'open' && access !== 'gated')) {
        return json({ error: 'studio_slug and access (open|gated) are required' }, 400);
      }
      const res = await fetch(rest('/studio_settings?on_conflict=studio_slug'), {
        method: 'POST',
        headers: { ...svc(), Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({
          studio_slug: studioSlug,
          access,
          updated_at: new Date().toISOString(),
          updated_by: callerEmail,
        }),
      });
      if (!res.ok) return json({ error: 'Could not save studio access' }, 500);
      return json({ ok: true });
    }

    // --- Studio Admin grants: the role only the steward hands out ---
    if (action === 'studio_admin_set') {
      const studioSlug = String(body.studio_slug ?? '').trim().toLowerCase();
      const studioLabel = String(body.studio_label ?? '').trim() || studioSlug;
      const email = String(body.email ?? '').trim().toLowerCase();
      const grant = body.grant === true;
      if (!studioSlug || !email) {
        return json({ error: 'studio_slug and email are required' }, 400);
      }
      // The person must already have a Builder account — the profile row is
      // how an email becomes a user id
      const profRes = await fetch(
        rest(`/profiles?email=ilike.${encodeURIComponent(email)}&select=id,display_name&limit=1`),
        { headers: svc() },
      );
      const profRows = profRes.ok ? await profRes.json() : [];
      if (profRows.length === 0) {
        return json({ error: `No builder account found for ${email}` }, 404);
      }
      const userId = String(profRows[0].id);
      if (grant) {
        // Granting admin also approves the membership — an admin who can't
        // get through their own door helps nobody
        const res = await fetch(
          rest('/studio_memberships?on_conflict=user_id,studio_slug'),
          {
            method: 'POST',
            headers: { ...svc(), Prefer: 'resolution=merge-duplicates' },
            body: JSON.stringify({
              user_id: userId,
              studio_slug: studioSlug,
              studio_label: studioLabel,
              display_name: profRows[0].display_name ?? null,
              role: 'admin',
              status: 'approved',
            }),
          },
        );
        if (!res.ok) return json({ error: 'Could not grant the admin role' }, 500);
      } else {
        // Revoking admin keeps the membership — they're still a member
        const res = await fetch(
          rest(
            `/studio_memberships?user_id=eq.${encodeURIComponent(userId)}` +
              `&studio_slug=eq.${encodeURIComponent(studioSlug)}`,
          ),
          { method: 'PATCH', headers: svc(), body: JSON.stringify({ role: 'member' }) },
        );
        if (!res.ok) return json({ error: 'Could not revoke the admin role' }, 500);
      }
      return json({ ok: true });
    }

    // --- Accounts overview: every builder, their place, their project count ---
    if (action === 'accounts') {
      const [profilesRes, projectsRes] = await Promise.all([
        fetch(
          rest(
            '/profiles?select=id,email,display_name,full_name,neighborhood,profile_completed,created_at' +
              '&order=created_at.desc&limit=1000',
          ),
          { headers: svc() },
        ),
        fetch(rest('/projects?select=owner_id&limit=10000'), { headers: svc() }),
      ]);
      if (!profilesRes.ok) return json({ error: 'Could not load accounts' }, 500);
      const profiles: Array<Record<string, unknown>> = await profilesRes.json();
      const owners: Array<{ owner_id: string }> = projectsRes.ok ? await projectsRes.json() : [];
      const counts = new Map<string, number>();
      for (const row of owners) {
        counts.set(row.owner_id, (counts.get(row.owner_id) ?? 0) + 1);
      }
      const accounts = profiles.map(p => ({
        id: p.id,
        email: p.email,
        name: p.full_name ?? p.display_name ?? null,
        neighborhood: p.neighborhood ?? null,
        profile_completed: !!p.profile_completed,
        created_at: p.created_at,
        project_count: counts.get(String(p.id)) ?? 0,
      }));
      return json({ accounts });
    }

    if (action === 'list') {
      const res = await fetch(
        rest('/account_requests?select=*&order=created_at.desc&limit=100'),
        { headers: svc() },
      );
      const requests = res.ok ? await res.json() : [];
      return json({ requests });
    }

    const id = String(body.id ?? '');
    if (!id || (action !== 'approve' && action !== 'decline')) {
      return json({ error: 'action must be list, approve, or decline (with id)' }, 400);
    }

    // Load the request
    const reqRes = await fetch(
      rest(`/account_requests?id=eq.${encodeURIComponent(id)}&select=*`),
      { headers: svc() },
    );
    const rows = reqRes.ok ? await reqRes.json() : [];
    if (rows.length === 0) return json({ error: 'Request not found' }, 404);
    const request = rows[0];

    if (action === 'approve') {
      // Membership is what "approved" means — sign-in then just works
      const insertRes = await fetch(rest('/community_members'), {
        method: 'POST',
        headers: { ...svc(), Prefer: 'resolution=ignore-duplicates' },
        body: JSON.stringify({
          email: request.email,
          note: `approved by ${callerEmail}`,
        }),
      });
      if (!insertRes.ok && insertRes.status !== 409) {
        return json({ error: 'Could not create community membership' }, 500);
      }
    }

    await fetch(rest(`/account_requests?id=eq.${encodeURIComponent(id)}`), {
      method: 'PATCH',
      headers: svc(),
      body: JSON.stringify({
        status: action === 'approve' ? 'approved' : 'declined',
        decided_at: new Date().toISOString(),
        decided_by: callerEmail,
      }),
    });

    // Welcome email with the sign-in link — best-effort
    if (action === 'approve') {
      const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
      const appUrl = Deno.env.get('APP_URL') ?? 'https://relational-builder.vercel.app';
      if (resendKey) {
        // Known Studio member? Let them know their history is waiting —
        // the studio_imports row is claimed (opt-in) during onboarding.
        let studioLine = '';
        try {
          const importRes = await fetch(
            rest(
              `/studio_imports?email=eq.${encodeURIComponent(String(request.email ?? '').toLowerCase())}` +
                '&claimed_at=is.null&declined_at=is.null&select=id&limit=1',
            ),
            { headers: svc() },
          );
          const importRows = importRes.ok ? await importRes.json() : [];
          if (importRows.length > 0) {
            studioLine =
              `<p>We see you have a Studio account — you'll be able to bring your ` +
              `profile and project info into Relational Builder during onboarding.</p>`;
          }
        } catch {
          // best-effort: the welcome email goes out either way
        }
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'Relational Builder <hello@relationalbuilder.org>',
            to: [request.email],
            subject: "You're in — welcome to Relational Builder",
            html: [
              `<p>Hi${request.name ? ' ' + esc(request.name) : ''},</p>`,
              `<p>Your Relational Builder account is ready. Free community building is included — no API key, no credit card.</p>`,
              ...(request.studio_label
                ? [`<p>You came in through <strong>${esc(String(request.studio_label))}</strong> — when you sign in, your request to join the studio will already be with its stewards.</p>`]
                : []),
              ...(studioLine ? [studioLine] : []),
              `<p><a href="${appUrl}">Open Relational Builder</a> and sign in with this email address (we'll send you a sign-in link — no password to remember).</p>`,
              `<p>Build something your neighborhood will love.</p>`,
            ].join('\n'),
          }),
        }).catch(() => {});
      }
    }

    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
