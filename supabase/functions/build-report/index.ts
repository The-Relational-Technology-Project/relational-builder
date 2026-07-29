/**
 * Supabase Edge Function: build-report — the opt-in build log loop.
 *
 * When a builder finishes a project's initial build and says yes on the
 * consent card, the client assembles the report (chat log, build timeline,
 * files summary, optional feedback) and posts it here. The row in
 * build_reports is the durable record; a readable email copy goes to the
 * stewards — best-effort, since the row is already safe.
 *
 * POST JSON: { projectId?, projectName?, summary?, chat, events, files,
 *              feedback?, provider?, model?, builderName?, builderEmail?,
 *              screenshot?, followUpEmail?, consentAt }
 *   - No auth (builders may not be signed in); per-IP rate limited
 *   - consentAt is required: no consent timestamp, no report
 *   - screenshot is a JPEG/PNG data URL the builder separately okayed;
 *     it's stored with the row and attached to the steward email
 *   - followUpEmail is the pre-identity field older clients still send;
 *     builderEmail supersedes it
 *
 * Deploy: supabase functions deploy build-report --no-verify-jwt
 * Secrets:
 *   RESEND_API_KEY      — Resend key for the relationalbuilder.org domain
 *   BUILD_REPORT_EMAIL  — where reports go (default humans@relationaltechproject.org)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const RATE_LIMIT_PER_HOUR = 6;
const ipCounts = new Map<string, { hour: string; count: number }>();

// Generous for real builds (incl. a snapshot image), small enough that
// nobody can use us as storage
const MAX_BODY_BYTES = 3_000_000;
// Client normalizes snapshots to ≤1M chars; the ceiling just adds slack
const MAX_SCREENSHOT_CHARS = 1_600_000;
const MAX_CHAT_MESSAGES = 200;
const MAX_MESSAGE_CHARS = 20_000;
const MAX_EVENTS = 200;
const MAX_FILES = 500;
const MAX_FEEDBACK_CHARS = 4_000;
// Email bodies stay readable — the database row keeps the full log
const EMAIL_CHAT_BUDGET = 60_000;

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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

interface ChatEntry { role: string; content: string; label?: string; at?: number; attachmentCount?: number }
interface LogEvent { at: number; type: string; detail?: string }
interface FileEntry { path: string; chars: number }

const EVENT_LABELS: Record<string, string> = {
  build_start: 'Build started',
  gen_start: 'Generation started',
  gen_end: 'Generation ended',
  reply_cut_off: 'Reply cut off',
  auto_continuation: 'Automatic continuation',
  continuation_cap: 'Continuation limit reached',
  apply_warnings: "Some edits didn't apply",
  preview_error: 'Preview error',
  preview_recovered: 'Preview recovered',
  auto_error_fix: 'Automatic error fix',
  manual_error_fix: 'Fix requested by hand',
  quality_review_fix: 'Quality review queued a fix',
  build_ready: 'Build ready',
};

/**
 * Collapse fenced code blocks to one-line placeholders. The chat's story is
 * its prose — a real report spent nearly its whole email budget on verbatim
 * generated code and trimmed away the diagnostic tail (the fix replies, the
 * final state). The full code always lives in the build_reports row.
 */
function collapseCodeBlocks(content: string): string {
  let out = content.replace(
    /```([^\n]*)\n([\s\S]*?)\n?```/g,
    (_m, meta: string, body: string) => {
      const lines = body.length === 0 ? 0 : body.split('\n').length;
      const file = meta.match(/filename="([^"]+)"/)?.[1];
      const isEdit = /^\s*edit\b/.test(meta);
      const lang = meta.trim().split(/\s+/)[0] || 'code';
      return file
        ? `⟨${isEdit ? 'edit to' : 'file'} ${file} — ${lines} lines⟩`
        : `⟨${lang} — ${lines} lines⟩`;
    },
  );
  // An unterminated fence is a cut-off reply — show exactly that
  const open = out.indexOf('```');
  if (open >= 0) {
    const meta = out.slice(open + 3, out.indexOf('\n', open) > 0 ? out.indexOf('\n', open) : undefined);
    const file = meta.match(/filename="([^"]+)"/)?.[1];
    const lines = out.slice(open).split('\n').length;
    out = `${out.slice(0, open)}⟨${file ?? 'file'} — cut off mid-stream after ${lines} lines⟩`;
  }
  return out;
}

