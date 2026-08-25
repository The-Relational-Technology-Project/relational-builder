import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';

/**
 * The model drafts the project's name in its first build or plan reply, on
 * one marker line (the system prompt teaches it, same mechanism as
 * NEXT-FILES). Adoption lives in drafted-name.ts; this regex is shared with
 * the chat renderer, which hides the line from the person.
 */
export const PROJECT_NAME_MARKER = /^PROJECT-NAME:\s*(\S.*)$/m;

/** The drafted name out of a reply, cleaned and bounded — or null. */
export function extractDraftedName(markdown: string): string | null {
  const raw = markdown.match(PROJECT_NAME_MARKER)?.[1];
  if (!raw) return null;
  const name = raw.replace(/["“”*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return name.length >= 3 ? name : null;
}

/** Remove the marker line from a reply for display — the name shows in the
 *  project header, not as a stray machine line in the conversation. */
export function stripProjectNameMarker(content: string): string {
  return content.replace(/^PROJECT-NAME:[^\n]*\n?/gm, '');
}

/**
 * Suggest a human name for the current project so builders don't stare at
 * a blank "Project name..." field. Best signal first: an imported plan's
 * title, then a quoted phrase in the first ask ("Fog Line Phone Tree"),
 * then the first ask itself with the build-me-a boilerplate stripped.
 */
export function suggestProjectName(): string | null {
  const lineage = useProjectStore.getState().lineage;
  if (lineage?.planTitle) return lineage.planTitle.slice(0, 60);

  const userMsgs = useChatStore.getState().messages
    .filter(m => m.role === 'user' && typeof m.content === 'string');
  if (userMsgs.length === 0) return null;

  // A name the builder said out loud ("Fog Line Phone Tree") beats any
  // heuristic — look for one across the first few asks
  for (const msg of userMsgs.slice(0, 3)) {
    const quoted = (msg.content as string).match(/["“]([^"”]{3,48})["”]/);
    if (quoted) return titleCase(quoted[1]);
  }

  const text = (userMsgs[0].content as string).trim();
  if (!text) return null;

  let t = text
    .replace(/^(please\s+)?(can|could)\s+you\s+/i, '')
    .replace(/^(help\s+me\s+)?(build|create|make|design|start)(\s+(me|us))?(\s+(a|an|the))?\s+/i, '')
    .replace(/^i\s+(want|need|would like)(\s+to\s+(build|create|make))?(\s+(a|an|the))?\s+/i, '');
  // First sentence-ish chunk, first 6 words
  t = t.split(/[.:;\n(]/)[0].trim();
  const words = t.split(/\s+/).slice(0, 6).join(' ').replace(/[,!?]+$/, '');
  if (words.length < 3) return null;
  return titleCase(words.slice(0, 60));
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map(w => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
