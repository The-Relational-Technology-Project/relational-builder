import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
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
  followUpEmail: string | null;
  consentAt: string;
}

/** Keep single messages honest but bounded — a whole nine-page build reply
 *  doesn't need to travel verbatim to tell the story */
const MAX_MESSAGE_CHARS = 20000;

export function assembleReportChat(excludedIds: ReadonlySet<string>): ReportChatMessage[] {
  return useChatStore.getState().messages
    .filter(m => !excludedIds.has(m.id))
    .map(m => ({
      role: m.role,
      content:
        m.content.length > MAX_MESSAGE_CHARS
          ? `${m.content.slice(0, MAX_MESSAGE_CHARS)}\n…(trimmed for length)`
          : m.content,
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

export function assembleReport(input: {
  excludedIds: ReadonlySet<string>;
  feedback: ReportFeedback | null;
  followUpEmail: string | null;
  summary: string | null;
}): BuildReportPayload {
  const cloud = useCloudStore.getState();
  const { activeProviderId, activeModelId } = useProviderStore.getState();
  return {
    projectId: cloud.currentProjectId ?? null,
    projectName: cloud.currentProjectName ?? null,
    summary: input.summary,
    chat: assembleReportChat(input.excludedIds),
    events: useBuildLogStore.getState().events,
    files: assembleReportFiles(),
    feedback: input.feedback,
    provider: activeProviderId,
    model: activeModelId,
    followUpEmail: input.followUpEmail,
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
