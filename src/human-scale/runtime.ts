/**
 * The per-project `runtime` setting: where a built app's AI calls go.
 * See docs/human-scale/README.md ("The flag and config shape").
 *
 * The setting is stored as four PUBLIC env vars on the project rather than
 * a new store field, because the env store already does everything the
 * setting needs: it persists per project (stash/restore), flows into the
 * preview, every export and every deploy as `env`, and the generated app
 * reads it the same way it reads any other public var. This module is the
 * one place that knows the keys; everything else asks it.
 *
 * Nothing here changes a project that never touched the setting: with no
 * AI_RUNTIME var, `readRuntime` is null and `effectiveRuntime` is null
 * unless the human-scale flag is on, in which case the default is
 * `community` (Josh, Oct 28: community by default, local one click away,
 * a hosted frontier model never the silent default).
 */

import { isHumanScale } from './flag';

export type RuntimeKind = 'community' | 'local' | 'byok';
export type RuntimeFallback = 'none' | 'community';

export interface ProjectRuntime {
  /** Where the app's AI calls go */
  kind: RuntimeKind;
  /** local only: an OpenAI-compatible base URL (Ollama: http://localhost:11434/v1) */
  endpoint?: string;
  /** local only: the model name the endpoint serves */
  model?: string;
  /** What happens when a local endpoint is unreachable. Explicit, never silent. */
  fallback: RuntimeFallback;
}

export const RUNTIME_ENV_KEYS = {
  kind: 'AI_RUNTIME',
  endpoint: 'AI_RUNTIME_ENDPOINT',
  model: 'AI_RUNTIME_MODEL',
  fallback: 'AI_RUNTIME_FALLBACK',
} as const;

export const RUNTIME_KINDS: RuntimeKind[] = ['community', 'local', 'byok'];

export const COMMUNITY_DEFAULT: ProjectRuntime = { kind: 'community', fallback: 'none' };

/** First local target from the brief: Ollama serving a small Qwen */
export const LOCAL_DEFAULTS = {
  endpoint: 'http://localhost:11434/v1',
  model: 'qwen2.5:7b',
} as const;

interface KeyValue {
  key: string;
  value: string;
}

function isKind(v: string): v is RuntimeKind {
  return (RUNTIME_KINDS as string[]).includes(v);
}

/** The runtime a project's env vars spell out, or null when it was never set
 *  (or set to something this build does not understand). */
export function readRuntime(vars: KeyValue[]): ProjectRuntime | null {
  const get = (key: string) => vars.find(v => v.key === key)?.value.trim() || undefined;
  const kind = get(RUNTIME_ENV_KEYS.kind);
  if (!kind || !isKind(kind)) return null;
  const fallback = get(RUNTIME_ENV_KEYS.fallback) === 'community' ? 'community' : 'none';
  if (kind !== 'local') return { kind, fallback: 'none' };
  return {
    kind,
    endpoint: get(RUNTIME_ENV_KEYS.endpoint) ?? LOCAL_DEFAULTS.endpoint,
    model: get(RUNTIME_ENV_KEYS.model) ?? LOCAL_DEFAULTS.model,
    fallback,
  };
}

/** What the app will actually use: the explicit setting, else the flag's
 *  default, else nothing (today's behavior, untouched). */
export function effectiveRuntime(vars: KeyValue[]): ProjectRuntime | null {
  return readRuntime(vars) ?? (isHumanScale() ? COMMUNITY_DEFAULT : null);
}

/** The env vars that spell a runtime out. Public by definition: nothing in
 *  them is a secret, and the app must read them. */
export function runtimeEnvVars(runtime: ProjectRuntime): Array<KeyValue & { isSecret: false }> {
  const out: Array<KeyValue & { isSecret: false }> = [
    { key: RUNTIME_ENV_KEYS.kind, value: runtime.kind, isSecret: false },
  ];
  if (runtime.kind === 'local') {
    out.push(
      { key: RUNTIME_ENV_KEYS.endpoint, value: runtime.endpoint ?? LOCAL_DEFAULTS.endpoint, isSecret: false },
      { key: RUNTIME_ENV_KEYS.model, value: runtime.model ?? LOCAL_DEFAULTS.model, isSecret: false },
      { key: RUNTIME_ENV_KEYS.fallback, value: runtime.fallback, isSecret: false },
    );
  }
  return out;
}

/** Every key the setting may have written, for clearing it */
export const ALL_RUNTIME_ENV_KEYS: string[] = Object.values(RUNTIME_ENV_KEYS);

const yamlEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

/** The `runtime:` block of .reltech.yml, so the setting travels with the code */
export function runtimeManifestLines(runtime: ProjectRuntime): string[] {
  const lines = ['runtime:', `  kind: ${runtime.kind}`];
  if (runtime.kind === 'local') {
    lines.push(
      `  endpoint: "${yamlEscape(runtime.endpoint ?? LOCAL_DEFAULTS.endpoint)}"`,
      `  model: "${yamlEscape(runtime.model ?? LOCAL_DEFAULTS.model)}"`,
      `  fallback: ${runtime.fallback}`,
    );
  }
  lines.push('');
  return lines;
}

/** Plain-language account of a runtime, for the settings card, the chat and the prompt */
export function describeRuntime(runtime: ProjectRuntime): string {
  switch (runtime.kind) {
    case 'community':
      return 'Community AI: an open-weight model the community can host, through the Relational Tech Project. No key needed.';
    case 'local': {
      const where = /localhost|127\.0\.0\.1/.test(runtime.endpoint ?? '') ? 'on this device' : `at ${runtime.endpoint}`;
      const tail = runtime.fallback === 'community'
        ? 'If it is not reachable, Community AI answers instead and the app says so.'
        : 'If it is not reachable, the app says so and waits; nothing is sent anywhere else.';
      return `A model running ${where} (${runtime.model ?? LOCAL_DEFAULTS.model}). Nothing leaves the room. ${tail}`;
    }
    case 'byok':
      return 'Your own key: the AI provider you connected in Services (a hosted frontier model, by your explicit choice).';
  }
}
