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

function capFnUrl(): string {
  return `${import.meta.env.VITE_BUILDER_SUPABASE_URL}/functions/v1/app-capabilities`;
}

async function sessionRequest<T>(url: string, action: string, payload: Record<string, unknown>): Promise<T> {
  if (!builderClient) throw new Error('Cloud is not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to manage your Community Cloud');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error ?? 'Cloud request failed');
  return result as T;
}

function adminRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return sessionRequest<T>(fnUrl(), action, payload);
}

/** Vault/capability calls — same session auth, sibling edge function */
function capRequest<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  return sessionRequest<T>(capFnUrl(), action, payload);
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

// ── Export & backups: neighbors' data can always leave, and survive a mistake ──

export interface CloudExportDocument extends CloudDocument {
  collection: string;
}

export interface CloudBackupMeta {
  id: string;
  taken_at: string;
  reason: 'daily' | 'manual' | 'pre_restore';
  doc_count: number;
  member_count: number;
  bytes: number;
  skipped_reason: string | null;
}

/**
 * Pull the whole backend, paged, and assemble one export object. The first
 * page carries members + collection specs; later pages append documents.
 */
export async function exportBackend(appId: string): Promise<{
  app: { id: string; name: string };
  exported_at: string;
  collections: CloudSchemaRow[];
  members: CloudMember[];
  documents: CloudExportDocument[];
}> {
  const first = await adminRequest<{
    app: { id: string; name: string };
    documents: CloudExportDocument[];
    members: CloudMember[];
    collections: CloudSchemaRow[];
    done: boolean;
  }>('admin_export_page', { app_id: appId, offset: 0 });
  const documents = [...first.documents];
  let done = first.done;
  while (!done) {
    const page = await adminRequest<{ documents: CloudExportDocument[]; done: boolean }>(
      'admin_export_page',
      { app_id: appId, offset: documents.length },
    );
    documents.push(...page.documents);
    done = page.done || page.documents.length === 0;
  }
  return {
    app: first.app,
    exported_at: new Date().toISOString(),
    collections: first.collections,
    members: first.members,
    documents,
  };
}

/** One collection's documents as CSV — data keys become columns. */
export function documentsToCsv(documents: CloudExportDocument[]): string {
  const keys = new Set<string>();
  for (const d of documents) {
    for (const k of Object.keys(d.data ?? {})) keys.add(k);
  }
  const dataKeys = [...keys].sort();
  const header = ['id', ...dataKeys, 'posted_by', 'visibility', 'created_at', 'updated_at'];
  const cell = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = documents.map(d => [
    d.id,
    ...dataKeys.map(k => cell((d.data as Record<string, unknown>)?.[k])),
    cell(d.member_name ?? ''),
    d.visibility ?? 'public',
    d.created_at,
    d.updated_at,
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

export function listBackups(appId: string) {
  return adminRequest<{ backups: CloudBackupMeta[] }>('admin_backups', { app_id: appId });
}

export function takeBackupNow(appId: string) {
  return adminRequest<{ ok: boolean; backup_id: string | null }>('admin_backup_now', { app_id: appId });
}

export function downloadBackup(appId: string, backupId: string) {
  return adminRequest<{ backup: CloudBackupMeta & { payload: unknown } }>(
    'admin_backup_download',
    { app_id: appId, backup_id: backupId },
  );
}

export function restoreBackup(appId: string, backupId: string) {
  return adminRequest<{ ok?: boolean; documents?: number; members_added?: number; error?: string }>(
    'admin_restore_backup',
    { app_id: appId, backup_id: backupId },
  );
}

// ── Typed collections: the project's cloud-schema.json mirrored server-side ──

export interface CloudFieldSpec {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  unique?: boolean;
  maxLength?: number;
}

export interface CloudCollectionSpec {
  fields: Record<string, CloudFieldSpec>;
}

export interface CloudSchemaRow {
  name: string;
  spec: CloudCollectionSpec;
  version: number;
  updated_at: string;
}

export function getCloudSchema(appId: string) {
  return adminRequest<{ collections: CloudSchemaRow[] }>('admin_schema_get', { app_id: appId });
}

export function setCloudSchema(appId: string, collections: Record<string, CloudCollectionSpec>) {
  return adminRequest<{ ok: boolean; count: number }>('admin_schema_set', { app_id: appId, collections });
}

// ── Capability vault: builder-pasted service keys, stored server-side only ──

export interface AppSecretStatus {
  service: string;
  config: { from_name?: string; from_email?: string; members_only_send?: boolean };
  daily_cap: number;
  sends_today: number;
  created_at: string;
  last_used_at: string | null;
}

export interface EmailLogRow {
  recipient: string;
  subject: string | null;
  status: 'sent' | 'failed';
  error: string | null;
  created_at: string;
}

export function setAppSecret(appId: string, service: string, secret: string, config?: AppSecretStatus['config']) {
  return capRequest<{ ok: boolean }>('secret_set', { app_id: appId, service, secret, config });
}

/** Backfill for projects attached before capabilities existed */
export function ensureCapabilitiesUrl(): void {
  const { vars, setVar } = useEnvStore.getState();
  if (!vars.some(v => v.key === 'COMMUNITY_CAPABILITIES_URL' && v.value.trim())) {
    setVar('COMMUNITY_CAPABILITIES_URL', capFnUrl(), false);
  }
}

export function updateSecretConfig(appId: string, service: string, config: AppSecretStatus['config']) {
  return capRequest<{ ok: boolean }>('secret_config', { app_id: appId, service, config });
}

export function deleteAppSecret(appId: string, service: string) {
  return capRequest<{ ok: boolean }>('secret_delete', { app_id: appId, service });
}

export function getSecretStatus(appId: string) {
  return capRequest<{ secrets: AppSecretStatus[] }>('secret_status', { app_id: appId });
}

export function testAppSecret(appId: string, service: string) {
  return capRequest<{ ok: boolean; error?: string; verified_domains?: string[] }>('secret_test', { app_id: appId, service });
}

export function getEmailLog(appId: string, limit = 20) {
  return capRequest<{ log: EmailLogRow[] }>('secret_log', { app_id: appId, limit });
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
  setVar('COMMUNITY_CAPABILITIES_URL', capFnUrl(), false);
  setVar('APP_ID', appId, false);
  setVar('APP_KEY', appKey, false);
}

export function detachAppFromProject(): void {
  const removeVar = useEnvStore.getState().removeVar;
  for (const key of ['COMMUNITY_CLOUD_URL', 'COMMUNITY_CAPABILITIES_URL', 'APP_ID', 'APP_KEY', 'COMMUNITY_EMAIL']) removeVar(key);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
