/**
 * Supabase Edge Function: signin-gate — approval is what opens the door.
 *
 * The sign-in form asks here before sending a magic link. Three answers:
 *   - An account already exists (profiles row) → allowed. Existing builders
 *     are never affected by the gate.
 *   - The email is approved (community_members) but has never signed in →
 *     the auth user is created right here (service role, email confirmed),
 *     then allowed. This also backfills anyone approved before approval
 *     started creating auth users.
 *   - Neither → not allowed; the client shows a friendly pointer to the
 *     request-account form ('pending' if their request is still waiting,
 *     'invited' if an existing builder has invited them to a project — still
 *     not allowed, but the copy can say so instead of implying a dead end,
 *     and the referral rides along on the account request for the steward).
 *
 * The real enforcement is Supabase Auth itself: the client sends OTPs with
 * shouldCreateUser: false and the project has disable_signup: true, so a
 * magic link can only ever reach an email that already has an account —
 * i.e. one that came through approval. This function is the UX (friendly
 * messages) plus the just-in-time user creation for approved members.
 *
 * POST JSON: { email }
 *   → { allowed: true, status: 'member' }
 *   → { allowed: false, status: 'pending' | 'not-approved' }
 *   - No auth (the caller is signed out by definition); per-IP rate limited
 *   - Reveals only what request-account already reveals (member / pending)
 *
 * Deploy: supabase functions deploy signin-gate --no-verify-jwt
 * Secrets: none beyond the standard SUPABASE_* runtime ones.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RATE_LIMIT_PER_HOUR = 20;
const ipCounts = new Map<string, { hour: string; count: number }>();

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

/**
 * An unclaimed project invitation for this address, with who sent it.
 * Informational: it never grants entry, it only lets the door explain itself
 * (and rides along on the account request so the steward sees the referral).
 */
async function pendingInvite(
  email: string,
): Promise<{ inviterEmail: string | null; projectName: string | null } | null> {
  const res = await fetch(
    rest(
      `/project_members?email=eq.${encodeURIComponent(email)}&user_id=is.null&select=invited_by,project_id&limit=1`,
    ),
    { headers: svc() },
  );
  const rows = res.ok ? await res.json() : [];
  if (rows.length === 0) return null;

  let inviterEmail: string | null = null;
  if (rows[0].invited_by) {
    const who = await fetch(
      rest(`/profiles?id=eq.${encodeURIComponent(rows[0].invited_by)}&select=email&limit=1`),
      { headers: svc() },
    );
    const whoRows = who.ok ? await who.json() : [];
    inviterEmail = whoRows[0]?.email ?? null;
  }

  let projectName: string | null = null;
  if (rows[0].project_id) {
    const proj = await fetch(
      rest(`/projects?id=eq.${encodeURIComponent(rows[0].project_id)}&select=name&limit=1`),
      { headers: svc() },
    );
    const projRows = proj.ok ? await proj.json() : [];
    projectName = projRows[0]?.name ?? null;
  }

  return { inviterEmail, projectName };
}

/** Create the auth user for an approved email; an already-existing user is success too */
async function ensureAuthUser(email: string): Promise<boolean> {
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/admin/users`, {
    method: 'POST',
    headers: svc(),
    body: JSON.stringify({ email, email_confirm: true }),
  });
  // 422 = "already been registered" — the account exists, which is the goal
  return res.ok || res.status === 422;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    // Soft per-IP rate limit (per warm isolate) — enough to stop scripts
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const hour = new Date().toISOString().slice(0, 13);
    const bucket = ipCounts.get(ip);
    if (bucket && bucket.hour === hour && bucket.count >= RATE_LIMIT_PER_HOUR) {
      return json({ error: 'Too many requests — try again in a bit' }, 429);
    }
    ipCounts.set(ip, { hour, count: bucket?.hour === hour ? bucket.count + 1 : 1 });

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: 'A real email address is required' }, 400);
    }

    // An existing account signs in, member or not — the gate only guards
    // account CREATION, never people who are already inside
    const profRes = await fetch(
      rest(`/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`),
      { headers: svc() },
    );
    const profRows = profRes.ok ? await profRes.json() : [];
    if (profRows.length > 0) {
      return json({ allowed: true, status: 'member' });
    }

    // Approved but never signed in → create their auth user now, then allow
    const memberRes = await fetch(
      rest(`/community_members?email=eq.${encodeURIComponent(email)}&select=email&limit=1`),
      { headers: svc() },
    );
    const members = memberRes.ok ? await memberRes.json() : [];
    if (members.length > 0) {
      if (!(await ensureAuthUser(email))) {
        return json({ error: 'Could not prepare your account — try again in a moment' }, 500);
      }
      return json({ allowed: true, status: 'member' });
    }

    // Not approved (yet) — say whether their request is still in the queue
    const reqRes = await fetch(
      rest(`/account_requests?email=eq.${encodeURIComponent(email)}&select=status&limit=1`),
      { headers: svc() },
    );
    const requests = reqRes.ok ? await reqRes.json() : [];
    const pending = requests.length > 0 && requests[0].status === 'pending';
    if (pending) return json({ allowed: false, status: 'pending' });

    // An outstanding project invitation doesn't open the door — every new
    // builder still goes past a steward — but it changes what we can honestly
    // say at it. Being told "this email doesn't have an account" right after
    // an email promised the project would be waiting reads as a broken tool.
    const invite = await pendingInvite(email);
    if (invite) {
      return json({
        allowed: false,
        status: 'invited',
        invited_by: invite.inviterEmail,
        project_name: invite.projectName,
      });
    }

    return json({ allowed: false, status: 'not-approved' });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
