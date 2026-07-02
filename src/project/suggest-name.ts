import { useChatStore } from '@/store/chat-store';
import { useProjectStore } from '@/store/project-store';

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
