import { builderClient } from '@/cloud/builder-client';
import { useEnvStore } from '@/store/env-store';
import { useProjectStore } from '@/store/project-store';
import { lintMigrationSql } from '@/project/sql-lint';

/**
 * Client for the supabase-admin edge function: the Builder operating a
 * builder's OWN Supabase project — vaulted PAT, auto-applied migrations
 * (ledger-idempotent server-side), function deploys, secrets. Plus the
 * post-build flow that turns generated supabase/migrations/*.sql into an
 * applied schema: lint → plain-language confirm → apply → note.
 */

/** Env marker: management access is connected and this project is managed */
export const SUPABASE_MANAGED_KEY = 'SUPABASE_MANAGED';

function fnUrl(): string {
  return `${import.meta.env.VITE_BUILDER_SUPABASE_URL}/functions/v1/supabase-admin`;
}

async function adminCall<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!builderClient) throw new Error('Cloud is not configured');
  const { data } = await builderClient.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Sign in to manage your Supabase projects');
  const res = await fetch(fnUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...payload }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(result.error ?? 'Supabase management request failed');
  return result as T;
}

export interface SbProject {
  ref: string;
  name: string;
  region: string;
  status: string;
}

export interface MigrationResult {
  name: string;
  status: 'applied' | 'skipped' | 'drift' | 'error';
  error?: string;
}

export function patSet(secret: string) {
  return adminCall<{ ok: boolean; projects_count: number }>('pat_set', { secret });
}

export function patStatus() {
  return adminCall<{ connected: boolean; created_at?: string; last_used_at?: string }>('pat_status');
}

export function patDelete() {
  return adminCall<{ ok: boolean }>('pat_delete');
}

export function sbProjects() {
  return adminCall<{ projects: SbProject[] }>('sb_projects');
}

export function sbProjectKeys(projectRef: string) {
  return adminCall<{ url: string; anon_key: string }>('sb_project_keys', { project_ref: projectRef });
}

export function sbApplyMigrations(projectRef: string, migrations: { name: string; sql: string }[]) {
  return adminCall<{ results: MigrationResult[] }>('sb_apply_migrations', { project_ref: projectRef, migrations });
}

export function sbDeployFunction(projectRef: string, slug: string, code: string, verifyJwt = false) {
  return adminCall<{ ok: boolean; version: number | null }>('sb_deploy_function', {
    project_ref: projectRef, slug, code, verify_jwt: verifyJwt,
  });
}

export function sbSetSecrets(projectRef: string, secrets: { name: string; value: string }[]) {
  return adminCall<{ ok: boolean }>('sb_set_secrets', { project_ref: projectRef, secrets });
}

/** Wire a picked project into the current app's env vars */
export async function attachSupabaseProject(project: SbProject): Promise<void> {
  const keys = await sbProjectKeys(project.ref);
  const setVar = useEnvStore.getState().setVar;
  setVar('SUPABASE_URL', keys.url, false);
  setVar('SUPABASE_ANON_KEY', keys.anon_key, false);
  setVar('SUPABASE_PROJECT_REF', project.ref, false);
  setVar(SUPABASE_MANAGED_KEY, 'on', false);
}

export function detachSupabaseProject(): void {
  const removeVar = useEnvStore.getState().removeVar;
  for (const key of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_PROJECT_REF', SUPABASE_MANAGED_KEY]) {
    removeVar(key);
  }
}

export function supabaseManaged(): { managed: boolean; projectRef: string } {
  const vars = useEnvStore.getState().vars;
  const managed = vars.some(v => v.key === SUPABASE_MANAGED_KEY && v.value.trim());
  const projectRef = vars.find(v => v.key === 'SUPABASE_PROJECT_REF')?.value ?? '';
  return { managed: managed && !!projectRef, projectRef };
}

const MIGRATION_PATH_RE = /^\/?supabase\/migrations\/([a-zA-Z0-9._-]+\.sql)$/;
const FUNCTION_PATH_RE = /^\/?supabase\/functions\/([a-z0-9-]+)\/index\.ts$/;

