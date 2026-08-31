import { getRepoInfo, pullFiles } from './github-api';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useSyncStore } from '@/store/sync-store';
import { stashAndStartFresh } from '@/project/local-projects';

/**
 * Remix: pull a public repo from the relational tech network into the
 * workspace as a starting point, with lineage recorded so the chain of
 * credit stays unbroken (remixed_from flows into .reltech.yml on export).
 */

// Text files a web app is actually made of — skips binaries, lockfiles,
// and tooling noise that would drown the workspace. Shared with importing
// an existing repo (import-repo.ts), so both doors keep the same things.
const TEXT_EXTENSIONS = new Set([
  'html', 'css', 'js', 'jsx', 'ts', 'tsx', 'json', 'md', 'svg', 'txt',
  'yml', 'yaml', 'sql', 'env', 'mjs', 'cjs',
]);

const SKIP_PATTERNS = [
  /^\/?node_modules\//, /^\/?\.git\//, /^\/?dist\//, /^\/?build\//,
  /^\/?\.github\//, /package-lock\.json$/, /yarn\.lock$/, /bun\.lockb?$/,
  /pnpm-lock\.yaml$/, /^\/?\.next\//, /^\/?coverage\//,
];

const MAX_FILES = 100;

/** The workable subset of a pulled repo tree, capped */
export function usableRepoFiles<T extends { path: string }>(files: T[], max: number): T[] {
  return files
    .filter(f => {
      if (SKIP_PATTERNS.some(p => p.test(f.path))) return false;
      const name = f.path.split('/').pop() ?? '';
      const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
      return TEXT_EXTENSIONS.has(ext) || name === '.reltech.yml' || name.startsWith('.env');
    })
    .slice(0, max);
}

export interface RemixResult {
  repoName: string;
  repoUrl: string;
  fileCount: number;
  skipped: number;
}

/**
 * When a remix source has a public codebase, say so in the seeded draft —
 * visible to the person AND the model. Prompt-level remixing deliberately
 * distills intent rather than copying implementation, but the model (and a
 * curious builder) should still know the original's code exists and can be
 * consulted for how it solved the hard parts — with departures welcome.
 * Returns '' when the URL isn't a codebase we can point at.
 */
export function referenceCodebaseNote(url: string | null | undefined): string {
  if (!url || !/github\.com\/[\w.-]+\/[\w.-]+/.test(url)) return '';
  return (
    `\nGood to know: the original's code is open source at ${url}. ` +
    'Where it solved something hard (data model, integrations, scraping or sync logic), consult that approach rather than reinventing it — ' +
    'and depart from it freely where a different stack or a simpler shape serves this build better.'
  );
}

/** Accepts "owner/name" or a full github.com URL */
export function parseRepoRef(input: string): string | null {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(/github\.com\/([\w.-]+\/[\w.-]+)/);
  if (urlMatch) return urlMatch[1].replace(/\.git$/, '');
  if (/^[\w.-]+\/[\w.-]+$/.test(trimmed)) return trimmed;
  return null;
}

export async function remixRepo(repoRef: string): Promise<RemixResult> {
  const fullName = parseRepoRef(repoRef);
  if (!fullName) throw new Error('Paste a GitHub repo URL or owner/name');

  // The user's GitHub token (if connected) lifts the unauthenticated rate limit
  const token = useSyncStore.getState().tokens.github ?? '';

  const repo = await getRepoInfo(fullName, token);
  const { files } = await pullFiles(token, fullName, repo.default_branch);

  const kept = usableRepoFiles(files, MAX_FILES);

  if (kept.length === 0) {
    throw new Error("That repo doesn't contain web app files the builder can work with");
  }

  const now = Date.now();
  const entries = kept.map(f => ({
    path: f.path,
    content: f.content,
    language: f.path.split('.').pop() ?? 'text',
    createdAt: now,
    updatedAt: now,
  }));

  // Remixing starts a fresh workspace: stash open work on the local shelf
  // (and point the autosaver at a fresh slot — otherwise the remix would be
  // saved over the previous project), detach cloud, load files with lineage,
  // and seed the chat with an orientation message
  stashAndStartFresh();
  useCloudStore.getState().closeProject();
  useProjectStore.getState().clearProject();
  useProjectStore.getState().hydrateFiles(entries, {
    source: 'remix',
    planTitle: repo.full_name,
    sourceUrl: repo.html_url,
    importedAt: new Date().toISOString(),
  });
  useChatStore.getState().hydrateChat(
    [
      {
        id: `msg-remix-${now}`,
        role: 'assistant',
        content: [
          `Remixed **${repo.full_name}** from the network — ${kept.length} files are in your workspace, and its lineage travels with your project.`,
          '',
          "Tell me what you'd like to adapt for your neighborhood: rename it, change the language or look, add or remove features — anything.",
        ].join('\n'),
        timestamp: now,
      },
    ],
    'build',
  );

  return {
    repoName: repo.full_name,
    repoUrl: repo.html_url,
    fileCount: kept.length,
    skipped: files.length - kept.length,
  };
}
