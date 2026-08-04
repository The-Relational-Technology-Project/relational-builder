/**
 * A README for the connected repo — written into the workspace the moment
 * git sync is enabled, so the repo a neighbor (or collaborator) lands on
 * explains itself: what this is, how to run it, and where it came from.
 *
 * Written once, only when the project has files and no README of its own.
 * It's a real workspace file after that — edit it, replace it, or delete
 * it and it stays deleted. If the builder chooses to start from the repo's
 * version instead, a README already in the repo simply wins on first pull.
 */

import { useProjectStore } from '@/store/project-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from './local-projects';
import { needsBuild } from './build-for-publish';

function projectDisplayName(fallback: string): string {
  return (
    useCloudStore.getState().currentProjectName.trim() ||
    useLocalProjects.getState().currentName.trim() ||
    fallback
  );
}

/** Write /README.md into the workspace if it doesn't have one yet. */
export function ensureRepoReadme(repoFullName: string): void {
  const store = useProjectStore.getState();
  if (store.getFileCount() === 0) return; // repo-first connect: nothing to describe yet
  if (store.getFile('/README.md')) return;

  const repoName = repoFullName.split('/')[1] ?? 'this project';
  const name = projectDisplayName(repoName);
  const planTitle = store.lineage?.planTitle?.trim();
  const isFramework = needsBuild(store.getAllFiles());

  const lines = [
    `# ${name}`,
    '',
    ...(planTitle ? [`Started from the build plan “${planTitle}”.`, ''] : []),
    'Made with [Relational Builder](https://relationalbuilder.org), an open-source',
    'app builder for tools that strengthen neighborhood connection.',
    '',
    '## Running it',
    '',
    ...(isFramework
      ? ['```bash', 'npm install', 'npm run dev', '```']
      : ['Open `index.html` in a browser — no build step needed.']),
    '',
    '## About this repo',
    '',
    'This repo stays in sync with its Relational Builder project both ways:',
    'changes made in the Builder push here automatically, and commits made',
    'here are pulled back in.',
    '',
    'The `.reltech.yml` manifest carries the project’s lineage. On GitHub,',
    'adding the `relational-tech` topic makes the project appear on',
    '[updates.relationaltechproject.org](https://updates.relationaltechproject.org).',
    '',
  ];

  store.writeFile('/README.md', lines.join('\n'));
}
