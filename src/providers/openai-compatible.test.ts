import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAICompatibleProvider } from './openai-compatible';
import type { StreamMeta } from './types';

function sse(chunks: object[]): Response {
  const body = chunks.map(c => `data: ${JSON.stringify(c)}\n`).join('') + 'data: [DONE]\n';
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}

function provider() {
  return new OpenAICompatibleProvider({
    id: 'test',
    name: 'Test',
    baseUrl: 'https://example.test',
    apiKey: 'k',
    defaultModels: [],
  });
}

async function run(chunks: object[]) {
  vi.stubGlobal('fetch', vi.fn(async () => sse(chunks)));
  const metas: StreamMeta[] = [];
  let full = '';
  await provider().chat([{ role: 'user', content: 'hi' }], 'm', {
    onToken: () => {},
    onMeta: m => metas.push(m),
    onComplete: t => {
      full = t;
    },
    onError: e => {
      throw e;
    },
  });
  return { metas, full };
}

afterEach(() => vi.unstubAllGlobals());

describe('OpenAICompatibleProvider stream metadata', () => {
  it('reports the serving model, host and fingerprint once, from the first chunk that names them', async () => {
    const { metas, full } = await run([
      { id: '1', model: 'google/gemma-4-26b-a4b-it', provider: 'DeepInfra', system_fingerprint: 'fp_1', choices: [{ delta: { content: 'a' } }] },
      { id: '1', model: 'google/gemma-4-26b-a4b-it', provider: 'DeepInfra', choices: [{ delta: { content: 'b' } }] },
      { id: '1', choices: [{ delta: {}, finish_reason: 'stop' }] },
    ]);
    expect(full).toBe('ab');
    expect(metas).toEqual([{ model: 'google/gemma-4-26b-a4b-it', provider: 'DeepInfra', systemFingerprint: 'fp_1' }]);
  });

  it('stays silent when the provider names nothing', async () => {
    const { metas, full } = await run([{ choices: [{ delta: { content: 'x' } }] }]);
    expect(full).toBe('x');
    expect(metas).toEqual([]);
  });
});
