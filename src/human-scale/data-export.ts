/**
 * Workstream 4 wiring (behind the flag): a project's export carries its
 * app's Community Cloud data, and deleting the project deletes the app.
 *
 * The app a project owns is the one its env vars name (`APP_ID`, written by
 * createAppForProject): the live vars for the open project, the env stash
 * for any other. Everything network-side goes through the existing admin
 * calls in src/cloud/community-cloud.ts; this module only decides when and
 * turns results into files.
 */

import type { FileEntry } from '@/project/virtual-fs';
import { useEnvStore } from '@/store/env-store';
import { useCloudStore } from '@/store/cloud-store';
import { exportBackend, deleteApp } from '@/cloud/community-cloud';
import { appDataExportFiles, type ExportFile } from './export-data';
import { isHumanScale } from './flag';

interface KeyValue {
  key: string;
  value: string;
}

/** The Community Cloud app id a set of env vars names, if any */
export function appIdIn(vars: KeyValue[]): string | null {
  const v = vars.find(x => x.key === 'APP_ID')?.value.trim();
  return v || null;
}

/** The app id for a project: live vars when it is the open project, the
 *  stash otherwise (device-local, like the vars themselves). */
export function appIdForProject(projectId: string | null): string | null {
  const env = useEnvStore.getState();
  const current = useCloudStore.getState().currentProjectId;
  if (projectId && projectId !== current) return appIdIn(env.stash[projectId] ?? []);
  return appIdIn(env.vars);
}

export function toFileEntries(files: ExportFile[], now = Date.now()): FileEntry[] {
  return files.map(f => ({
    path: f.path,
    content: f.content,
    language: f.path.endsWith('.json') ? 'json' : f.path.endsWith('.csv') ? 'csv' : 'markdown',
    createdAt: now,
    updatedAt: now,
  }));
}

/**
 * The data files to add to an export zip for the open project: empty when
 * the flag is off, when the project has no app, or when the pull fails
 * (an export must never fail because the data could not be fetched; the
 * zip's README still says where the data lives).
 */
export async function appDataFilesForExport(
  fetchExport: (appId: string) => ReturnType<typeof exportBackend> = exportBackend,
): Promise<FileEntry[]> {
  if (!isHumanScale()) return [];
  const appId = appIdIn(useEnvStore.getState().vars);
  if (!appId) return [];
  try {
    const data = await fetchExport(appId);
    return toFileEntries(appDataExportFiles(data));
  } catch (err) {
    console.warn('Export: could not include the app\'s Community Cloud data', err);
    return [];
  }
}

/** What a delete will remove, in words a person can weigh */
export function describeDelete(projectName: string, app: { name: string; documents: number } | null): string {
  if (!app) return `Delete "${projectName}"? This can't be undone.`;
  return `Delete "${projectName}" and its Community Cloud app "${app.name}" (${app.documents} ${app.documents === 1 ? 'document' : 'documents'} neighbors wrote)? Both go for good. Export first if you want a copy.`;
}

/**
 * Delete the project's app too, when the flag is on and the project has one.
 * Returns whether an app was deleted. Throws when the app delete fails, so
 * the caller can stop before the project row goes (a project without its
 * app is recoverable; an app without its project is an orphan).
 */
export async function deleteAppForProject(
  projectId: string,
  remove: (appId: string) => Promise<unknown> = deleteApp,
): Promise<boolean> {
  if (!isHumanScale()) return false;
  const appId = appIdForProject(projectId);
  if (!appId) return false;
  await remove(appId);
  return true;
}
