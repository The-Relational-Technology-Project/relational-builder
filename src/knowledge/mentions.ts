import { builderClient } from '@/cloud/builder-client';
import { useCloudStore } from '@/store/cloud-store';
import { listCommunitySites } from '@/project/community-sites';

/**
 * @ mentions — reference your other apps in chat (Dyad-style).
 * Typing @ in the input offers your cloud projects and live sites;
 * mentions resolve at send time into context the AI can actually use:
 * a project's files (truncated) or a site's identity and URL.
 */

export interface Mentionable {
  kind: 'project' | 'site';
  id: string;
  name: string;
}

const MAX_MENTIONS = 2;
const MAX_FILE_CHARS = 2000;
const MAX_TOTAL_CHARS = 10000;

let sitesCache: Mentionable[] | null = null;

/** Everything the builder can @-mention (projects live in the store; sites fetched once) */
export async function listMentionables(): Promise<Mentionable[]> {
  // The project list normally loads with the dashboard — refresh it here so
  // mentions work even when the session opened straight into a chat
  if (useCloudStore.getState().projects.length === 0) {
    await useCloudStore.getState().refreshProjects();
  }
  const projects: Mentionable[] = useCloudStore.getState().projects.map(p => ({
    kind: 'project' as const,
    id: p.id,
    name: p.name,
  }));

  if (sitesCache === null) {
    try {
      sitesCache = (await listCommunitySites()).map(s => ({
        kind: 'site' as const,
        id: s.slug,
        name: s.name,
      }));
    } catch {
      sitesCache = [];
    }
  }

  // Projects first; skip site entries that duplicate a project name
  const seen = new Set(projects.map(p => p.name.toLowerCase()));
  return [...projects, ...sitesCache.filter(s => !seen.has(s.name.toLowerCase()))];
}

/** Invalidate the sites cache (e.g. after publishing) */
export function clearMentionablesCache() {
  sitesCache = null;
}

/** Find @[Name] tokens that match known mentionables */
export function parseMentions(text: string, candidates: Mentionable[]): Mentionable[] {
  const tokens = [...text.matchAll(/@\[([^\]]{1,80})\]/g)].map(m => m[1].trim().toLowerCase());
  if (tokens.length === 0) return [];
  const found: Mentionable[] = [];
  for (const token of tokens) {
    const match = candidates.find(c => c.name.toLowerCase() === token);
    if (match && !found.some(f => f.kind === match.kind && f.id === match.id)) {
      found.push(match);
    }
  }
  return found.slice(0, MAX_MENTIONS);
}

/** Resolve mentions in a message into prompt-ready context sections */
export async function buildMentionContext(text: string): Promise<string[]> {
  if (!text.includes('@[')) return [];
  const candidates = await listMentionables();
  const mentions = parseMentions(text, candidates);

  const sections: string[] = [];
  for (const mention of mentions) {
    if (mention.kind === 'site') {
      sections.push(
        [
          `## Referenced Site: ${mention.name}`,
          '',
          `The builder mentioned their live community-hosted site "${mention.name}" (https://relationalbuilder.xyz/s/${mention.id}/). Treat it as prior art of theirs — match or borrow from it as they ask.`,
        ].join('\n'),
      );
      continue;
    }

    // Project → pull its files read-only
    if (!builderClient) continue;
    const { data } = await builderClient
      .from('projects')
      .select('name, files')
      .eq('id', mention.id)
      .maybeSingle();
    const files = (data?.files ?? []) as { path: string; content: string }[];
    if (files.length === 0) continue;

    const parts = [
      `## Referenced Project: ${data!.name}`,
      '',
      'The builder mentioned another project of theirs. These are its files (read-only context — do NOT recreate this project; borrow patterns, styles, or pieces as the builder asks):',
      '',
    ];
    let budget = MAX_TOTAL_CHARS;
    for (const file of files) {
      if (budget <= 0) {
        parts.push(`- ${file.path} (omitted)`);
        continue;
      }
      let body = file.content;
      if (body.length > MAX_FILE_CHARS) {
        body = body.slice(0, MAX_FILE_CHARS) + '\n... (truncated)';
      }
      budget -= body.length;
      parts.push(`### ${file.path}`, '```', body, '```', '');
    }
    sections.push(parts.join('\n'));
  }
  return sections;
}
