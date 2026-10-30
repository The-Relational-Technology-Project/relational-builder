import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ask, summarize, match, resurface, aiRuntime, aiRuntimeLabel, configureAI, AIUnavailableError } from './ai';

type FetchMock = ReturnType<typeof vi.fn>;

function okJson(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

const cloudEnv = {
  COMMUNITY_CLOUD_URL: 'https://x.supabase.co/functions/v1/app-data',
  APP_ID: 'app_1',
  APP_KEY: 'key_1',
};

let fetchMock: FetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  configureAI({});
});

describe('aiRuntime', () => {
  it('defaults to community when nothing is set', () => {
    configureAI({});
    expect(aiRuntime()).toEqual({ kind: 'community', fallback: 'none' });
    expect(aiRuntimeLabel()).toMatch(/Community AI/);
  });

  it('reads a local runtime with defaults', () => {
    configureAI({ AI_RUNTIME: 'local' });
    expect(aiRuntime()).toEqual({ kind: 'local', endpoint: 'http://localhost:11434/v1', model: 'qwen2.5:7b', fallback: 'none' });
    expect(aiRuntimeLabel()).toMatch(/on this device/);
  });
});

describe('community path', () => {
  it('posts ai_chat to the capabilities endpoint and reports where it ran', async () => {
    configureAI(cloudEnv);
    fetchMock.mockResolvedValueOnce(okJson({ text: 'Three neighbors offered rides.', service: 'community-ai' }));
    const r = await summarize('long notes', { sources: ['note-1', 'note-2'] });
    expect(r.text).toBe('Three neighbors offered rides.');
    expect(r.ran).toEqual({ kind: 'community', host: 'community', model: undefined });
    expect(r.sources).toEqual(['note-1', 'note-2']);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://x.supabase.co/functions/v1/app-capabilities');
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ action: 'ai_chat', app_id: 'app_1', app_key: 'key_1', max_tokens: 600 });
    expect(body.messages).toEqual([{ role: 'user', content: 'long notes' }]);
    expect(body.system).toMatch(/Summarize/);
  });

  it('surfaces the server\'s friendly error as AIUnavailableError', async () => {
    configureAI(cloudEnv);
    fetchMock.mockResolvedValueOnce(okJson({ error: 'This app reached its daily AI limit.' }));
    await expect(ask([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      name: 'AIUnavailableError',
      message: 'This app reached its daily AI limit.',
      runtime: 'community',
    });
  });

  it('says so when the app has no cloud to run on', async () => {
    configureAI({});
    await expect(ask([{ role: 'user', content: 'hi' }])).rejects.toBeInstanceOf(AIUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('local path', () => {
  it('calls the OpenAI-compatible endpoint from the browser', async () => {
    configureAI({ AI_RUNTIME: 'local', AI_RUNTIME_ENDPOINT: 'http://localhost:11434/v1/', AI_RUNTIME_MODEL: 'gemma3:4b' });
    fetchMock.mockResolvedValueOnce(okJson({ model: 'gemma3:4b', choices: [{ message: { content: 'ok' } }] }));
    const r = await ask([{ role: 'user', content: 'hi' }], 'be brief');
    expect(r.text).toBe('ok');
    expect(r.ran).toEqual({ kind: 'local', host: 'local', model: 'gemma3:4b' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:11434/v1/chat/completions');
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe('gemma3:4b');
    expect(body.messages[0]).toEqual({ role: 'system', content: 'be brief' });
  });

  it('degrades honestly when unreachable and no fallback is set: plain message, nothing sent elsewhere', async () => {
    configureAI({ ...cloudEnv, AI_RUNTIME: 'local' });
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    await expect(ask([{ role: 'user', content: 'hi' }])).rejects.toMatchObject({
      name: 'AIUnavailableError',
      runtime: 'local',
      message: expect.stringMatching(/on this device.*isn't reachable.*Nothing was sent anywhere else/),
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to the community only when the setting says so, and marks the answer', async () => {
    configureAI({ ...cloudEnv, AI_RUNTIME: 'local', AI_RUNTIME_FALLBACK: 'community' });
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okJson({ text: 'from the community' }));
    const r = await ask([{ role: 'user', content: 'hi' }]);
    expect(r.text).toBe('from the community');
    expect(r.ran).toMatchObject({ kind: 'community', host: 'community', fellBack: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('named jobs parse defensively', () => {
  it('match keeps only pairs over real ids', async () => {
    configureAI(cloudEnv);
    fetchMock.mockResolvedValueOnce(okJson({ text: 'NEED n1 -> OFFER o2: both free Tuesday\nNEED n9 -> OFFER o1: no such need\nchatter' }));
    const r = await match([{ id: 'n1', text: 'ride to clinic' }], [{ id: 'o1', text: 'van' }, { id: 'o2', text: 'car Tuesdays' }]);
    expect(r.pairs).toEqual([{ need: 'n1', offer: 'o2', why: 'both free Tuesday' }]);
  });

  it('resurface returns picks in order, capped, and as sources', async () => {
    configureAI(cloudEnv);
    fetchMock.mockResolvedValueOnce(okJson({ text: 'PICK b: decided the gate\nPICK a: first mention\nPICK a: repeat\nPICK zz: unknown' }));
    const r = await resurface([{ id: 'a', text: 'gate idea' }, { id: 'b', text: 'gate decision', when: 'Oct 3' }], 'the garden gate', { limit: 2 });
    expect(r.picks).toEqual(['b', 'a']);
    expect(r.sources).toEqual(['b', 'a']);
  });
});
