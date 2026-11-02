import { describe, it, expect } from 'vitest';
import { builderCallRow, hostForProvider, charsToTokens, summarizeRows } from './provenance-store';

describe('builder provenance rows', () => {
  it('maps providers to hosts and estimates tokens from characters', () => {
    expect(hostForProvider('local')).toBe('local');
    expect(hostForProvider('claude')).toBe('hosted');
    expect(hostForProvider('openrouter')).toBe('hosted');
    expect(charsToTokens(4000)).toBe(1000);
  });

  it('builds a labeled row; a frontier model gets no energy number', () => {
    const r = builderCallRow({ providerId: 'claude', model: 'claude-opus-5-5', promptChars: 40_000, replyChars: 8000, projectId: 'p1', at: '2026-11-02T00:00:00Z' });
    expect(r).toMatchObject({ side: 'builder', provider: 'claude', host: 'hosted', tokensIn: 10_000, tokensOut: 2000, projectId: 'p1', energyWhEstimate: null });
    expect(r.method).toMatch(/not public/);
    expect(r.method).toMatch(/characters\/4/);
  });

  it('estimates for an open model on a local host and summarizes', () => {
    const a = builderCallRow({ providerId: 'local', model: 'qwen2.5:7b', promptChars: 40_000, replyChars: 8000, projectId: 'p1' });
    const b = builderCallRow({ providerId: 'claude', model: 'claude-opus-5-5', promptChars: 4000, replyChars: 400, projectId: 'p1' });
    expect(a.energyWhEstimate).toBeGreaterThan(0);
    const s = summarizeRows([a, b]);
    expect(s.calls).toBe(2);
    expect(s.tokensIn).toBe(11_000);
    expect(s.energyWhEstimate).toBeCloseTo(a.energyWhEstimate!, 3);
    expect(s.unestimated).toBe(1);
    expect(s.models).toEqual(['qwen2.5:7b', 'claude-opus-5-5']);
  });
});
