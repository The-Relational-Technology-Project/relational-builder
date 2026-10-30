import { describe, it, expect } from 'vitest';
import {
  readRuntime,
  effectiveRuntime,
  runtimeEnvVars,
  runtimeManifestLines,
  LOCAL_DEFAULTS,
} from './runtime';

describe('readRuntime', () => {
  it('is null when a project never set a runtime (existing projects untouched)', () => {
    expect(readRuntime([])).toBeNull();
    expect(readRuntime([{ key: 'VITE_SOMETHING', value: 'x' }])).toBeNull();
  });

  it('ignores values this build does not understand', () => {
    expect(readRuntime([{ key: 'AI_RUNTIME', value: 'mainframe' }])).toBeNull();
  });

  it('reads community and byok with no fallback', () => {
    expect(readRuntime([{ key: 'AI_RUNTIME', value: 'community' }])).toEqual({ kind: 'community', fallback: 'none' });
    expect(readRuntime([{ key: 'AI_RUNTIME', value: 'byok' }, { key: 'AI_RUNTIME_FALLBACK', value: 'community' }]))
      .toEqual({ kind: 'byok', fallback: 'none' });
  });

  it('reads local with defaults for endpoint and model', () => {
    expect(readRuntime([{ key: 'AI_RUNTIME', value: 'local' }])).toEqual({
      kind: 'local',
      endpoint: LOCAL_DEFAULTS.endpoint,
      model: LOCAL_DEFAULTS.model,
      fallback: 'none',
    });
    expect(readRuntime([
      { key: 'AI_RUNTIME', value: 'local' },
      { key: 'AI_RUNTIME_ENDPOINT', value: 'http://192.168.1.20:11434/v1' },
      { key: 'AI_RUNTIME_MODEL', value: 'gemma3:4b' },
      { key: 'AI_RUNTIME_FALLBACK', value: 'community' },
    ])).toEqual({ kind: 'local', endpoint: 'http://192.168.1.20:11434/v1', model: 'gemma3:4b', fallback: 'community' });
  });
});

describe('effectiveRuntime', () => {
  it('is null with the flag off and nothing set (today\'s behavior)', () => {
    // VITE_HUMAN_SCALE is not set in the test environment
    expect(effectiveRuntime([])).toBeNull();
  });

  it('honors an explicit setting regardless of the flag', () => {
    expect(effectiveRuntime([{ key: 'AI_RUNTIME', value: 'local' }])?.kind).toBe('local');
  });
});

describe('runtimeEnvVars and readRuntime round-trip', () => {
  it('writes only the kind for community', () => {
    expect(runtimeEnvVars({ kind: 'community', fallback: 'none' })).toEqual([
      { key: 'AI_RUNTIME', value: 'community', isSecret: false },
    ]);
  });

  it('round-trips a local runtime', () => {
    const local = { kind: 'local' as const, endpoint: 'http://localhost:11434/v1', model: 'qwen2.5:3b', fallback: 'community' as const };
    expect(readRuntime(runtimeEnvVars(local))).toEqual(local);
  });
});

describe('runtimeManifestLines', () => {
  it('writes a kind-only block for community', () => {
    expect(runtimeManifestLines({ kind: 'community', fallback: 'none' })).toEqual(['runtime:', '  kind: community', '']);
  });

  it('writes endpoint, model and fallback for local', () => {
    expect(runtimeManifestLines({ kind: 'local', endpoint: 'http://localhost:11434/v1', model: 'qwen2.5:7b', fallback: 'none' }))
      .toEqual(['runtime:', '  kind: local', '  endpoint: "http://localhost:11434/v1"', '  model: "qwen2.5:7b"', '  fallback: none', '']);
  });
});