/**
 * Post-build: lint and apply the project's migrations, deploy edge functions
 * this build touched. Returns a note for the build message (null = nothing
 * relevant happened). Ledger on the server makes re-applies idempotent, so
 * we always submit every migration file and let hashes sort it out.
 */
export async function applySupabaseChanges(messageContent: string): Promise<{ note: string | null }> {
  const { managed, projectRef } = supabaseManaged();
  if (!managed) return { note: null };

  const files = useProjectStore.getState().getAllFiles();
  const migrations = files
    .filter(f => MIGRATION_PATH_RE.test(f.path))
    .map(f => ({ name: f.path.match(MIGRATION_PATH_RE)![1], sql: f.content }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const touchedFunctions = files
    .filter(f => FUNCTION_PATH_RE.test(f.path) && messageContent.includes(f.path.replace(/^\//, '')))
    .map(f => ({ slug: f.path.match(FUNCTION_PATH_RE)![1], code: f.content }));

  if (migrations.length === 0 && touchedFunctions.length === 0) return { note: null };

  const notes: string[] = [];

  if (migrations.length > 0) {
    const errors: string[] = [];
    const warnings: string[] = [];
    const destructive: string[] = [];
    for (const m of migrations) {
      const lint = lintMigrationSql(m.name, m.sql);
      errors.push(...lint.errors);
      warnings.push(...lint.warnings);
      destructive.push(...lint.destructive);
    }

    if (errors.length > 0) {
      return {
        note: `🛑 Migrations NOT applied — the safety check found problems:\n> - ${errors.join('\n> - ')}\n> Ask me to fix the migration and I'll apply it on the next build.`,
      };
    }

    const summary = [
      `Apply ${migrations.length} database migration${migrations.length === 1 ? '' : 's'} to your Supabase project?`,
      '',
      ...migrations.map(m => `• ${m.name}`),
      '',
      'Already-applied files are skipped automatically.',
      ...(destructive.length > 0
        ? ['', '⚠️ THIS CHANGE:', ...destructive.map(d => `• ${d}`)]
        : []),
    ].join('\n');
    if (!window.confirm(summary)) {
      return { note: 'ℹ️ Migrations not applied — say the word and I can apply them in a later build, or revise them first.' };
    }

    try {
      const { results } = await sbApplyMigrations(projectRef, migrations);
      const applied = results.filter(r => r.status === 'applied').length;
      const skipped = results.filter(r => r.status === 'skipped').length;
      const problems = results.filter(r => r.status === 'drift' || r.status === 'error');
      if (applied > 0) notes.push(`🗄️ Applied ${applied} migration${applied === 1 ? '' : 's'} to your database`);
      else if (problems.length === 0) notes.push(`🗄️ Database already up to date (${skipped} migration${skipped === 1 ? '' : 's'} previously applied)`);
      for (const p of problems) notes.push(`⚠️ ${p.name}: ${p.error}`);
      if (warnings.length > 0) notes.push(...warnings.map(w => `⚠️ ${w}`));
    } catch (err) {
      notes.push(`⚠️ Could not apply migrations: ${err instanceof Error ? err.message : 'unknown error'}`);
    }
  }

  if (touchedFunctions.length > 0) {
    const ok = window.confirm(
      `Deploy ${touchedFunctions.length} edge function${touchedFunctions.length === 1 ? '' : 's'} to your Supabase project?\n\n` +
      touchedFunctions.map(f => `• ${f.slug}`).join('\n'),
    );
    if (ok) {
      for (const f of touchedFunctions) {
        try {
          await sbDeployFunction(projectRef, f.slug, f.code);
          notes.push(`⚡ Deployed edge function "${f.slug}"`);
        } catch (err) {
          notes.push(`⚠️ Could not deploy "${f.slug}": ${err instanceof Error ? err.message : 'unknown error'}`);
        }
      }
    } else {
      notes.push('ℹ️ Edge functions not deployed this time.');
    }
  }

  return { note: notes.length > 0 ? notes.join('\n> ') : null };
}
