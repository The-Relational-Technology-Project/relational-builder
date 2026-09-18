/**
 * Supabase Edge Function: transcribe — a recording in, a transcript out.
 *
 * Dream Recorder's server-side transcription door. The browser engines
 * (Web Speech, on-device Whisper) cover a laptop in the room; this covers
 * the walk: a 40-minute voice memo from a phone, which on-device Whisper
 * would chew on for an hour and likely crash Safari doing it.
 *
 * POST multipart/form-data:
 *   file      — the recording (audio/*, or a video container with audio)
 *   language  — optional ISO-639-1 hint ("en", "es"), otherwise detected
 *
 * Credentials, one of:
 *   x-community-token: <Supabase session token>  — community access, same
 *       allowlist + weekly budget as chat; the shared OpenAI/Gemini key
 *       does the work and never leaves the server
 *   Authorization: Bearer <OpenAI API key>        — bring your own key
 *
 * Engines, in order of preference:
 *   1. OpenAI gpt-4o-transcribe-diarize (speaker labels + timestamps),
 *      falling back to whisper-1 (timestamps) if the diarizing model
 *      refuses the file. Both take files up to 25 MB.
 *   2. Gemini 2.5 Flash via the Files API for bigger recordings (a long
 *      walk) or when no OpenAI key is configured — prompted to write the
 *      same [m:ss] Speaker A: … line format.
 *
 * Response JSON: { transcript, engine, seconds? }
 *   transcript lines look like "[12:40] Speaker A: the thing about the
 *   garden…" so Dream Recorder's distill prompt reads them like its own.
 *
 * The audio is forwarded to the transcription provider and not stored
 * anywhere by this function. Say so in the UI.
 *
 * Deploy: supabase functions deploy transcribe --no-verify-jwt
 * Secrets: OPENAI_COMMUNITY_KEY and/or GEMINI_COMMUNITY_KEY, plus the
 *   Supabase ones the community gate reads (SUPABASE_URL, SUPABASE_ANON_KEY,
 *   SUPABASE_SERVICE_ROLE_KEY) and ALLOWED_ORIGINS.
 */

// ── CORS (same policy as llm-proxy) ──────────────────────────────────

const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function originAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.some((allowed) => {
    if (!allowed.includes('*')) return allowed === origin;
    const pattern = new RegExp('^' + allowed.split('*').map(escapeRegExp).join('.*') + '$');
    return pattern.test(origin);
  });
}

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-community-token',
    Vary: 'Origin',
  };
  if (ALLOWED_ORIGINS.length === 0) headers['Access-Control-Allow-Origin'] = '*';
  else if (origin && originAllowed(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

// ── Limits ───────────────────────────────────────────────────────────

/** Largest recording accepted at all (~2.5 hours of a compressed voice memo) */
const MAX_BYTES = 80 * 1024 * 1024;
/** OpenAI's audio endpoints stop at 25 MB; above that, Gemini's Files API */
const OPENAI_MAX_BYTES = 25 * 1024 * 1024;
/** Transcribing is slow and costly per call — a tight per-credential limit */
const RATE_LIMIT_PER_MIN = Number(Deno.env.get('TRANSCRIBE_RATE_LIMIT_PER_MIN') ?? '6');

const rateBuckets = new Map<string, { count: number; windowStart: number }>();
function rateLimited(key: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

// ── Community gate (mirrors llm-proxy's, without the model check) ────

type Gate = { email: string } | { error: string; status: number };

async function checkCommunityAccess(token: string): Promise<Gate> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey) {
    return { error: 'Community access is not configured on this server', status: 503 };
  }
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) return { error: 'Sign in to transcribe with community access', status: 401 };
  const user = await userRes.json();
  const email = String(user.email ?? '').toLowerCase();
  if (!email) return { error: 'Sign in to transcribe with community access', status: 401 };

  const svc = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const memberRes = await fetch(
    `${supabaseUrl}/rest/v1/community_members?email=eq.${encodeURIComponent(email)}&select=weekly_token_budget`,
    { headers: svc },
  );
  const members = memberRes.ok ? await memberRes.json() : [];
  if (!Array.isArray(members) || members.length === 0) {
    return {
      error:
        "This email isn't part of the community building pilot yet — reach out to the Relational Tech Project to join, or add your own OpenAI API key in Settings.",
      status: 403,
    };
  }
  const budget = Number(members[0].weekly_token_budget ?? 20000000);
  const usageRes = await fetch(
    `${supabaseUrl}/rest/v1/community_usage?email=eq.${encodeURIComponent(email)}&day=gte.${weekStartUtc()}&select=input_tokens,output_tokens,cache_creation_tokens,cache_read_tokens`,
    { headers: svc },
  );
  const usage = usageRes.ok ? await usageRes.json() : [];
  const used = Array.isArray(usage)
    ? usage.reduce(
        (sum: number, row: Record<string, unknown>) =>
          sum +
          Number(row.input_tokens ?? 0) +
          Number(row.output_tokens ?? 0) +
          Number(row.cache_creation_tokens ?? 0) +
          Number(row.cache_read_tokens ?? 0),
        0,
      )
    : 0;
  if (used >= budget) {
    return {
      error:
        "You've reached this week's community building budget — it resets Monday at midnight UTC (Sunday evening in the Americas). Thanks for building!",
      status: 429,
    };
  }
  return { email };
}