function relTime(at: number, base: number): string {
  const s = Math.max(0, Math.round((at - base) / 1000));
  return `+${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function minutes(ms: number): string {
  return `${Math.round(ms / 60_000)} min`;
}

function renderEmail(r: {
  projectName: string | null;
  summary: string | null;
  chat: ChatEntry[];
  events: LogEvent[];
  files: FileEntry[];
  feedback: Record<string, string> | null;
  provider: string | null;
  model: string | null;
  builderName: string | null;
  builderEmail: string | null;
  hasScreenshot: boolean;
  followUpEmail: string | null;
  reportId: string | null;
}): string {
  const name = r.projectName ?? 'an unnamed project';
  const base = r.events[0]?.at ?? 0;
  const start = r.events.find(e => e.type === 'build_start');
  const ready = r.events.find(e => e.type === 'build_ready');
  const continuations = r.events.filter(e => e.type === 'auto_continuation').length;
  const errors = r.events.filter(e => e.type === 'preview_error').length;
  const fixes = r.events.filter(e =>
    e.type === 'auto_error_fix' || e.type === 'manual_error_fix' || e.type === 'quality_review_fix',
  ).length;

  const stats: string[] = [];
  if (start && ready) stats.push(`<strong>${minutes(ready.at - start.at)}</strong> build → ready`);
  stats.push(`<strong>${1 + continuations}</strong> build ${continuations === 0 ? 'pass' : 'passes'}`);
  if (fixes > 0) stats.push(`<strong>${fixes}</strong> fix ${fixes === 1 ? 'pass' : 'passes'}`);
  stats.push(`<strong>${r.files.length}</strong> files`);
  stats.push(`<strong>${errors}</strong> preview ${errors === 1 ? 'error' : 'errors'}`);
  // "Ready" can't be the last word when the log ends on an open error — a
  // real report's headline said ready while the final event was an
  // unresolved lucide crash. Only new-format logs (with gen events) record
  // recoveries, so only they can honestly claim either way.
  if (r.events.some(e => e.type === 'gen_start') && errors > 0) {
    const lastErr = r.events.map(e => e.type).lastIndexOf('preview_error');
    const lastRecovery = r.events.map(e => e.type).lastIndexOf('preview_recovered');
    stats.push(
      lastRecovery > lastErr
        ? 'ended with the preview working'
        : '<strong style="color:#b00">ended with an unresolved preview error</strong>',
    );
  }
  if (r.model) stats.push(esc(`${r.provider ?? ''} · ${r.model}`));

  const builder = [r.builderName, r.builderEmail].filter(Boolean) as string[];
  const parts: string[] = [
    `<h2 style="margin:0 0 4px">Build report: ${esc(name)}</h2>`,
    `<p style="color:#666;margin:0 0 12px">Shared by an opted-in builder · ${stats.join(' &nbsp;·&nbsp; ')}</p>`,
  ];
  if (builder.length > 0) {
    parts.push(
      `<p style="margin:0 0 12px"><strong>Built by:</strong> ${builder.map(esc).join(' · ')}</p>`,
    );
  }
  if (r.hasScreenshot) {
    parts.push(
      `<p style="color:#666;font-size:13px;margin:0 0 12px">📎 The builder okayed a snapshot of the app — attached as <strong>app-snapshot</strong>.</p>`,
    );
  }
  if (r.reportId) {
    parts.push(
      `<p style="color:#999;font-size:12px;margin:0 0 12px">Full log (untrimmed chat and code): build_reports row ${esc(r.reportId)}</p>`,
    );
  }

  if (r.summary) {
    parts.push(`<h3 style="margin:16px 0 4px">What was built</h3><p>${esc(r.summary)}</p>`);
  }

  if (r.feedback) {
    const labels: Record<string, string> = {
      hopedFor: 'What were you hoping to build?',
      roughMoments: 'Was there a moment it felt broken, stuck, or confusing?',
      surprises: 'What surprised you — good or bad?',
    };
    parts.push('<h3 style="margin:16px 0 4px">Their feedback</h3>');
    for (const [key, q] of Object.entries(labels)) {
      const a = r.feedback[key];
      if (a) parts.push(`<p style="margin:6px 0"><strong>${esc(q)}</strong><br>${esc(a).replace(/\n/g, '<br>')}</p>`);
    }
  }
  if (r.followUpEmail) {
    parts.push(`<p><strong>Okay to follow up:</strong> ${esc(r.followUpEmail)}</p>`);
  }

  if (r.events.length > 0) {
    parts.push('<h3 style="margin:16px 0 4px">How it went</h3>');
    parts.push('<table style="border-collapse:collapse;font-size:13px">');
    for (const e of r.events) {
      parts.push(
        `<tr><td style="padding:2px 10px 2px 0;font-family:monospace;vertical-align:top">${relTime(e.at, base)}</td>` +
        `<td style="padding:2px 0"><strong>${esc(EVENT_LABELS[e.type] ?? e.type)}</strong>${e.detail ? ` — ${esc(e.detail)}` : ''}</td></tr>`,
      );
    }
    parts.push('</table>');
  }

  parts.push('<h3 style="margin:16px 0 4px">Files</h3>');
  parts.push(`<p style="font-size:13px;color:#444">${r.files.map(f => esc(f.path)).join(', ') || '(none)'}</p>`);

  parts.push('<h3 style="margin:16px 0 4px">The conversation</h3>');
  parts.push('<p style="color:#999;font-size:12px;margin:0 0 8px">Code blocks are collapsed to ⟨file — N lines⟩ placeholders; the full files are in the build_reports row.</p>');
  let budget = EMAIL_CHAT_BUDGET;
  for (const m of r.chat) {
    if (budget <= 0) {
      parts.push(`<p style="color:#666"><em>…trimmed for email — the full log is in build_reports${r.reportId ? ` (row ${esc(r.reportId)})` : ''}.</em></p>`);
      break;
    }
    const who = m.label ?? (m.role === 'user' ? 'Builder' : 'AI');
    const collapsed = collapseCodeBlocks(m.content);
    const body = collapsed.slice(0, 8_000);
    budget -= body.length;
    parts.push(
      `<p style="margin:10px 0"><strong>${esc(who)}:</strong>` +
      (m.attachmentCount ? ` <em>(${m.attachmentCount} image${m.attachmentCount === 1 ? '' : 's'} not included)</em>` : '') +
      `<br>${esc(body).replace(/\n/g, '<br>')}${collapsed.length > body.length ? ' <em>…</em>' : ''}</p>`,
    );
  }

  parts.push(
    '<p style="color:#999;font-size:12px;margin:16px 0 0">Shared with the builder\'s consent. Reports can mention other people — names, places, contacts — so treat the contents as confidential to the stewards.</p>',
  );

  return parts.join('\n');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const hour = new Date().toISOString().slice(0, 13);
    const bucket = ipCounts.get(ip);
    if (bucket && bucket.hour === hour && bucket.count >= RATE_LIMIT_PER_HOUR) {
      return json({ error: 'Too many reports — try again in a bit' }, 429);
    }
    ipCounts.set(ip, { hour, count: bucket?.hour === hour ? bucket.count + 1 : 1 });

    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: 'Report too large' }, 413);
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'Invalid JSON' }, 400);
    }

    const consentAt = String(body.consentAt ?? '').trim();
    if (!consentAt || Number.isNaN(Date.parse(consentAt))) {
      return json({ error: 'Missing consent timestamp' }, 400);
    }

    const chat: ChatEntry[] = (Array.isArray(body.chat) ? body.chat : [])
      .slice(0, MAX_CHAT_MESSAGES)
      .map((m: Record<string, unknown>) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content ?? '').slice(0, MAX_MESSAGE_CHARS),
        ...(m.label ? { label: String(m.label).slice(0, 80) } : {}),
        ...(typeof m.at === 'number' ? { at: m.at } : {}),
        ...(typeof m.attachmentCount === 'number' && m.attachmentCount > 0
          ? { attachmentCount: Math.floor(m.attachmentCount) }
          : {}),
      }));
    if (chat.length === 0) return json({ error: 'A report needs its conversation' }, 400);

    const events: LogEvent[] = (Array.isArray(body.events) ? body.events : [])
      .slice(0, MAX_EVENTS)
      .filter((e: Record<string, unknown>) => typeof e.at === 'number' && typeof e.type === 'string')
      .map((e: Record<string, unknown>) => ({
        at: e.at as number,
        type: String(e.type).slice(0, 40),
        ...(e.detail ? { detail: String(e.detail).slice(0, 240) } : {}),
      }));

    const files: FileEntry[] = (Array.isArray(body.files) ? body.files : [])
      .slice(0, MAX_FILES)
      .filter((f: Record<string, unknown>) => typeof f.path === 'string')
      .map((f: Record<string, unknown>) => ({
        path: String(f.path).slice(0, 300),
        chars: typeof f.chars === 'number' ? Math.floor(f.chars) : 0,
      }));

    let feedback: Record<string, string> | null = null;
    if (body.feedback && typeof body.feedback === 'object') {
      feedback = {};
      for (const key of ['hopedFor', 'roughMoments', 'surprises']) {
        const v = (body.feedback as Record<string, unknown>)[key];
        if (typeof v === 'string' && v.trim()) feedback[key] = v.trim().slice(0, MAX_FEEDBACK_CHARS);
      }
      if (Object.keys(feedback).length === 0) feedback = null;
    }

    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const projectId =
      typeof body.projectId === 'string' && uuidRe.test(body.projectId) ? body.projectId : null;
    const projectName = String(body.projectName ?? '').slice(0, 200).trim() || null;
    const summary = String(body.summary ?? '').slice(0, 2_000).trim() || null;
    const provider = String(body.provider ?? '').slice(0, 60).trim() || null;
    const model = String(body.model ?? '').slice(0, 120).trim() || null;
    const builderName = String(body.builderName ?? '').slice(0, 120).trim() || null;
    const builderEmail = String(body.builderEmail ?? '').slice(0, 200).trim() || null;
    // Older clients sent the contact address as followUpEmail
    const followUpEmail = String(body.followUpEmail ?? '').slice(0, 200).trim() || null;

    // The snapshot the builder separately okayed — a JPEG/PNG data URL only
    const rawShot = typeof body.screenshot === 'string' ? body.screenshot : '';
    const shotMatch = rawShot.match(/^data:image\/(jpeg|png);base64,([A-Za-z0-9+/=]+)$/);
    const screenshot =
      shotMatch && rawShot.length <= MAX_SCREENSHOT_CHARS ? rawShot : null;

    // Named columns throughout — including what we ask back — so the
    // hardened privileges never have a star-select to refuse
    const insertRes = await fetch(rest('/build_reports?select=id'), {
      method: 'POST',
      headers: { ...svc(), Prefer: 'return=representation' },
      body: JSON.stringify({
        project_id: projectId,
        project_name: projectName,
        summary,
        chat,
        events,
        files,
        feedback,
        provider,
        model,
        builder_name: builderName,
        builder_email: builderEmail,
        screenshot,
        follow_up_email: followUpEmail,
        consent_at: consentAt,
      }),
    });
    if (!insertRes.ok) return json({ error: 'Could not save the report' }, 500);
    const inserted = await insertRes.json().catch(() => []);
    const reportId: string | null = inserted?.[0]?.id ?? null;

    // Email copy to the stewards — best-effort; the row is already safe
    const resendKey = Deno.env.get('RESEND_API_KEY') ?? '';
    const to = Deno.env.get('BUILD_REPORT_EMAIL') ?? 'humans@relationaltechproject.org';
    if (resendKey) {
      const attachments = screenshot && shotMatch
        ? [{
            filename: `app-snapshot.${shotMatch[1] === 'png' ? 'png' : 'jpg'}`,
            content: shotMatch[2],
          }]
        : undefined;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Relational Builder <hello@relationalbuilder.org>',
          to: [to],
          reply_to: builderEmail ?? followUpEmail ?? undefined,
          subject:
            `Build report: ${projectName ?? 'a new build'}` +
            (builderName ? ` — from ${builderName}` : ''),
          html: renderEmail({
            projectName, summary, chat, events, files, feedback,
            provider, model, builderName, builderEmail,
            hasScreenshot: Boolean(attachments), followUpEmail, reportId,
          }),
          attachments,
        }),
      }).catch(() => {});
    }

    return json({ ok: true, id: reportId });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
});
