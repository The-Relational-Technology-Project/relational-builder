import { useAuthStore } from '@/store/auth-store';
import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';
import { MICROGRANT_FRAME } from '@/knowledge/microgrants';

/**
 * A small cheer to the microgrant commons stewards when a neighborhood
 * approves its gathering-fund plan for a first build. Not the opt-in build
 * report: this carries nothing identifying — the program's name from the
 * plan, the locality on the builder's profile (if any), and the scope the
 * plan chose. Fire-and-forget; a failure never touches the build.
 */
const FUNCTIONS_URL = `${import.meta.env.VITE_BUILDER_SUPABASE_URL ?? ''}/functions/v1`;

const PROJECT_NAME_RE = /^\s*`?PROJECT-NAME:\s*([^`\n]+?)`?\s*$/im;

/** Reads the drafted plan: the PROJECT-NAME line and which scope it chose */
export function readMicrograntPlan(planText: string): { programName: string | null; scope: string | null } {
  const programName = PROJECT_NAME_RE.exec(planText)?.[1]?.trim() ?? null;
  const t = planText.toLowerCase();
  const sheet = /google sheet|spreadsheet|apps script/.test(t);
  const desk = /organizer desk|\/admin\b|review pipeline|pipeline/.test(t);
  const scope = sheet && !desk
    ? 'invitation + spreadsheet'
    : desk && !sheet
      ? 'invitation + organizer desk'
      : desk && sheet
        ? 'invitation + organizer desk'
        : null;
  return { programName, scope };
}

export function isMicrograntProject(): boolean {
  return (useProjectStore.getState().lineage?.frames ?? []).includes(MICROGRANT_FRAME.slug);
}

/** Called when the Build button turns a from-scratch plan into its first build */
export function cheerMicrograntBuild(): void {
  if (!import.meta.env.VITE_BUILDER_SUPABASE_URL) return;
  if (!isMicrograntProject()) return;
  if (useProjectStore.getState().getFileCount() > 0) return;

  const messages = useChatStore.getState().messages;
  const plan = [...messages].reverse().find(m => m.role === 'assistant' && m.isPlan && PROJECT_NAME_RE.test(m.content));
  const { programName, scope } = readMicrograntPlan(plan?.content ?? '');
  const profile = useAuthStore.getState().profile;
  const lineage = useProjectStore.getState().lineage;

  void fetch(`${FUNCTIONS_URL}/microgrant-cheer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      programName,
      locality: profile?.neighborhood ?? null,
      scope,
      source: lineage?.promptTitle ?? null,
    }),
    keepalive: true,
  }).catch(() => undefined);
}
