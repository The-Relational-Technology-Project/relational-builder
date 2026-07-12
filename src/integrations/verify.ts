/**
 * Live credential checks for the Services tab. Each check calls the service
 * directly from the browser (all endpoints here are CORS-open — verified) so
 * "Connected" means the credentials actually work, not just that fields were
 * filled in. Services whose APIs refuse browser calls (Resend) degrade to an
 * honest "saved, checked at deploy" outcome instead of a fake green check.
 *
 * None of these calls cost money: they hit settings/list/metadata endpoints,
 * never generation or send endpoints.
 */

export type VerifyResult =
  /** Credentials confirmed working against the live service */
  | { status: 'ok'; detail?: string }
  /** The service said no — wrong key, wrong project, typo */
  | { status: 'invalid'; message: string }
  /** Couldn't tell (network trouble, restricted key) — offer "connect anyway" */
  | { status: 'unknown'; message: string }
  /** This service can't be checked from a browser at all; saving is the best we can do */
  | { status: 'unverifiable'; message: string };

const TIMEOUT_MS = 10_000;

/** fetch that resolves to null on network failure/timeout instead of throwing */
async function tryFetch(url: string, init?: RequestInit): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    return null;
  }
}

const UNREACHABLE = (name: string): VerifyResult => ({
  status: 'unknown',
  message: `Couldn't reach ${name} from here — you can connect anyway and the key will be used as-is.`,
});

async function verifySupabase(values: Record<string, string>): Promise<VerifyResult> {
  const rawUrl = (values.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const key = (values.SUPABASE_ANON_KEY ?? '').trim();
  let host: string;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return { status: 'invalid', message: 'The project URL should start with https://' };
    }
    host = parsed.host;
  } catch {
    return { status: 'invalid', message: 'That doesn’t look like a URL — copy the Project URL from Supabase project settings.' };
  }

  // Auth settings is public-with-apikey on every project and CORS-open
  const res = await tryFetch(`${rawUrl}/auth/v1/settings`, { headers: { apikey: key } });
  if (!res) return UNREACHABLE('your Supabase project');
  if (res.ok) return { status: 'ok', detail: `Project ${host} responded` };
  if (res.status === 401 || res.status === 403) {
    return { status: 'invalid', message: 'The project responded, but this anon key doesn’t belong to it. Copy the anon (public) key from the same project’s API settings.' };
  }
  if (res.status === 404) {
    return { status: 'invalid', message: 'No Supabase project answered at that URL — double-check the Project URL.' };
  }
  return { status: 'unknown', message: `Unexpected reply from the project (HTTP ${res.status}) — you can connect anyway.` };
}

async function verifyNeon(values: Record<string, string>): Promise<VerifyResult> {
  const conn = (values.DATABASE_URL ?? '').trim();
  let host: string;
  try {
    const parsed = new URL(conn);
    if (!/^postgres(ql)?:$/.test(parsed.protocol)) {
      return { status: 'invalid', message: 'Connection strings start with postgresql:// — copy the full string from the Neon console.' };
    }
    if (!parsed.username || !parsed.hostname) {
      return { status: 'invalid', message: 'That connection string is missing its user or host — copy the full string from the Neon console.' };
    }
    host = parsed.hostname;
  } catch {
    return { status: 'invalid', message: 'That doesn’t look like a connection string — copy it from Connection details in the Neon console.' };
  }

  // Neon endpoints speak SQL-over-HTTPS (the same channel the serverless
  // driver uses), so a real `SELECT 1` proves the string works end to end.
  const res = await tryFetch(`https://${host}/sql`, {
    method: 'POST',
    headers: { 'Neon-Connection-String': conn, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'SELECT 1', params: [] }),
  });
  if (!res) {
    return { status: 'unknown', message: 'Couldn’t reach that database host from the browser — the string may still be fine. You can connect anyway; it’s only used in serverless functions after deploy.' };
  }
  if (res.ok) return { status: 'ok', detail: 'Database answered SELECT 1' };
  const body = await res.text().catch(() => '');
  if (/password authentication failed/i.test(body)) {
    return { status: 'invalid', message: 'The database refused the password — re-copy the connection string (Neon shows it with the password filled in).' };
  }
  if (/database .* does not exist|role .* does not exist/i.test(body)) {
    return { status: 'invalid', message: 'The host answered but the database or user in the string doesn’t exist — re-copy it from the Neon console.' };
  }
  return { status: 'unknown', message: 'The host answered but the check didn’t complete — you can connect anyway.' };
}

