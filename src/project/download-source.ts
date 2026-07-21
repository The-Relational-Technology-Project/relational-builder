import { useProjectStore } from '@/store/project-store';
import { useEnvStore } from '@/store/env-store';
import { useCloudStore } from '@/store/cloud-store';
import { useLocalProjects } from './local-projects';
import { needsBuild, materializeSource } from './build-for-publish';
import { exportProjectZip, downloadBlob } from './export';
import { getPromptForProject } from '@/cloud/prompts';
import { suggestProjectName } from './suggest-name';

/**
 * One-click "download my codebase" — the same source zip the Publish
 * dialog's Download target produces (framework projects get the full Vite
 * scaffold via materializeSource, plus .reltech.yml, README, and public
 * env), but reachable straight from the Files tab with no dialog.
 */
export async function downloadSourceZip(): Promise<void> {
  const project = useProjectStore.getState();
  const files = project.getAllFiles();
  if (files.length === 0) throw new Error('Nothing to download yet — build something first');

  const cloud = useCloudStore.getState();
  const name =
    cloud.currentProjectName?.trim() ||
    useLocalProjects.getState().currentName.trim() ||
    suggestProjectName() ||
    'my-community-app';

  const publicEnvVars = useEnvStore.getState().vars
    .filter(v => !v.isSecret)
    .map(v => ({ key: v.key, value: v.value }));
  const buildPrompt = cloud.currentProjectId
    ? await getPromptForProject(cloud.currentProjectId).catch(() => null)
    : null;

  const sourceFiles = needsBuild(files) ? materializeSource(files) : files;
  const blob = await exportProjectZip(sourceFiles, name, project.lineage, publicEnvVars, buildPrompt);
  downloadBlob(blob, `${name.replace(/[^a-zA-Z0-9-_]/g, '-')}.zip`);
}
