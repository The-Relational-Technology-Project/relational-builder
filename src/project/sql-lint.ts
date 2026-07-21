/**
 * Deterministic pre-apply linter for AI-generated Supabase migrations —
 * the guard between "the model wrote SQL" and "it runs on the builder's
 * database". Encodes the RLS rules the system prompt already teaches
 * (see the Supabase guidance in integrations/catalog.ts) as assertions:
 *
 *  errors      — block the apply until the AI fixes the migration
 *  destructive — allowed, but named plainly in the builder's confirm dialog
 *  warnings    — surfaced in the result note, never blocking
 *
 * Regex-based like security-scan.ts: cheap, instant, and honest about being
 * a tripwire rather than a SQL parser.
 */

export interface SqlLintResult {
  errors: string[];
  warnings: string[];
  destructive: string[];
}

const CREATE_TABLE_RE = /create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/gi;
const ENABLE_RLS_RE = /alter\s+table\s+(?:only\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?\s+enable\s+row\s+level\s+security/gi;
const CREATE_POLICY_RE = /create\s+policy\b[\s\S]*?;/gi;
const DROP_TABLE_RE = /drop\s+table\s+(?:if\s+exists\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/gi;
const DROP_COLUMN_RE = /alter\s+table\s+[^;]*?\bdrop\s+column\s+(?:if\s+exists\s+)?"?([a-zA-Z0-9_]+)"?/gi;
const TRUNCATE_RE = /\btruncate\s+(?:table\s+)?(?:"?public"?\.)?"?([a-zA-Z0-9_]+)"?/gi;

function stripComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
}

export function lintMigrationSql(name: string, rawSql: string): SqlLintResult {
  const sql = stripComments(rawSql);
  const errors: string[] = [];
  const warnings: string[] = [];
  const destructive: string[] = [];

  // Every table created here must get RLS enabled here — a table without
  // RLS is fully readable and writable by anyone holding the anon key.
  const created = [...sql.matchAll(CREATE_TABLE_RE)].map(m => m[1].toLowerCase());
  const rlsEnabled = new Set([...sql.matchAll(ENABLE_RLS_RE)].map(m => m[1].toLowerCase()));
  for (const table of created) {
    if (!rlsEnabled.has(table)) {
      errors.push(`${name}: table "${table}" is created without ENABLE ROW LEVEL SECURITY`);
    }
  }

  // Policy hygiene
  for (const match of sql.matchAll(CREATE_POLICY_RE)) {
    const policy = match[0];
    const openWrite = /for\s+(update|delete)\b/i.exec(policy);
    if (openWrite && /using\s*\(\s*true\s*\)/i.test(policy)) {
      errors.push(`${name}: a ${openWrite[1].toUpperCase()} policy uses USING (true) — anyone could change or remove anyone's rows`);
    }
    if (/for\s+all\b/i.test(policy)) {
      warnings.push(`${name}: a FOR ALL policy covers every action at once — separate policies per action are safer`);
    }
  }

  // Keys that must never appear in SQL any more than in app code
  if (/service_role|service-role/i.test(sql)) {
    errors.push(`${name}: references the service_role — that key never belongs in migrations or app code`);
  }

  // Legal but irreversible — the builder confirms these by name
  for (const m of sql.matchAll(DROP_TABLE_RE)) destructive.push(`drops table "${m[1]}" and all its data`);
  for (const m of sql.matchAll(DROP_COLUMN_RE)) destructive.push(`drops column "${m[1]}" and its data`);
  for (const m of sql.matchAll(TRUNCATE_RE)) destructive.push(`empties table "${m[1]}"`);
  if (/\bdelete\s+from\s+(?:"?public"?\.)?"?[a-zA-Z0-9_]+"?\s*;/gi.test(sql)) {
    destructive.push('deletes every row from a table (DELETE without WHERE)');
  }

  if (/grant\s+[^;]*\bto\s+anon\b/i.test(sql)) {
    warnings.push(`${name}: grants to the anon role — double-check that's meant to be public`);
  }

  return { errors, warnings, destructive };
}
