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

describe('OpenAICompatibleProvider extra body', () => {
  it('merges caller-set fields into the chat request', async () => {
    const fetchMock = vi.fn(async () => sse([{ choices: [{ delta: { content: 'x' } }] }]));
    vi.stubGlobal('fetch', fetchMock);
    const p = provider();
    p.setExtraBody({ provider: { ignore: ['HostA'] } });
    await p.chat([{ role: 'user', content: 'hi' }], 'm', { onToken: () => {}, onComplete: () => {}, onError: e => { throw e; } });
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.provider).toEqual({ ignore: ['HostA'] });
    expect(body.model).toBe('m');
  });
});

describe('the keyless community route', () => {
  it('goes through the proxy with the community token when no key is set, and names the provider', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_LLM_PROXY_URL', 'https://proxy.test/functions/v1/llm-proxy');
    const mod = await import('./openai-compatible');
    mod.setCommunityTokenSource(async () => 'session-token');
    const fetchMock = vi.fn(async () => sse([{ model: 'z-ai/glm-4.5-air', provider: 'Novita', choices: [{ delta: { content: 'ok' } }] }]));
    vi.stubGlobal('fetch', fetchMock);
    const p = new mod.OpenAICompatibleProvider({ id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', communityRoute: 'openrouter-community' });
    expect(p.isConfigured()).toBe(true);
    expect(p.onCommunityRoute()).toBe(true);
    let full = '';
    await p.chat([{ role: 'user', content: 'hi' }], 'z-ai/glm-4.5-air', { onToken: () => {}, onComplete: t => { full = t; }, onError: e => { throw e; } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://proxy.test/functions/v1/llm-proxy');
    expect(init.headers['x-llm-provider']).toBe('openrouter-community');
    expect(init.headers['x-community-token']).toBe('session-token');
    expect(init.headers.Authorization).toBeUndefined();
    expect(full).toBe('ok');
    vi.unstubAllEnvs();
  });

  it('uses the key directly when one is set, and asks for a sign-in when neither is there', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_LLM_PROXY_URL', 'https://proxy.test/llm');
    const mod = await import('./openai-compatible');
    mod.setCommunityTokenSource(async () => null);
    const fetchMock = vi.fn(async () => sse([{ choices: [{ delta: { content: 'x' } }] }]));
    vi.stubGlobal('fetch', fetchMock);
    const p = new mod.OpenAICompatibleProvider({ id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api', communityRoute: 'openrouter-community' });
    await expect(p.chat([{ role: 'user', content: 'hi' }], 'm', { onToken: () => {}, onComplete: () => {}, onError: () => {} })).rejects.toThrow(/Sign in/);
    p.setApiKey('sk-own');
    expect(p.onCommunityRoute()).toBe(false);
    await p.chat([{ role: 'user', content: 'hi' }], 'm', { onToken: () => {}, onComplete: () => {}, onError: e => { throw e; } });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer sk-own');
    vi.unstubAllEnvs();
  });
});

describe('per-model extra body', () => {
  it('computes routing fields from the request model', async () => {
    const fetchMock = vi.fn(async () => sse([{ choices: [{ delta: { content: 'x' } }] }]));
    vi.stubGlobal('fetch', fetchMock);
    const p = provider();
    p.setExtraBodyForModel(m => (m === 'g' ? { provider: { quantizations: ['bf16'] } } : {}));
    await p.chat([{ role: 'user', content: 'hi' }], 'g', { onToken: () => {}, onComplete: () => {}, onError: e => { throw e; } });
    await p.chat([{ role: 'user', content: 'hi' }], 'other', { onToken: () => {}, onComplete: () => {}, onError: e => { throw e; } });
    const bodies = fetchMock.mock.calls.map(c => JSON.parse((c as unknown as [string, { body: string }])[1].body));
    expect(bodies[0].provider).toEqual({ quantizations: ['bf16'] });
    expect(bodies[1].provider).toBeUndefined();
  });
});

