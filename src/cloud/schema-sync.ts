import { useEnvStore } from '@/store/env-store';
import { useProjectStore } from '@/store/project-store';
import { builderClient } from '@/cloud/builder-client';
import {
  getCloudSchema,
  setCloudSchema,
  type CloudCollectionSpec,
} from '@/cloud/community-cloud';

/**
 * Keeps Community Cloud collection schemas in step with the project's
 * cloud-schema.json. The file is the intent (the AI edits it like any other
 * file); the server is the source of truth. Runs after each build that
 * touched the file: no-op when nothing changed, silent sync for additive
 * changes, and an explicit confirmation before destructive ones (a removed
 * collection or field, or a changed type, means the platform stops
 * validating what it used to).
 */

export const CLOUD_SCHEMA_PATH = '/cloud-schema.json';

interface Reconciled {
  /** User-facing note to append to the build message; null = say nothing */
  note: string | null;
}

export async function reconcileCloudSchema(): Promise<Reconciled> {
  const file = useProjectStore.getState().getAllFiles()
    .find(f => f.path === CLOUD_SCHEMA_PATH || f.path.endsWith('/cloud-schema.json'));
  if (!file) return { note: null };

  const appId = useEnvStore.getState().vars.find(v => v.key === 'APP_ID')?.value;
  if (!appId || !builderClient) return { note: null };
  const { data } = await builderClient.auth.getSession();
  if (!data.session) return { note: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(file.content);
  } catch {
    return { note: '⚠️ cloud-schema.json has a syntax error — collection schemas were not updated.' };
  }
  const collections = extractCollections(parsed);
  if (!collections) {
    return { note: '⚠️ cloud-schema.json should look like {"collections": {name: {fields: …}}} — schemas were not updated.' };
  }

  let current: Record<string, CloudCollectionSpec>;
  try {
    const res = await getCloudSchema(appId);
    current = Object.fromEntries(res.collections.map(c => [c.name, c.spec]));
  } catch (err) {
    return { note: `⚠️ Could not read the current cloud schema: ${err instanceof Error ? err.message : 'unknown error'}` };
  }

  if (JSON.stringify(normalize(current)) === JSON.stringify(normalize(collections))) {
    return { note: null };
  }

  const losses = destructiveChanges(current, collections);
  if (losses.length > 0) {
    const ok = window.confirm(
      `This build changes your app's data rules:\n\n- ${losses.join('\n- ')}\n\n` +
      'Existing documents stay put, but the platform will stop checking these. Apply the new schema?',
    );
    if (!ok) {
      return { note: 'ℹ️ Schema change not applied — the cloud keeps its current data rules. Ask me to revise cloud-schema.json if you want something different.' };
    }
  }

  try {
    const { count } = await setCloudSchema(appId, collections);
    return { note: `☁️ Cloud data rules synced (${count} collection${count === 1 ? '' : 's'}).` };
  } catch (err) {
    return { note: `⚠️ Could not sync cloud-schema.json: ${err instanceof Error ? err.message : 'unknown error'}` };
  }
}

/** Accept {"collections": {...}} (documented) or a bare collections map */
function extractCollections(parsed: unknown): Record<string, CloudCollectionSpec> | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const candidate = (obj.collections && typeof obj.collections === 'object' && !Array.isArray(obj.collections))
    ? obj.collections as Record<string, unknown>
    : obj;
  const entries = Object.entries(candidate);
  if (entries.length === 0) return {};
  for (const [, spec] of entries) {
    const fields = (spec as CloudCollectionSpec)?.fields;
    if (!fields || typeof fields !== 'object') return null;
  }
  return candidate as Record<string, CloudCollectionSpec>;
}

/** Plain-language list of what the new schema stops enforcing */
function destructiveChanges(
  current: Record<string, CloudCollectionSpec>,
  next: Record<string, CloudCollectionSpec>,
): string[] {
  const losses: string[] = [];
  for (const [name, spec] of Object.entries(current)) {
    const replacement = next[name];
    if (!replacement) {
      losses.push(`"${name}" loses its schema (its documents keep working, unvalidated)`);
      continue;
    }
    for (const [fname, f] of Object.entries(spec.fields ?? {})) {
      const nf = replacement.fields?.[fname];
      if (!nf) losses.push(`"${name}.${fname}" is no longer declared`);
      else if (nf.type !== f.type) losses.push(`"${name}.${fname}" changes type: ${f.type} → ${nf.type}`);
    }
  }
  return losses;
}

/** Stable key order so semantically-equal specs compare equal */
function normalize(schema: Record<string, CloudCollectionSpec>): unknown {
  return Object.fromEntries(
    Object.keys(schema).sort().map(name => [
      name,
      {
        fields: Object.fromEntries(
          Object.keys(schema[name].fields ?? {}).sort().map(f => {
            const spec = schema[name].fields[f];
            // Drop undefined/false optionals so {"required":false} ≡ omitted
            const out: Record<string, unknown> = { type: spec.type };
            if (spec.required) out.required = true;
            if (spec.unique) out.unique = true;
            if (spec.maxLength) out.maxLength = spec.maxLength;
            return [f, out];
          }),
        ),
      },
    ]),
  );
}
