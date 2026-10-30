import { describe, it, expect } from 'vitest';
import { activeParamsFor, estimateEnergyWh, provenanceRow, describeRow } from './provenance';

describe('activeParamsFor', () => {
  it('knows the open models in play, matching the most specific id', () => {
    expect(activeParamsFor('google/gemma-4-26b-a4b-it')).toBe(4e9);
    expect(activeParamsFor('google/gemma-3-12b-it')).toBe(12e9);
    expect(activeParamsFor('qwen/qwen3-coder-30b-a3b-instruct')).toBe(3e9);
    expect(activeParamsFor('qwen2.5:7b')).toBe(7e9);
  });

  it('refuses to guess a frontier model', () => {
    expect(activeParamsFor('claude-opus-5-5')).toBeNull();
    expect(activeParamsFor('gpt-5.5')).toBeNull();
  });
});

describe('estimateEnergyWh', () => {
  it('is labeled an estimate and names its assumptions', () => {
    const e = estimateEnergyWh({ model: 'google/gemma-3-12b-it', host: 'community', tokensIn: 2000, tokensOut: 500 });
    // 2 * 12e9 * 2500 / 1.4e11 J = 428.6 J = 0.119 Wh
    expect(e.energyWhEstimate).toBeCloseTo(0.119, 3);
    expect(e.method).toMatch(/ESTIMATE/);
    expect(e.method).toMatch(/Not measured/);
    expect(e.method).toMatch(/12B active parameters/);
  });

  it('gives no number, with the reason, when the model size is not public', () => {
    const e = estimateEnergyWh({ model: 'claude-opus-5-5', host: 'community', tokensIn: 2000, tokensOut: 500 });
    expect(e.energyWhEstimate).toBeNull();
    expect(e.method).toMatch(/not public/);
  });

  it('assumes local hardware is less efficient per FLOP', () => {
    const local = estimateEnergyWh({ model: 'qwen2.5:7b', host: 'local', tokensIn: 1000, tokensOut: 200 });
    const hosted = estimateEnergyWh({ model: 'qwen2.5:7b', host: 'hosted', tokensIn: 1000, tokensOut: 200 });
    expect(local.energyWhEstimate!).toBeGreaterThan(hosted.energyWhEstimate!);
  });
});

describe('provenanceRow and describeRow', () => {
  it('builds a complete row and a plain sentence', () => {
    const row = provenanceRow({ side: 'runtime', provider: 'openrouter', model: 'google/gemma-4-26b-a4b-it', host: 'community', tokensIn: 300, tokensOut: 100, at: '2026-10-30T11:00:00Z' });
    expect(row).toMatchObject({ at: '2026-10-30T11:00:00Z', side: 'runtime', params: 4e9, host: 'community', tokensIn: 300, tokensOut: 100 });
    expect(row.energyWhEstimate).not.toBeNull();
    expect(describeRow(row)).toMatch(/Ran on Community AI \(google\/gemma-4-26b-a4b-it\), 400 tokens, about [0-9.]+ Wh, an estimate\./);
  });
});