function weekStartUtc(now = new Date()): string {
  const sinceMonday = (now.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - sinceMonday))
    .toISOString()
    .slice(0, 10);
}

function recordCommunityUsage(email: string, input: number, output: number, model: string): void {
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!supabaseUrl || !serviceKey || (!input && !output)) return;
  fetch(`${supabaseUrl}/rest/v1/rpc/increment_community_usage`, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_email: email,
      p_input: input,
      p_output: output,
      p_cache_write: 0,
      p_cache_read: 0,
      p_model: model,
    }),
  }).catch(() => {});
}

// ── Transcript formatting ────────────────────────────────────────────

interface Segment {
  start: number;
  text: string;
  speaker?: string;
}

function stamp(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Speaker ids arrive as "A"/"B" or "SPEAKER_00" — normalize to "Speaker A" */
function speakerLabel(raw: string | undefined, seen: Map<string, string>): string | undefined {
  if (!raw) return undefined;
  let label = seen.get(raw);
  if (!label) {
    label = `Speaker ${String.fromCharCode(65 + (seen.size % 26))}`;
    seen.set(raw, label);
  }
  return label;
}

/** Merge consecutive same-speaker segments into readable lines */
function formatSegments(segments: Segment[]): string {
  const seen = new Map<string, string>();
  const lines: string[] = [];
  let current: { start: number; speaker?: string; text: string } | null = null;
  for (const seg of segments) {
    const text = seg.text.trim();
    if (!text) continue;
    const speaker = speakerLabel(seg.speaker, seen);
    const sameSpeaker = current && current.speaker === speaker;
    // Keep lines to a breath or two even for one long monologue
    if (sameSpeaker && current && seg.start - current.start < 30 && current.text.length < 600) {
      current.text += ' ' + text;
      continue;
    }
    if (current) lines.push(renderLine(current));
    current = { start: seg.start, speaker, text };
  }
  if (current) lines.push(renderLine(current));
  return lines.join('\n');
}

function renderLine(l: { start: number; speaker?: string; text: string }): string {
  return `[${stamp(l.start)}]${l.speaker ? ` ${l.speaker}:` : ''} ${l.text}`;
}

interface Result {
  transcript: string;
  engine: string;
  seconds?: number;
  usage?: { input: number; output: number; model: string };
}

// ── OpenAI ───────────────────────────────────────────────────────────

async function openaiTranscribe(
  file: File,
  language: string,
  apiKey: string,
): Promise<Result> {
  // Diarization first — "who said what" is the point for a group
  const diarized = await openaiCall(file, language, apiKey, {
    model: 'gpt-4o-transcribe-diarize',
    response_format: 'diarized_json',
    chunking_strategy: 'auto',
  });
  if (diarized.ok) {
    const data = diarized.data as {
      text?: string;
      duration?: number;
      segments?: { start: number; end: number; speaker?: string; text: string }[];
      usage?: { input_tokens?: number; output_tokens?: number };
    };
    const segments: Segment[] = (data.segments ?? []).map((s) => ({
      start: Number(s.start ?? 0),
      text: String(s.text ?? ''),
      speaker: s.speaker,
    }));
    const transcript = segments.length ? formatSegments(segments) : String(data.text ?? '').trim();
    return {
      transcript,
      engine: 'gpt-4o-transcribe-diarize',
      seconds: data.duration,
      usage: {
        input: Number(data.usage?.input_tokens ?? 0),
        output: Number(data.usage?.output_tokens ?? 0),
        model: 'gpt-4o-transcribe-diarize',
      },
    };
  }

  // Fallback: timestamps without speakers
  const plain = await openaiCall(file, language, apiKey, {
    model: 'whisper-1',
    response_format: 'verbose_json',
  });
  if (!plain.ok) throw new Error(plain.error ?? diarized.error ?? 'Transcription failed');
  const data = plain.data as {
    text?: string;
    duration?: number;
    segments?: { start: number; text: string }[];
  };
  const segments: Segment[] = (data.segments ?? []).map((s) => ({
    start: Number(s.start ?? 0),
    text: String(s.text ?? ''),
  }));
  return {
    transcript: segments.length ? formatSegments(segments) : String(data.text ?? '').trim(),
    engine: 'whisper-1',
    seconds: data.duration,
  };
}

async function openaiCall(
  file: File,
  language: string,
  apiKey: string,
  fields: Record<string, string>,
): Promise<{ ok: true; data: unknown } | { ok: false; error: string; status: number }> {
  const form = new FormData();
  form.append('file', file, file.name || 'recording');
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  if (language) form.append('language', language);
  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      (body as { error?: { message?: string } }).error?.message ??
      `OpenAI transcription failed (${res.status})`;
    return { ok: false, error: msg, status: res.status };
  }
  return { ok: true, data: await res.json() };
}

