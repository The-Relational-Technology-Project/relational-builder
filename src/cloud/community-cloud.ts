import { builderClient } from '@/cloud/builder-client';
import { useEnvStore } from '@/store/env-store';

/**
 * Builder-facing Community Cloud admin client — powers the Cloud tab.
 * All calls ride the builder's session; the edge function checks ownership.
 * The built apps themselves talk to the same function with app_id/app_key.
 */

export interface CloudAppOverview {
  app_id: string;
  name: string;
  app_key: string;
  created_at: string;
  doc_count: number;
  bytes: number;
  member_count: number;
}

export interface CloudLimits {
  max_apps: number;
  max_bytes: number;
  max_docs: number;
}

export interface CloudCollection {
  collection: string;
  doc_count: number;
  bytes: number;
  last_activity: string;
}

export interface CloudDocument {
  id: string;
  data: Record<string, unknown>;
  member_id: string | null;
  member_name: string | null;
  visibility: 'public' | 'members';
  created_at: string;
  updated_at: string;
}

export interface CloudMember {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
}

function fnUrl(): string {
  return `${import.meta.env.VITE_BUILDER_SUPABASE_URL}/functions/v1/app-data`;
}

async function adminRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!builderClient) throw new Error('Cloud is not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to manage your Community Cloud');
  const res = await fetch(fnUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error ?? 'Cloud request failed');
  return result as T;
}

export function getCloudOverview() {
  return adminRequest<{ apps: CloudAppOverview[]; limits: CloudLimits }>('admin_overview');
}

export function getCollections(appId: string) {
  return adminRequest<{ collections: CloudCollection[] }>('admin_collections', { app_id: appId });
}

export function getDocuments(appId: string, collection: string, limit = 50) {
  return adminRequest<{ documents: CloudDocument[] }>('admin_docs', { app_id: appId, collection, limit });
}

export function deleteDocument(appId: string, id: string) {
  return adminRequest<{ ok: boolean }>('admin_delete_doc', { app_id: appId, id });
}

export function getMembers(appId: string) {
  return adminRequest<{ members: CloudMember[] }>('admin_members', { app_id: appId });
}

export function renameApp(appId: string, name: string) {
  return adminRequest<{ ok: boolean }>('admin_rename_app', { app_id: appId, name });
}

export function deleteApp(appId: string) {
  return adminRequest<{ ok: boolean }>('admin_delete_app', { app_id: appId });
}

/** Create a fresh backend and wire it into the current project's env vars */
export async function createAppForProject(name: string): Promise<void> {
  const result = await adminRequest<{ app_id: string; app_key: string }>('create_app', { name });
  attachAppToProject(result.app_id, result.app_key);
}

/** Point the current project at an existing backend (its env vars) */
export function attachAppToProject(appId: string, appKey: string): void {
  const setVar = useEnvStore.getState().setVar;
  setVar('COMMUNITY_CLOUD_URL', fnUrl(), false);
  setVar('APP_ID', appId, false);
  setVar('APP_KEY', appKey, false);
}

export function detachAppFromProject(): void {
  const removeVar = useEnvStore.getState().removeVar;
  for (const key of ['COMMUNITY_CLOUD_URL', 'APP_ID', 'APP_KEY']) removeVar(key);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
