import { registry } from '@/providers/registry';
import { useProviderStore } from '@/store/provider-store';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from '@/project/local-projects';
import { useNotepadStore } from '@/store/notepad-store';
import { useBuildLogStore, type BuildEvent } from '@/report/build-log';
import { useGitHubStore } from '@/store/github-store';
import { connectedRepoForCurrentProject } from '@/project/github-sync';
import { listCommits } from '@/project/github-api';
import { detectProjectOutputs } from '@/project/commons-submit';

/**
 * The Project Story drafter: gather everything a project remembers about
 * itself — the first ask, the conversation, the build timeline, what got
 * built, and above all the builder's own Notepad — and draft the story of
 * how it came to be. The draft is a starting point, not the story: it's
 * handed to the builder to edit, and only they decide if it travels to
 * the commons.
 */

const STORY_SYSTEM = [
  'You draft the story of a community tech project, written in the FIRST PERSON as the builder telling it — warm, plain, and honest, like recounting it to a neighbor over coffee.',
  '',
  'You are given the raw record: what the builder first asked for, what they asked along the way, a build timeline, what got built, and — most importantly — the builder\'s own timestamped notes. The notes are the heart of the story. Quote the vivid ones verbatim (a neighbor\'s words, a small moment) and let them carry the telling; the technical record is supporting evidence, not the plot.',
  '',
  'Stay grounded: use ONLY what the record contains. Never invent quotes, names, events, or outcomes. If the record is thin, write a shorter story rather than padding it.',
  '',
  'Shape (as flowing markdown prose, headings optional and sparing):',
  '1. Open with the place and the itch — what was missing or hoped-for, and who it was for.',
  '2. How it got made — told humanly, not technically: what the first version was, what changed and why, moments from the notes woven in as they happened.',
  '3. What it became — how it landed with people, what surprised the builder, in the notes\' own words where possible.',
  '4. End open — what\'s next, or what another neighborhood might take from it.',
  '',
  'Do NOT mention AI models, providers, files, code, or this drafting process. Do not use bullet lists for the narrative. 250-500 words.',
  '',
  'Reply with EXACTLY this format:',
  'TITLE: <a short story title, max 10 words>',
  '',
  '<the story>',
].join('\n');

const MAX_ASKS = 15;
const MAX_ASK_CHARS = 400;
const MAX_NOTE_CHARS = 1000;
const MAX_DOC_CHARS = 1200;
const MAX_DOCS = 3;

function fmtWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** The build log as compact relative-time lines: "+2m14s build_ready" */
function fmtTimeline(events: BuildEvent[]): string[] {
  if (events.length === 0) return [];
  const t0 = events[0].at;
  return events.map(e => {
    const s = Math.max(0, Math.round((e.at - t0) / 1000));
    const rel = s >= 60 ? `+${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s` : `+${s}s`;
    return `${rel} ${e.type}${e.detail ? ` — ${e.detail}` : ''}`;
  });
}

export interface StoryDraft {
  title: string;
  body: string;
  draftedWith: string;
}

