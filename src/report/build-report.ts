import { registry } from '@/providers/registry';
import { extractOperations } from '@/project/code-extractor';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from '@/project/local-projects';
import { useCommunityStore } from '@/store/community-store';
import { useBuildLogStore, type BuildEvent } from '@/report/build-log';

/**
 * Build report assembly and sending — the opt-in loop's data layer.
 *
 * Nothing here runs until the builder says yes on the consent card. The
 * payload is assembled client-side at that moment (so the "see exactly what
 * we'd send" preview and the sent report are the same object, minus any
 * messages the builder struck), then posted to the build-report edge
 * function, which stores it and emails the stewards.
 */

const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

/** Chat images stay on the device — the report carries only their count */
export interface ReportChatMessage {
  role: 'user' | 'assistant';
  content: string;
  /** Builder-action badge (Automatic fix, Quality review, Finishing the build…) */
  label?: string;
  at: number;
  attachmentCount?: number;
}

export interface ReportFeedback {
  hopedFor?: string;
  roughMoments?: string;
  surprises?: string;
}

export interface BuildReportPayload {
  projectId: string | null;
  projectName: string | null;
  summary: string | null;
  chat: ReportChatMessage[];
  events: BuildEvent[];
  files: { path: string; chars: number }[];
  feedback: ReportFeedback | null;
  provider: string;
  model: string;
  /** Who's building — typed on the card; the email doubles as the follow-up contact */
  builderName: string | null;
  builderEmail: string | null;
  /** JPEG data URL of the running app — present only when the builder ticked the snapshot box */
  screenshot: string | null;
  consentAt: string;
}

/** Keep single messages honest but bounded — a whole nine-page build reply
 *  doesn't need to travel verbatim to tell the story */
const MAX_MESSAGE_CHARS = 20000;

/**
 * Trim an overlong message at a code-fence boundary, never mid-file. A raw
 * slice lands inside whatever file straddles the limit, and the report email
 * then reads the unterminated fence as a stream cutoff — a real report showed
 * five files "cut off mid-stream" (wrong filenames included) for a build whose
 * only genuine cutoff was one. The marker instead names what the trimmed tail
 * held, including the file that truly was cut off, if any.
 */
export function trimForReport(content: string): string {
  if (content.length <= MAX_MESSAGE_CHARS) return content;
  const marker = (rest: string): string => {
    const ops = extractOperations(rest);
    const paths = [...ops.writes.map(w => w.path), ...ops.edits.map(e => e.path)];
    const cut = ops.truncatedPath ? `, then was cut off mid-${ops.truncatedPath}` : '';
    if (paths.length === 0) return `\n…(trimmed for length${cut})`;
    const listed = paths.slice(0, 12).join(', ') + (paths.length > 12 ? ` +${paths.length - 12} more` : '');
    return `\n…(trimmed for the report — the reply continued with ${listed}${cut})`.slice(0, 600);
  };
  // Walk lines tracking fence state; keep the longest prefix that ends
  // outside any code block and leaves room for the marker
  const budget = MAX_MESSAGE_CHARS - 600;
  const lines = content.split('\n');
  let inFence = false;
  let offset = 0;
  let safeEnd = 0;
  for (const line of lines) {
    const end = offset + line.length;
    if (end > budget) break;
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence) safeEnd = end;
    offset = end + 1;
  }
  // Degenerate content (no safe boundary in budget): fall back to a raw slice
  if (safeEnd === 0) return `${content.slice(0, budget)}\n…(trimmed for length)`;
  return content.slice(0, safeEnd) + marker(content.slice(safeEnd));
}

export function assembleReportChat(excludedIds: ReadonlySet<string>): ReportChatMessage[] {
  return useChatStore.getState().messages
    .filter(m => !excludedIds.has(m.id))
    .map(m => ({
      role: m.role,
      content: trimForReport(m.content),
      ...(m.autoLabel || m.syncLabel
        ? { label: m.autoLabel ?? m.syncLabel }
        : m.isPlan
          ? { label: 'Build plan' }
          : {}),
      at: m.timestamp,
      ...(m.attachments?.length ? { attachmentCount: m.attachments.length } : {}),
    }));
}

export function assembleReportFiles(): { path: string; chars: number }[] {
  return useProjectStore.getState().getAllFiles()
    .map(f => ({ path: f.path, chars: f.content.length }));
}

