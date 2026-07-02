import { getRepoInfo, pullFiles } from './github-api';
import { useProjectStore } from '@/store/project-store';
import { useChatStore } from '@/store/chat-store';
import { useCloudStore } from '@/store/cloud-store';
import { useGitHubStore } from '@/store/github-store';

/**
 * Remix: pull a public repo from the relational tech network into the
 * workspace as a starting point, with lineage recorded so the chain of
 * credit stays unbroken (remixed_from flows into .reltech.yml on export).
 */

// Text files a remixed web app is actually made of — skips binaries,
// lockfiles, and tooling noise that would drown the workspace
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

export interface RemixResult {
  repoName: string;
  repoUrl: string;
  fileCount: number;
  skipped: number;
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
  const token = useGitHubStore.getState().token ?? '';

  const repo = await getRepoInfo(fullName, token);
  const { files } = await pullFiles(token, fullName, repo.default_branch);

  const usable = files.filter(f => {
    if (SKIP_PATTERNS.some(p => p.test(f.path))) return false;
    const name = f.path.split('/').pop() ?? '';
    const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
    return TEXT_EXTENSIONS.has(ext) || name === '.reltech.yml' || name.startsWith('.env');
  });
  const kept = usable.slice(0, MAX_FILES);

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

  // Remixing starts a fresh workspace: detach cloud project, load files with
  // lineage, and seed the chat with an orientation message
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