// ── Gemini (long recordings) ─────────────────────────────────────────

const GEMINI_MODEL = Deno.env.get('TRANSCRIBE_GEMINI_MODEL') ?? 'gemini-2.5-flash';

async function geminiTranscribe(file: File, language: string, apiKey: string): Promise<Result> {
  const base = 'https://generativelanguage.googleapis.com';
  const mime = file.type || 'audio/mpeg';

  // Resumable upload: start → send bytes+finalize
  const start = await fetch(`${base}/upload/v1beta/files?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Protocol': 'resumable',
      'X-Goog-Upload-Command': 'start',
      'X-Goog-Upload-Header-Content-Length': String(file.size),
      'X-Goog-Upload-Header-Content-Type': mime,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ file: { display_name: file.name || 'recording' } }),
  });
  const uploadUrl = start.headers.get('x-goog-upload-url');
  if (!start.ok || !uploadUrl) {
    throw new Error(`Couldn't start the upload to the transcription service (${start.status})`);
  }
  const uploaded = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Type': mime,
    },
    body: file,
  });
  if (!uploaded.ok) throw new Error(`Upload to the transcription service failed (${uploaded.status})`);
  const info = (await uploaded.json()) as { file?: { name?: string; uri?: string; state?: string } };
  const name = info.file?.name;
  const uri = info.file?.uri;
  if (!name || !uri) throw new Error('The transcription service did not accept the file');

  // Wait for processing (long files take a few seconds)
  let state = info.file?.state ?? 'PROCESSING';
  for (let i = 0; i < 60 && state === 'PROCESSING'; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(`${base}/v1beta/${name}?key=${apiKey}`);
    const meta = (await poll.json().catch(() => ({}))) as { state?: string };
    state = meta.state ?? state;
  }
  if (state !== 'ACTIVE') throw new Error('The transcription service could not process that file');

  const prompt =
    `Transcribe this recording of a conversation in full${language ? ` (spoken language: ${language})` : ''}. ` +
    'Output one line per turn of speech, formatted exactly as "[m:ss] Speaker A: what they said", ' +
    'where m:ss is the elapsed time the turn begins and speakers are labeled Speaker A, Speaker B, … ' +
    'consistently by voice. Keep every turn; do not summarize, do not add commentary, do not translate. ' +
    'If there is clearly only one speaker, still label them Speaker A.';

  try {
    const gen = await fetch(`${base}/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ file_data: { mime_type: mime, file_uri: uri } }, { text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
      }),
    });
    const data = (await gen.json().catch(() => ({}))) as {
      error?: { message?: string };
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    if (!gen.ok) throw new Error(data.error?.message ?? `Transcription failed (${gen.status})`);
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim();
    if (!text) throw new Error('The transcription came back empty');
    return {
      transcript: text,
      engine: GEMINI_MODEL,
      usage: {
        input: Number(data.usageMetadata?.promptTokenCount ?? 0),
        output: Number(data.usageMetadata?.candidatesTokenCount ?? 0),
        model: GEMINI_MODEL,
      },
    };
  } finally {
    // Don't leave the recording sitting in the service's file store
    fetch(`${base}/v1beta/${name}?key=${apiKey}`, { method: 'DELETE' }).catch(() => {});
  }
}

// ── Handler ──────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  const CORS = corsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const byok = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const communityToken = req.headers.get('x-community-token') ?? '';
  if (!byok && !communityToken) {
    return json({ error: 'Sign in to use community transcription, or add an OpenAI API key in Settings.' }, 401);
  }
  if (rateLimited(byok ? `key:${byok}` : `tok:${communityToken}`)) {
    return json({ error: 'A few recordings at once is plenty — try again in a minute.' }, 429);
  }

  // Sort out whose keys do the work before touching the (large) body
  let openaiKey = byok;
  let geminiKey = '';
  let email = '';
  if (!byok) {
    const gate = await checkCommunityAccess(communityToken);
    if ('error' in gate) return json({ error: gate.error }, gate.status);
    email = gate.email;
    openaiKey = Deno.env.get('OPENAI_COMMUNITY_KEY') ?? '';
    geminiKey = Deno.env.get('GEMINI_COMMUNITY_KEY') ?? '';
    if (!openaiKey && !geminiKey) {
      return json({ error: 'Community transcription is not configured on this server' }, 503);
    }
  }

  const declared = Number(req.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES + 4096) {
    return json({ error: `That recording is over ${Math.round(MAX_BYTES / 1024 / 1024)} MB — split it in your voice memo app and add the parts one at a time.` }, 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json({ error: 'Send the recording as multipart form data with a "file" field' }, 400);
  }
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return json({ error: 'No recording was attached' }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: `That recording is over ${Math.round(MAX_BYTES / 1024 / 1024)} MB — split it in your voice memo app and add the parts one at a time.` }, 413);
  }
  const language = String(form.get('language') ?? '').trim().slice(0, 8);

  try {
    let result: Result;
    if (openaiKey && file.size <= OPENAI_MAX_BYTES) {
      result = await openaiTranscribe(file, language, openaiKey);
    } else if (geminiKey) {
      result = await geminiTranscribe(file, language, geminiKey);
    } else {
      return json(
        {
          error: `That recording is over ${OPENAI_MAX_BYTES / 1024 / 1024} MB, the most this key can transcribe in one go — split it in your voice memo app and add the parts one at a time.`,
        },
        413,
      );
    }
    if (email && result.usage) {
      recordCommunityUsage(email, result.usage.input, result.usage.output, result.usage.model);
    }
    return json({ transcript: result.transcript, engine: result.engine, seconds: result.seconds ?? null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Transcription failed';
    return json({ error: message }, 502);
  }
});