/**
 * The provider·model the BUILD actually ran on. The active model at consent
 * time is the wrong answer: free community builds step down to the edit model
 * the moment the first build lands — before the consent card ever renders —
 * so reading the picker here would attribute every report to the edit model.
 * gen_start events record the model each generation ACTUALLY used — exact
 * attribution (a real report once credited fixes to a model the in-chat note
 * contradicted, because both were inferred instead of recorded). Older logs
 * without gen events fall back to build_start + the picker.
 */
function buildModelAttribution(): { provider: string; model: string } {
  const { activeProviderId, activeModelId } = useProviderStore.getState();
  const events = useBuildLogStore.getState().events;
  const started = events.find(e => e.type === 'build_start');
  const [startProvider, startModel] = started?.detail?.split(' · ') ?? [];
  const provider = startProvider || activeProviderId;
  const buildModel = startModel || activeModelId;
  const genModels = [...new Set(
    events
      .filter(e => e.type === 'gen_start')
      .map(e => e.detail?.split(' · ')[2])
      .filter((m): m is string => !!m),
  )];
  const others = genModels.filter(m => m !== buildModel);
  if (others.length > 0) {
    return { provider, model: `${buildModel} (fixes & edits: ${others.join(', ')})` };
  }
  if (genModels.length === 0 && startModel && startModel !== activeModelId) {
    return { provider, model: `${buildModel} (fixes & edits: ${activeModelId})` };
  }
  return { provider, model: buildModel };
}

export function assembleReport(input: {
  excludedIds: ReadonlySet<string>;
  feedback: ReportFeedback | null;
  builderName: string | null;
  builderEmail: string | null;
  screenshot: string | null;
  summary: string | null;
}): BuildReportPayload {
  const cloud = useCloudStore.getState();
  const { provider, model } = buildModelAttribution();
  return {
    projectId: cloud.currentProjectId ?? null,
    // Signed-out projects are named on the local shelf — without the
    // fallback their reports arrived nameless
    projectName: cloud.currentProjectName || useLocalProjects.getState().currentName || null,
    summary: input.summary,
    chat: assembleReportChat(input.excludedIds),
    events: useBuildLogStore.getState().events,
    files: assembleReportFiles(),
    feedback: input.feedback,
    provider,
    model,
    builderName: input.builderName,
    builderEmail: input.builderEmail,
    screenshot: input.screenshot,
    consentAt: new Date().toISOString(),
  };
}

const SUMMARY_MODEL = 'claude-haiku-4-5';
const SUMMARY_MAX_FILES_CHARS = 16000;

/**
 * One short AI-written paragraph describing what was built — the report's
 * human-readable header. Generated only after consent (it's an API call, so
 * it shouldn't spend anything for builders who decline). Best-effort: any
 * failure returns null and the report ships without it.
 */
export async function generateBuildSummary(): Promise<string | null> {
  const { activeProviderId, apiKeys } = useProviderStore.getState();
  if (activeProviderId !== 'claude') return null;
  if (!apiKeys['claude'] && !useCommunityStore.getState().active) return null;
  const provider = registry.getProvider('claude');
  if (!provider) return null;

  const firstAsk = useChatStore.getState().messages.find(m => m.role === 'user')?.content ?? '';
  const files = useProjectStore.getState().getAllFiles();
  if (files.length === 0) return null;

  const parts = [
    `The person asked for: "${firstAsk.slice(0, 600)}"`,
    '',
    'The generated project files:',
  ];
  let budget = SUMMARY_MAX_FILES_CHARS;
  for (const f of files) {
    if (/^\/?assets\//.test(f.path)) continue;
    const head = f.content.slice(0, Math.max(0, Math.min(1500, budget)));
    budget -= head.length;
    parts.push(`--- ${f.path} ---`, head, '');
  }

  let reply = '';
  try {
    await new Promise<void>((resolve, reject) => {
      provider.chat(
        [
          {
            role: 'system',
            content:
              'In one short paragraph (3-4 sentences, plain language, no markdown), describe what this app is and what someone can do with it. Write for a reader who will never see the code.',
          },
          { role: 'user', content: parts.join('\n') },
        ],
        SUMMARY_MODEL,
        {
          onToken: t => { reply += t; },
          onComplete: () => resolve(),
          onError: err => reject(err),
        },
        new AbortController().signal,
      ).catch(reject);
    });
  } catch {
    return null;
  }
  const summary = reply.trim();
  return summary ? summary.slice(0, 2000) : null;
}

export async function sendBuildReport(payload: BuildReportPayload): Promise<void> {
  const res = await fetch(`${FUNCTIONS_URL}/build-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? 'Could not send the build report');
}