function verifyResend(values: Record<string, string>): VerifyResult {
  const key = (values.RESEND_API_KEY ?? '').trim();
  if (!key.startsWith('re_')) {
    return { status: 'unknown', message: 'Resend keys start with re_ — double-check you copied an API key, then connect anyway if you’re sure.' };
  }
  return {
    status: 'unverifiable',
    message: 'Resend doesn’t allow browser checks (it’s a server-side service). The key is saved as a secret and gets exercised the first time your deployed app sends an email.',
  };
}

async function verifyFirecrawl(values: Record<string, string>): Promise<VerifyResult> {
  const key = (values.FIRECRAWL_API_KEY ?? '').trim();
  const res = await tryFetch('https://api.firecrawl.dev/v2/team/credit-usage', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res) return UNREACHABLE('Firecrawl');
  if (res.ok) {
    const data = await res.json().catch(() => null) as { data?: { remainingCredits?: number } } | null;
    const credits = data?.data?.remainingCredits;
    return { status: 'ok', detail: typeof credits === 'number' ? `${credits.toLocaleString()} credits remaining` : undefined };
  }
  if (res.status === 401) return { status: 'invalid', message: 'Firecrawl didn’t recognize this key — copy a fresh one from firecrawl.dev → API Keys.' };
  return { status: 'unknown', message: `Unexpected reply from Firecrawl (HTTP ${res.status}) — you can connect anyway.` };
}

async function verifyClaude(values: Record<string, string>): Promise<VerifyResult> {
  const key = (values.ANTHROPIC_API_KEY ?? '').trim();
  const res = await tryFetch('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
  });
  if (!res) return UNREACHABLE('Anthropic');
  if (res.ok) return { status: 'ok', detail: 'Key accepted by the Anthropic API' };
  if (res.status === 401) return { status: 'invalid', message: 'Anthropic didn’t recognize this key — copy a fresh one from platform.claude.com → API Keys.' };
  return { status: 'unknown', message: `Unexpected reply from Anthropic (HTTP ${res.status}) — you can connect anyway.` };
}

async function verifyGemini(values: Record<string, string>): Promise<VerifyResult> {
  const key = (values.GEMINI_API_KEY ?? '').trim();
  // Key as query param = no custom headers = no preflight
  const res = await tryFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}&pageSize=1`);
  if (!res) return UNREACHABLE('Google');
  if (res.ok) return { status: 'ok', detail: 'Key accepted by the Gemini API' };
  if (res.status === 400 || res.status === 401) {
    return { status: 'invalid', message: 'Google didn’t recognize this key — copy a fresh one from aistudio.google.com.' };
  }
  if (res.status === 403) {
    return { status: 'unknown', message: 'The key exists but is restricted (Google keys can be locked to specific sites or APIs). It may still work in your deployed app — you can connect anyway.' };
  }
  return { status: 'unknown', message: `Unexpected reply from Google (HTTP ${res.status}) — you can connect anyway.` };
}

async function verifyOpenAI(values: Record<string, string>): Promise<VerifyResult> {
  const key = (values.OPENAI_API_KEY ?? '').trim();
  const res = await tryFetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res) return UNREACHABLE('OpenAI');
  if (res.ok) return { status: 'ok', detail: 'Key accepted by the OpenAI API' };
  if (res.status === 401) return { status: 'invalid', message: 'OpenAI didn’t recognize this key — copy a fresh one from platform.openai.com → API keys.' };
  return { status: 'unknown', message: `Unexpected reply from OpenAI (HTTP ${res.status}) — you can connect anyway.` };
}

const CHECKS: Record<string, (values: Record<string, string>) => VerifyResult | Promise<VerifyResult>> = {
  supabase: verifySupabase,
  neon: verifyNeon,
  resend: verifyResend,
  firecrawl: verifyFirecrawl,
  claude: verifyClaude,
  gemini: verifyGemini,
  openai: verifyOpenAI,
};

/** Check an integration's credentials against the live service. */
export async function verifyIntegration(
  id: string,
  values: Record<string, string>,
): Promise<VerifyResult> {
  const check = CHECKS[id];
  if (!check) return { status: 'unverifiable', message: 'No live check exists for this service yet.' };
  return check(values);
}
