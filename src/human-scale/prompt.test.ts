import { describe, it, expect, vi, afterEach } from 'vitest';
import { HUMAN_SCALE_BUILD_RULES, humanScaleAiGuidance } from './prompt';

afterEach(() => vi.unstubAllEnvs());

describe('human-scale prompt pieces', () => {
  it('build rules name the four import mistakes and the single-file collapse', () => {
    expect(HUMAN_SCALE_BUILD_RULES).toMatch(/must be in this same reply/);
    expect(HUMAN_SCALE_BUILD_RULES).toMatch(/export NAMES, never a default/);
    expect(HUMAN_SCALE_BUILD_RULES).toMatch(/zustand.*lucide-react.*export names only/);
    expect(HUMAN_SCALE_BUILD_RULES).toMatch(/imported or declared in that file/);
    expect(HUMAN_SCALE_BUILD_RULES).toMatch(/Never answer an app request with a single HTML file/);
  });

  it('runtime guidance points at the kit helper and the bounded-jobs rule', () => {
    const g = humanScaleAiGuidance({ kind: 'local', endpoint: 'http://localhost:11434/v1', model: 'qwen2.5:7b', fallback: 'none' });
    expect(g).toMatch(/@\/lib\/ai/);
    expect(g).toMatch(/Bounded jobs, not a chatbot/);
    expect(g).toMatch(/on this device/);
  });

  it('the system prompt carries the build rules only when the flag is on', async () => {
    vi.stubEnv('VITE_HUMAN_SCALE', '1');
    const { buildSystemPrompt } = await import('@/knowledge/context-builder');
    expect(buildSystemPrompt({ mode: 'build' })).toContain('Imports, exactly');
    expect(buildSystemPrompt({ mode: 'plan' })).not.toContain('Imports, exactly');
    vi.stubEnv('VITE_HUMAN_SCALE', '0');
    expect(buildSystemPrompt({ mode: 'build' })).not.toContain('Imports, exactly');
  });
});