/** Assemble the full record the story is drafted from. Exported for preview/debugging. */
export function composeStoryRecord(): string {
  const parts: string[] = [];

  const projectName =
    useCloudStore.getState().currentProjectName ||
    useLocalProjects.getState().currentName;
  if (projectName) parts.push(`Project name: ${projectName}`, '');

  // Where the project came from
  const lineage = useProjectStore.getState().lineage;
  if (lineage?.source) {
    const origin =
      lineage.source === 'rtp-studio-plan'
        ? `Started from the build plan "${lineage.planTitle ?? 'untitled'}"`
        : lineage.source === 'remix'
          ? `Remixed from an existing project${lineage.sourceUrl ? ` (${lineage.sourceUrl})` : ''}`
          : lineage.promptTitle
            ? `Grown from the shared prompt "${lineage.promptTitle}"`
            : 'Started from a fresh idea';
    parts.push(
      `Origin: ${origin}${lineage.studioLabel ? `, built within the ${lineage.studioLabel} studio` : ''}`,
      '',
    );
  }

  // The builder's asks, in order — the human thread of the build
  const messages = useChatStore.getState().messages;
  const asks = messages
    .filter(m => m.role === 'user' && !m.isAuto && !m.isSync)
    .map(m => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean);
  if (asks.length > 0) {
    parts.push('What the builder asked for, in order (first = the founding idea):', '');
    asks.slice(0, MAX_ASKS).forEach((a, i) => parts.push(`${i + 1}. ${a.slice(0, MAX_ASK_CHARS)}`));
    if (asks.length > MAX_ASKS) parts.push(`…and ${asks.length - MAX_ASKS} more asks.`);
    parts.push('');
  }

  // The builder's notepad — the heart
  const notes = useNotepadStore.getState().notes;
  if (notes.length > 0) {
    parts.push('The builder\'s own notes, oldest first (quote the vivid ones):', '');
    [...notes]
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach(n => {
        const text = n.text.trim();
        if (text) parts.push(`[${fmtWhen(n.createdAt)}] ${text.slice(0, MAX_NOTE_CHARS)}`);
      });
    parts.push('');
  }

  // Build timeline — the churn, the errors, the moment it came alive
  const events = useBuildLogStore.getState().events;
  const timeline = fmtTimeline(events);
  if (timeline.length > 0) {
    parts.push('Build timeline (relative to the first build):', '', ...timeline, '');
  }

  // Versions — how many rounds of shaping it took
  const checkpoints = useProjectStore.getState().checkpoints;
  if (checkpoints.length > 0) {
    parts.push(
      `The project went through ${checkpoints.length} saved version${checkpoints.length === 1 ? '' : 's'}, the last on ${fmtWhen(checkpoints[checkpoints.length - 1].timestamp)}.`,
      '',
    );
  }

  // What got built
  const files = useProjectStore.getState().getAllFiles()
    .map(f => ({ path: f.path, content: f.content }));
  if (files.length > 0) {
    const outputs = detectProjectOutputs(files);
    const built: string[] = [];
    if (outputs.hasApp) built.push('a working app');
    if (outputs.materials.length > 0)
      built.push(`${outputs.materials.length} printable material${outputs.materials.length === 1 ? '' : 's'} (${outputs.materials.map(m => m.path.replace(/^\//, '')).join(', ')})`);
    if (outputs.docs.length > 0)
      built.push(`${outputs.docs.length} plan doc${outputs.docs.length === 1 ? '' : 's'}`);
    parts.push(`What got built: ${built.join(', ') || `${files.length} files`}.`, '');
    for (const doc of outputs.docs.slice(0, MAX_DOCS)) {
      parts.push(`--- ${doc.path.replace(/^\//, '')} (plan doc excerpt) ---`, doc.content.slice(0, MAX_DOC_CHARS), '');
    }
  }

  return parts.join('\n');
}

/** Best-effort commit history — GitHub is optional, and a failed fetch is just an absent section */
async function commitHistorySection(): Promise<string> {
  const repo = connectedRepoForCurrentProject();
  const token = useGitHubStore.getState().token;
  if (!repo || !token) return '';
  try {
    const commits = await listCommits(token, repo.fullName, repo.branch, 30);
    if (commits.length === 0) return '';
    return [
      '',
      `Repo history (${repo.fullName}, newest first):`,
      '',
      ...commits.map(c => `${c.date.slice(0, 10)} ${c.author}: ${c.message}`),
      '',
    ].join('\n');
  } catch {
    return '';
  }
}

export async function draftProjectStory(): Promise<StoryDraft> {
  const { activeProviderId, activeModelId } = useProviderStore.getState();
  const provider = registry.getProvider(activeProviderId);
  if (!provider) throw new Error('No model available to draft with');

  const record = composeStoryRecord();
  const hasChat = useChatStore.getState().messages.length > 0;
  const hasNotes = useNotepadStore.getState().notes.some(n => n.text.trim());
  if (!hasChat && !hasNotes) {
    throw new Error('Nothing to draw a story from yet — build something or jot a note first');
  }

  const input = record + (await commitHistorySection());

  let reply = '';
  await new Promise<void>((resolve, reject) => {
    provider.chat(
      [
        { role: 'system', content: STORY_SYSTEM },
        { role: 'user', content: input },
      ],
      activeModelId,
      {
        onToken: t => { reply += t; },
        onComplete: () => resolve(),
        onError: err => reject(err),
      },
      new AbortController().signal,
    ).catch(reject); // chat() can throw before streaming (sign-in, budget) — without this the promise hangs forever
  });

  const match = reply.match(/^TITLE:\s*(.+)$/m);
  const title = (match?.[1] ?? 'Project story').trim().slice(0, 100);
  const body = reply.replace(/^TITLE:.*$/m, '').trim();
  if (!body) throw new Error('The draft came back empty — try again');
  return { title, body, draftedWith: activeModelId };
}
